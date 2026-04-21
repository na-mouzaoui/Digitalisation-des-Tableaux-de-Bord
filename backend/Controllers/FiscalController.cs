using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CheckFillingAPI.Data;
using CheckFillingAPI.Models;
using CheckFillingAPI.RealTime;
using CheckFillingAPI.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace CheckFillingAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FiscalController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    private readonly IHubContext<CheckUpdatesHub> _hubContext;

    public FiscalController(AppDbContext context, IAuditService auditService, IHubContext<CheckUpdatesHub> hubContext)
    {
        _context = context;
        _auditService = auditService;
        _hubContext = hubContext;
    }

    private async Task NotifyFiscalDeclarationChangedAsync(string action, Declaration declaration, int changedByUserId)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("fiscalDeclarationChanged", new
            {
                action,
                declarationId = declaration.Id,
                declaration.TabKey,
                declaration.Mois,
                declaration.Annee,
                declaration.Direction,
                declaration.IsApproved,
                declaration.ApprovedByUserId,
                declaration.ApprovedAt,
                declaration.UpdatedAt,
                changedByUserId,
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"SignalR fiscalDeclarationChanged failed: {ex.Message}");
        }
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.Parse(userIdClaim ?? "0");
    }

    private async Task<(string Role, string Direction, string Region)> GetCurrentUserContextAsync(int userId)
    {
        var userFromDatabase = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Role, u.Direction, u.Region })
            .FirstOrDefaultAsync();

        var roleClaim = User.FindFirst("role")?.Value
            ?? User.FindFirst(ClaimTypes.Role)?.Value
            ?? "";

        var normalizedRole = !string.IsNullOrWhiteSpace(userFromDatabase?.Role)
            ? userFromDatabase!.Role.Trim().ToLowerInvariant()
            : roleClaim.Trim().ToLowerInvariant();

        return (
            normalizedRole,
            (userFromDatabase?.Direction ?? "").Trim(),
            (userFromDatabase?.Region ?? "").Trim()
        );
    }

    private static string ResolveDirectionForRole(string role, string? requestedDirection, string userDirection, string userRegion, string? existingDirection = null)
    {
        var normalizedRole = (role ?? "").Trim().ToLowerInvariant();
        var normalizedRequestedDirection = (requestedDirection ?? "").Trim();
        var normalizedUserDirection = (userDirection ?? "").Trim();
        var normalizedUserRegion = (userRegion ?? "").Trim();
        var normalizedExistingDirection = (existingDirection ?? "").Trim();

        if (normalizedRole == "admin")
        {
            if (!string.IsNullOrWhiteSpace(normalizedRequestedDirection))
                return normalizedRequestedDirection;
            if (!string.IsNullOrWhiteSpace(normalizedExistingDirection))
                return normalizedExistingDirection;
            return normalizedUserDirection;
        }

        if (normalizedRole is "comptabilite" or "finance")
            return "Siège";

        if (normalizedRole == "regionale")
        {
            if (!string.IsNullOrWhiteSpace(normalizedUserRegion))
                return normalizedUserRegion;
            if (!string.IsNullOrWhiteSpace(normalizedUserDirection))
                return normalizedUserDirection;
        }

        if (!string.IsNullOrWhiteSpace(normalizedRequestedDirection))
            return normalizedRequestedDirection;
        if (!string.IsNullOrWhiteSpace(normalizedExistingDirection))
            return normalizedExistingDirection;
        return normalizedUserDirection;
    }

    private static readonly string[] RegionalManageableTabOrder =
    {
        "encaissement",
        "tva_immo",
        "tva_biens",
        "droits_timbre",
        "ca_tap",
        "etat_tap"
    };

    private static readonly string[] FinanceManageableTabOrder =
    {
        "ca_siege",
        "irg",
        "taxe2",
        "taxe_masters",
        "taxe_vehicule",
        "taxe_formation",
        "acompte",
        "ibs",
        "taxe_domicil",
        "tva_autoliq"
    };

    private static readonly HashSet<string> RegionalManageableTabs = new(RegionalManageableTabOrder, StringComparer.OrdinalIgnoreCase);
    private static readonly HashSet<string> FinanceManageableTabs = new(FinanceManageableTabOrder, StringComparer.OrdinalIgnoreCase);

    private static string NormalizeTabKey(string? tabKey) => (tabKey ?? "").Trim().ToLowerInvariant();

    private async Task<bool> IsTable6EnabledAsync()
    {
        var setting = await _context.AdminFiscalSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1);

        return setting?.IsTable6Enabled ?? true;
    }

    private static bool CanManageTabForRole(string role, string? tabKey)
    {
        var normalizedRole = (role ?? "").Trim().ToLowerInvariant();
        var normalizedTabKey = NormalizeTabKey(tabKey);

        if (string.IsNullOrWhiteSpace(normalizedTabKey)) return false;

        if (normalizedRole == "admin")
            return true;

        if (normalizedRole == "regionale")
            return RegionalManageableTabs.Contains(normalizedTabKey);

        if (normalizedRole is "comptabilite" or "finance")
            return FinanceManageableTabs.Contains(normalizedTabKey);

        return false;
    }

    private static bool IsHeadOfficeDirection(string? direction)
    {
        var normalizedDirection = (direction ?? "").Trim().ToLowerInvariant();
        return normalizedDirection is "siege" or "siège"
            || normalizedDirection.Contains("siege")
            || normalizedDirection.Contains("siège");
    }

    private static string[] GetManageableTabsForRole(string role)
    {
        var normalizedRole = (role ?? "").Trim().ToLowerInvariant();

        if (normalizedRole == "admin")
            return RegionalManageableTabOrder.Concat(FinanceManageableTabOrder).ToArray();

        if (normalizedRole == "regionale")
            return RegionalManageableTabOrder.ToArray();

        if (normalizedRole is "comptabilite" or "finance")
            return FinanceManageableTabOrder.ToArray();

        return Array.Empty<string>();
    }

    private static string[] GetManageableTabsForRoleAndDirection(string role, string? direction)
    {
        var roleTabs = GetManageableTabsForRole(role);
        var normalizedRole = (role ?? "").Trim().ToLowerInvariant();

        if (normalizedRole != "admin" || string.IsNullOrWhiteSpace(direction))
            return roleTabs;

        var scoped = IsHeadOfficeDirection(direction) ? FinanceManageableTabOrder : RegionalManageableTabOrder;
        return roleTabs
            .Where(tab => scoped.Contains(tab, StringComparer.OrdinalIgnoreCase))
            .ToArray();
    }

    /// <summary>
    /// Vérifie si l'utilisateur courant peut accéder à une déclaration fiscale pour la modifier/consulter/supprimer
    /// basée sur sa direction et son rôle, indépendamment de qui l'a créée.
    /// </summary>
    private async Task<bool> CanUserAccessDeclarationAsync(int userId, Declaration declaration)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return false;

        var userRole = (user.Role ?? "").Trim().ToLowerInvariant();
        var userDirection = (user.Direction ?? "").Trim().ToLowerInvariant();
        var declarationDirection = (declaration.Direction ?? "").Trim().ToLowerInvariant();
        var declarationOwnerRole = (declaration.User.Role ?? "").Trim().ToLowerInvariant();
        var declarationOwnerRegion = (declaration.User.Region ?? "").Trim().ToLowerInvariant();

        // L'admin peut accéder à tout
        if (userRole == "admin")
            return true;

        // L'auteur peut toujours accéder à sa propre déclaration
        if (userId == declaration.UserId)
            return true;

        // Vérification par rôle et direction
        // Pour regionale: userDirection contient le nom de la région (Nord, Sud, Est, Ouest)
        // Pour finance: accès uniquement aux déclarations dont la direction est Siège
        // declarationDirection contient la région de la déclaration (ou "Siège")
        
        if (userRole == "regionale")
        {
            // Un utilisateur régional peut accéder aux déclarations de sa région
            // La région de la déclaration est dans Declaration.Direction
            if (!string.IsNullOrWhiteSpace(userDirection) && 
                (
                    userDirection == declarationDirection
                    || (string.IsNullOrWhiteSpace(declarationDirection)
                        && declarationOwnerRole == "regionale"
                        && declarationOwnerRegion == userDirection)
                ))
            {
                return true;
            }
        }
        else if (userRole == "finance" || userRole == "comptabilite")
        {
            // Finance peut accéder aux déclarations du siège
            if (IsHeadOfficeDirection(declarationDirection)
                || (string.IsNullOrWhiteSpace(declarationDirection)
                    && (declarationOwnerRole == "finance"
                        || declarationOwnerRole == "comptabilite"
                        || declarationOwnerRole == "direction"
                        || declarationOwnerRole == "admin")))
            {
                return true;
            }
        }

        return false;
    }

    private IActionResult BuildTabAccessDeniedResponse(string role, string? tabKey)
    {
        var normalizedRole = (role ?? "").Trim().ToLowerInvariant();
        var roleLabel = normalizedRole switch
        {
            "admin" => "admin",
            "regionale" => "régionale",
            "comptabilite" => "finance",
            "finance" => "finance",
            _ => "inconnu"
        };

        return StatusCode(403, new
        {
            message = $"Le profil {roleLabel} n'est pas autorisé à gérer le tableau '{NormalizeTabKey(tabKey)}'."
        });
    }

    private static bool IsTvaTab(string tabKey) => tabKey is "tva_immo" or "tva_biens";

    private static string NormalizeInvoicePart(string? value) => (value ?? "").Trim().ToUpperInvariant();

    private static string NormalizeMontantHT(string? value)
    {
        var raw = (value ?? "").Trim();
        if (string.IsNullOrWhiteSpace(raw)) return "";
        // Normaliser le montant en supprimant les espaces et en utilisant un point comme séparateur
        var standardized = raw.Replace("\u00A0", "").Replace(" ", "").Replace(",", ".");
        var cleaned = standardized.Replace("/", "");
        return cleaned;
    }

    private static string BuildSupplierKey(TvaInvoiceRow row)
    {
        var supplierId = NormalizeInvoicePart(row.FournisseurId);
        if (!string.IsNullOrWhiteSpace(supplierId)) return $"ID:{supplierId}";

        var supplierName = NormalizeInvoicePart(row.NomRaisonSociale);
        return string.IsNullOrWhiteSpace(supplierName) ? "" : $"NAME:{supplierName}";
    }

    private static string BuildInvoiceComposite(TvaInvoiceRow row)
    {
        var supplierKey = BuildSupplierKey(row);
        var reference = NormalizeInvoicePart(row.NumFacture);
        var montant = NormalizeMontantHT(row.MontantHT);

        if (string.IsNullOrWhiteSpace(supplierKey) || string.IsNullOrWhiteSpace(reference) || string.IsNullOrWhiteSpace(montant))
            return "";

        return $"{supplierKey}|{reference}|{montant}";
    }

    private static string BuildInvoiceLabel(TvaInvoiceRow row)
    {
        var supplier = string.IsNullOrWhiteSpace(row.NomRaisonSociale)
            ? (string.IsNullOrWhiteSpace(row.FournisseurId) ? "—" : row.FournisseurId)
            : row.NomRaisonSociale;

        return $"{supplier} | {row.NumFacture} | {row.MontantHT}";
    }

    private static List<TvaInvoiceRow> ExtractTvaRows(string tabKey, string? dataJson)
    {
        if (string.IsNullOrWhiteSpace(dataJson)) return new List<TvaInvoiceRow>();

        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            if (tabKey == "tva_immo")
            {
                var payload = JsonSerializer.Deserialize<TvaImmoPayload>(dataJson, options);
                return payload?.TvaImmoRows ?? new List<TvaInvoiceRow>();
            }

            if (tabKey == "tva_biens")
            {
                var payload = JsonSerializer.Deserialize<TvaBiensPayload>(dataJson, options);
                return payload?.TvaBiensRows ?? new List<TvaInvoiceRow>();
            }
        }
        catch
        {
            // Ignore malformed legacy JSON payloads and fall back to empty rows.
        }

        return new List<TvaInvoiceRow>();
    }

    private async Task<(bool hasConflict, IActionResult? response)> ValidateDeclarationUniquenessAsync(DeclarationRequest request, int? excludedDeclarationId = null)
    {
        // Vérifier qu'il n'existe pas déjà une déclaration avec le même TabKey, Direction et Mois/Année
        var requestTabKeyLower = (request.TabKey ?? "").Trim().ToLowerInvariant();
        var requestDirLower = (request.Direction ?? "").Trim().ToLowerInvariant();
        var requestMonth = (request.Mois ?? "").Trim();
        var requestYear = (request.Annee ?? "").Trim();
        
        var query = _context.Declarations
            .AsNoTracking()
            .Where(d => (d.TabKey ?? "").Trim().ToLower() == requestTabKeyLower
                && (d.Mois ?? "").Trim() == requestMonth
                && (d.Annee ?? "").Trim() == requestYear
                && (d.Direction ?? "").Trim().ToLower() == requestDirLower);

        if (excludedDeclarationId.HasValue)
            query = query.Where(d => d.Id != excludedDeclarationId.Value);

        var existingDeclaration = await query.FirstOrDefaultAsync();

        if (existingDeclaration != null)
        {
            return (true, Conflict(new
            {
                message = $"Une déclaration existe déjà pour ce tableau ({request.TabKey}), cette direction et cette période ({request.Mois}/{request.Annee}). Veuillez utiliser la déclaration existante ou en supprimer une.",
                conflictingDeclarationId = existingDeclaration.Id,
                isDoubloon = true
            }));
        }

        return (false, null);
    }

    private async Task<(bool hasConflict, IActionResult? response)> ValidateTvaInvoiceUniquenessAsync(DeclarationRequest request, int? excludedDeclarationId = null)
    {
        if (!IsTvaTab(request.TabKey))
            return (false, null);

        var incomingRows = ExtractTvaRows(request.TabKey, request.DataJson);
        if (incomingRows.Count == 0)
            return (false, null);

        // Validate invoice dates are not older than 13 months from the current period
        if (!int.TryParse(request.Mois, out var month) || !int.TryParse(request.Annee, out var year))
            return (false, null);

        var periodDate = new DateTime(year, month, 1);
        var maxAgeDate = periodDate.AddMonths(-13);

        foreach (var row in incomingRows)
        {
            var dateStr = (row.DateFacture ?? "").Trim();
            if (string.IsNullOrWhiteSpace(dateStr)) continue;

            // Extract date part (before 'T' if ISO format)
            var datePart = dateStr.IndexOf('T') > 0 ? dateStr[..dateStr.IndexOf('T')] : dateStr;
            
            if (DateTime.TryParse(datePart, out var invoiceDate))
            {
                if (invoiceDate < maxAgeDate)
                {
                    return (true, Conflict(new
                    {
                        message = $"Facture rejetée: la date de facture ({invoiceDate:yyyy-MM-dd}) est antérieure à {maxAgeDate:MMMM yyyy}. Les factures doivent dater de moins de 13 mois.",
                        invoice = BuildInvoiceLabel(row),
                        limitation = "Factures de moins de 13 mois uniquement"
                    }));
                }
            }
        }

        // Prevent duplicates in the same payload.
        var incomingKeys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in incomingRows)
        {
            var key = BuildInvoiceComposite(row);
            if (string.IsNullOrWhiteSpace(key)) continue;

            if (!incomingKeys.Add(key))
            {
                return (true, Conflict(new
                {
                    message = "Facture en doublon dans la déclaration en cours (même fournisseur, même référence et même montant).",
                    invoice = BuildInvoiceLabel(row)
                }));
            }
        }

        var existingQuery = _context.Declarations
            .AsNoTracking()
            .Where(d => d.TabKey == "tva_immo" || d.TabKey == "tva_biens");

        if (excludedDeclarationId.HasValue)
            existingQuery = existingQuery.Where(d => d.Id != excludedDeclarationId.Value);

        var existingDeclarations = await existingQuery
            .Select(d => new { d.TabKey, d.DataJson })
            .ToListAsync();

        var existingKeys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var declaration in existingDeclarations)
        {
            foreach (var row in ExtractTvaRows(declaration.TabKey, declaration.DataJson))
            {
                var key = BuildInvoiceComposite(row);
                if (!string.IsNullOrWhiteSpace(key))
                    existingKeys.Add(key);
            }
        }

        foreach (var row in incomingRows)
        {
            var key = BuildInvoiceComposite(row);
            if (string.IsNullOrWhiteSpace(key)) continue;

            if (existingKeys.Contains(key))
            {
                return (true, Conflict(new
                {
                    message = "Facture déjà enregistrée dans les tableaux 2/3 (même fournisseur, même référence, même montant), même sur une période différente.",
                    invoice = BuildInvoiceLabel(row)
                }));
            }
        }

        return (false, null);
    }

    // ─── GET api/fiscal/policy ─────────────────────────────────────────────
    // Expose la politique d'accès et la règle de clôture côté backend.
    [HttpGet("policy")]
    public async Task<IActionResult> GetPolicy([FromQuery] string? direction)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        var isTable6Enabled = await IsTable6EnabledAsync();

        var regionalTabKeys = isTable6Enabled
            ? RegionalManageableTabOrder
            : RegionalManageableTabOrder.Where(tab => !string.Equals(tab, "etat_tap", StringComparison.OrdinalIgnoreCase)).ToArray();

        var financeTabKeys = FinanceManageableTabOrder;

        var manageableTabKeys = GetManageableTabsForRoleAndDirection(currentUserRole, direction);

        var disabledTabKeys = isTable6Enabled ? Array.Empty<string>() : new[] { "etat_tap" };

        return Ok(new
        {
            role = currentUserRole,
            requestedDirection = (direction ?? "").Trim(),
            regionalTabKeys,
            financeTabKeys,
            manageableTabKeys,
            disabledTabKeys,
            serverNow = DateTime.UtcNow,
        });
    }

    // ─── GET api/fiscal ───────────────────────────────────────────────────────
    // Retourne toutes les déclarations de l'utilisateur connecté
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? tabKey, [FromQuery] string? mois, [FromQuery] string? annee)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = (currentUserContext.Role ?? "").Trim().ToLowerInvariant();

        IQueryable<Declaration> query = _context.Declarations.AsNoTracking();

        // Le dashboard fiscal est piloté par une portée métier (profil + direction),
        // pas uniquement par l'auteur de la déclaration.
        if (currentUserRole == "admin")
        {
            // Admin voit toutes les déclarations, y compris celles émises par
            // les comptes admin, finance/comptabilite, direction et regionale.
        }
        else if (currentUserRole == "regionale")
        {
            // Les comptes regionale ne voient que leurs propres déclarations.
            query = query.Where(d => d.UserId == userId);
        }
        else if (currentUserRole is "finance" or "comptabilite" or "direction")
        {
            // Les comptes finance/comptabilite/global(direction) voient toutes les déclarations,
            // qu'elles soient approuvées ou non.
        }
        else
        {
            query = query.Where(d => d.UserId == userId);
        }

        if (!string.IsNullOrEmpty(tabKey))
            query = query.Where(d => d.TabKey == tabKey);
        if (!string.IsNullOrEmpty(mois))
            query = query.Where(d => d.Mois == mois);
        if (!string.IsNullOrEmpty(annee))
            query = query.Where(d => d.Annee == annee);

        var declarations = await query
            .OrderByDescending(d => d.UpdatedAt)
            .Select(d => new
            {
                d.Id, d.TabKey, d.Mois, d.Annee, d.Direction,
                d.DataJson, d.CreatedAt, d.UpdatedAt,
                d.UserId,
                d.IsApproved,
                d.ApprovedByUserId,
                d.ApprovedAt
            })
            .ToListAsync();

        return Ok(declarations);
    }

    // ─── GET api/fiscal/{id} ─────────────────────────────────────────────────
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = GetCurrentUserId();
        var decl = await _context.Declarations
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        // Vérifier les permissions d'accès
        if (!await CanUserAccessDeclarationAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez consulter que les déclarations de votre groupe." });

        return Ok(new
        {
            decl.Id, decl.TabKey, decl.Mois, decl.Annee, decl.Direction,
            decl.DataJson, decl.CreatedAt, decl.UpdatedAt,
            decl.UserId,
            decl.IsApproved,
            decl.ApprovedByUserId,
            decl.ApprovedAt
        });
    }

    // ─── POST api/fiscal ─────────────────────────────────────────────────────
    // Crée une nouvelle déclaration
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DeclarationRequest request)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        var targetDirection = ResolveDirectionForRole(currentUserRole, request.Direction, currentUserContext.Direction, currentUserContext.Region);

        if (string.Equals(NormalizeTabKey(request.TabKey), "etat_tap", StringComparison.OrdinalIgnoreCase)
            && !await IsTable6EnabledAsync())
        {
            return Conflict(new
            {
                message = "Le tableau 6 (ETAT TAP) est désactivé par l'administration."
            });
        }

        if (!CanManageTabForRole(currentUserRole, request.TabKey))
            return BuildTabAccessDeniedResponse(currentUserRole, request.TabKey);

        // Vérifier qu'il n'existe pas de doublon (même TabKey, Direction, Mois/Année)
        var uniquenessRequest = new DeclarationRequest
        {
            TabKey = request.TabKey,
            Mois = request.Mois,
            Annee = request.Annee,
            Direction = targetDirection,
            DataJson = request.DataJson,
        };

        var doubloonCheck = await ValidateDeclarationUniquenessAsync(uniquenessRequest);
        if (doubloonCheck.hasConflict && doubloonCheck.response != null)
            return doubloonCheck.response;

        var duplicateCheck = await ValidateTvaInvoiceUniquenessAsync(request);
        if (duplicateCheck.hasConflict && duplicateCheck.response != null)
            return duplicateCheck.response;

        var decl = new Declaration
        {
            UserId    = userId,
            TabKey    = request.TabKey,
            Mois      = request.Mois,
            Annee     = request.Annee,
            Direction = targetDirection,
            DataJson  = request.DataJson ?? "{}",
            IsApproved = false,
            ApprovedByUserId = null,
            ApprovedAt = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _context.Declarations.Add(decl);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "FISCAL_SAVE", "Declaration", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, action = "create" });

        await NotifyFiscalDeclarationChangedAsync("create", decl, userId);

        return CreatedAtAction(nameof(GetById), new { id = decl.Id },
            new { decl.Id, decl.TabKey, decl.Mois, decl.Annee, decl.CreatedAt });
    }

    // ─── PUT api/fiscal/{id} ─────────────────────────────────────────────────
    // Met à jour directement une déclaration existante
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] DeclarationRequest request)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        
        var decl = await _context.Declarations
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        if (string.Equals(NormalizeTabKey(request.TabKey), "etat_tap", StringComparison.OrdinalIgnoreCase)
            && !await IsTable6EnabledAsync())
        {
            return Conflict(new
            {
                message = "Le tableau 6 (ETAT TAP) est désactivé par l'administration."
            });
        }

        // Vérifier les permissions d'accès
        if (!await CanUserAccessDeclarationAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez modifier que les déclarations de votre groupe." });

        var targetDirection = ResolveDirectionForRole(currentUserRole, request.Direction, currentUserContext.Direction, currentUserContext.Region, decl.Direction);

        var uniquenessRequest = new DeclarationRequest
        {
            TabKey = request.TabKey,
            Mois = request.Mois,
            Annee = request.Annee,
            Direction = targetDirection,
            DataJson = request.DataJson,
        };

        // La modification de la même déclaration est autorisée (on exclut son propre id)
        var doubloonCheck = await ValidateDeclarationUniquenessAsync(uniquenessRequest, id);
        if (doubloonCheck.hasConflict && doubloonCheck.response != null)
            return doubloonCheck.response;

        var duplicateCheck = await ValidateTvaInvoiceUniquenessAsync(request, id);
        if (duplicateCheck.hasConflict && duplicateCheck.response != null)
            return duplicateCheck.response;

        decl.TabKey = request.TabKey;
        decl.Mois = request.Mois;
        decl.Annee = request.Annee;
        decl.Direction = targetDirection;
        decl.DataJson = request.DataJson ?? decl.DataJson;
        // Toute modification remet la déclaration en attente d'approbation.
        decl.IsApproved = false;
        decl.ApprovedByUserId = null;
        decl.ApprovedAt = null;
        decl.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "FISCAL_SAVE", "Declaration", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, action = "update", modifiedByUserId = userId });

        await NotifyFiscalDeclarationChangedAsync("update", decl, userId);

        return NoContent();
    }

    // ─── POST api/fiscal/{id}/approve ───────────────────────────────────────
    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = (currentUserContext.Role ?? "").Trim().ToLowerInvariant();

        var canApproveAsAdmin = currentUserRole == "admin";
        var canApproveAsRegional = currentUserRole == "regionale";
        var canApproveAsFinance = currentUserRole == "finance" || currentUserRole == "comptabilite";

        if (!canApproveAsAdmin && !canApproveAsRegional && !canApproveAsFinance)
            return StatusCode(403, new { message = "Ce compte n'a pas le droit d'approbation." });

        var approverRegion = (currentUserContext.Region ?? "").Trim().ToLowerInvariant();
        if (canApproveAsRegional && string.IsNullOrWhiteSpace(approverRegion))
            return BadRequest(new { message = "Le compte approbateur doit être rattaché à une région." });

        var decl = await _context.Declarations
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null)
            return NotFound();

        var isSelfDeclaration = decl.UserId == userId;

        var declarationOwnerRole = (decl.User.Role ?? "").Trim().ToLowerInvariant();
        var declarationOwnerRegion = (decl.User.Region ?? "").Trim().ToLowerInvariant();
        var declarationDirection = (decl.Direction ?? "").Trim().ToLowerInvariant();
        var isSiegeDeclaration = declarationDirection == "siège"
            || declarationDirection == "siege"
            || declarationDirection.Contains("siège")
            || declarationDirection.Contains("siege")
            || (string.IsNullOrWhiteSpace(decl.Direction)
                && (declarationOwnerRole == "finance"
                    || declarationOwnerRole == "comptabilite"
                    || declarationOwnerRole == "direction"
                    || declarationOwnerRole == "admin"));

        if (!canApproveAsAdmin && !isSelfDeclaration && canApproveAsRegional && (declarationOwnerRole != "regionale" || declarationOwnerRegion != approverRegion))
        {
            return StatusCode(403, new
            {
                message = "Vous ne pouvez approuver que les déclarations des utilisateurs de votre région."
            });
        }

        if (!canApproveAsAdmin && !isSelfDeclaration && canApproveAsFinance && !isSiegeDeclaration)
        {
            return StatusCode(403, new
            {
                message = "Vous ne pouvez approuver que les déclarations du niveau Siège."
            });
        }

        if (decl.IsApproved)
        {
            return Ok(new
            {
                message = "Déclaration déjà approuvée.",
                decl.Id,
                decl.IsApproved,
                decl.ApprovedByUserId,
                decl.ApprovedAt
            });
        }

        decl.IsApproved = true;
        decl.ApprovedByUserId = userId;
        decl.ApprovedAt = DateTime.UtcNow;
        decl.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "FISCAL_APPROVE", "Declaration", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, decl.UserId, approverRegion, approverRole = currentUserRole });

        await NotifyFiscalDeclarationChangedAsync("approve", decl, userId);

        return Ok(new
        {
            message = "Déclaration approuvée avec succès.",
            decl.Id,
            decl.IsApproved,
            decl.ApprovedByUserId,
            decl.ApprovedAt
        });
    }

    // ─── DELETE api/fiscal/{id} ──────────────────────────────────────────────
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        
        var decl = await _context.Declarations
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        // Vérifier les permissions d'accès
        if (!await CanUserAccessDeclarationAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez supprimer que les déclarations de votre groupe." });

        var info = new { decl.TabKey, decl.Mois, decl.Annee, deletedByUserId = userId };
        _context.Declarations.Remove(decl);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "FISCAL_DELETE", "Declaration", id, info);

        await NotifyFiscalDeclarationChangedAsync("delete", decl, userId);

        return NoContent();
    }

    // ─── POST api/fiscal/{id}/print ──────────────────────────────────────────
    // Enregistre un événement d'impression dans l'audit (pas de modification des données)
    [HttpPost("{id}/print")]
    public async Task<IActionResult> LogPrint(int id)
    {
        var userId = GetCurrentUserId();
        var decl = await _context.Declarations
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        // Vérifier les permissions d'accès
        if (!await CanUserAccessDeclarationAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez imprimer que les déclarations de votre groupe." });

        await _auditService.LogAction(userId, "FISCAL_PRINT", "Declaration", id,
            new { decl.TabKey, decl.Mois, decl.Annee });

        return Ok(new { message = "Impression enregistrée dans l'audit." });
    }

}

// ─── DTO ─────────────────────────────────────────────────────────────────────
public class DeclarationRequest
{
    public string TabKey    { get; set; } = "";
    public string Mois      { get; set; } = "";
    public string Annee     { get; set; } = "";
    public string? Direction { get; set; }
    public string? DataJson  { get; set; }
}

public sealed class TvaInvoiceRow
{
    public string? FournisseurId { get; set; }
    public string? NomRaisonSociale { get; set; }
    public string? NumFacture { get; set; }
    public string? DateFacture { get; set; }
        public string? MontantHT { get; set; }
}

public sealed class TvaImmoPayload
{
    public List<TvaInvoiceRow> TvaImmoRows { get; set; } = new();
}

public sealed class TvaBiensPayload
{
    public List<TvaInvoiceRow> TvaBiensRows { get; set; } = new();
}

