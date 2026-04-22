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
[Route("api/tableu")]
[Authorize]
public class TableauController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    private readonly IHubContext<CheckUpdatesHub> _hubContext;

    public TableauController(AppDbContext context, IAuditService auditService, IHubContext<CheckUpdatesHub> hubContext)
    {
        _context = context;
        _auditService = auditService;
        _hubContext = hubContext;
    }

    private async Task NotifyTableauChangedAsync(string action, Tableau tableau, int changedByUserId)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("tableauChanged", new
            {
                action,
                tableauId = tableau.Id,
                tableau.TabKey,
                tableau.Mois,
                tableau.Annee,
                tableau.Direction,
                tableau.UpdatedAt,
                changedByUserId,
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"SignalR tableauChanged failed: {ex.Message}");
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
        var setting = await _context.AdminSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1);

        return true; // Table6 toujours activée maintenant
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
    /// Vérifie si l'utilisateur courant peut accéder à un tableu pour la modifier/consulter/supprimer
    /// basée sur sa direction et son rôle, indépendamment de qui l'a créée.
    /// </summary>
    private async Task<bool> CanUserAccessTableauAsync(int userId, Tableau Tableau)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return false;

        var userRole = (user.Role ?? "").Trim().ToLowerInvariant();
        var userDirection = (user.Direction ?? "").Trim().ToLowerInvariant();
        var TableauDirection = (Tableau.Direction ?? "").Trim().ToLowerInvariant();
        var TableauOwnerRole = (Tableau.User.Role ?? "").Trim().ToLowerInvariant();
        var TableauOwnerRegion = (Tableau.User.Region ?? "").Trim().ToLowerInvariant();

        // L'admin peut accéder à tout
        if (userRole == "admin")
            return true;

        // L'auteur peut toujours accéder à son propre tableu
        if (userId == Tableau.UserId)
            return true;

        // Vérification par rôle et direction
        // Pour regionale: userDirection contient le nom de la région (Nord, Sud, Est, Ouest)
        // Pour finance: accès uniquement aux tableux dont la direction est Siège
        // TableauDirection contient la région du tableu (ou "Siège")
        
        if (userRole == "regionale")
        {
            // Un utilisateur régional peut accéder aux tableux de sa région
            // La région du tableu est dans Tableau.Direction
            if (!string.IsNullOrWhiteSpace(userDirection) && 
                (
                    userDirection == TableauDirection
                    || (string.IsNullOrWhiteSpace(TableauDirection)
                        && TableauOwnerRole == "regionale"
                        && TableauOwnerRegion == userDirection)
                ))
            {
                return true;
            }
        }
        else if (userRole == "finance" || userRole == "comptabilite")
        {
            // Finance peut accéder aux tableux du siège
            if (IsHeadOfficeDirection(TableauDirection)
                || (string.IsNullOrWhiteSpace(TableauDirection)
                    && (TableauOwnerRole == "finance"
                        || TableauOwnerRole == "comptabilite"
                        || TableauOwnerRole == "direction"
                        || TableauOwnerRole == "admin")))
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

    private async Task<(bool hasConflict, IActionResult? response)> ValidateTableauUniquenessAsync(TableauRequest request, int? excludedTableauId = null)
    {
        // Vérifier qu'il n'existe pas déjà un tableu avec le même TabKey, Direction et Mois/Année
        var requestTabKeyLower = (request.TabKey ?? "").Trim().ToLowerInvariant();
        var requestDirLower = (request.Direction ?? "").Trim().ToLowerInvariant();
        var requestMonth = (request.Mois ?? "").Trim();
        var requestYear = (request.Annee ?? "").Trim();
        
        var query = _context.Tableaus
            .AsNoTracking()
            .Where(d => (d.TabKey ?? "").Trim().ToLower() == requestTabKeyLower
                && (d.Mois ?? "").Trim() == requestMonth
                && (d.Annee ?? "").Trim() == requestYear
                && (d.Direction ?? "").Trim().ToLower() == requestDirLower);

        if (excludedTableauId.HasValue)
            query = query.Where(d => d.Id != excludedTableauId.Value);

        var existingTableau = await query.FirstOrDefaultAsync();

        if (existingTableau != null)
        {
            return (true, Conflict(new
            {
                message = $"Un tableu existe déjà pour ce tableau ({request.TabKey}), cette direction et cette période ({request.Mois}/{request.Annee}). Veuillez utiliser le tableu existant ou en supprimer un.",
                conflictingTableauId = existingTableau.Id,
                isDoubloon = true
            }));
        }

        return (false, null);
    }

    private async Task<(bool hasConflict, IActionResult? response)> ValidateTvaInvoiceUniquenessAsync(TableauRequest request, int? excludedTableauId = null)
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
                    message = "Facture en doublon dans le tableu en cours (même fournisseur, même référence et même montant).",
                    invoice = BuildInvoiceLabel(row)
                }));
            }
        }

        var existingQuery = _context.Tableaus
            .AsNoTracking()
            .Where(d => d.TabKey == "tva_immo" || d.TabKey == "tva_biens");

        if (excludedTableauId.HasValue)
            existingQuery = existingQuery.Where(d => d.Id != excludedTableauId.Value);

        var existingTableaus = await existingQuery
            .Select(d => new { d.TabKey, d.DataJson })
            .ToListAsync();

        var existingKeys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var Tableau in existingTableaus)
        {
            foreach (var row in ExtractTvaRows(Tableau.TabKey, Tableau.DataJson))
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

    // ─── GET api/tableu/policy ─────────────────────────────────────────────
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

    // ─── GET api/tableu ───────────────────────────────────────────────────────
    // Retourne tous les tableux de l'utilisateur connecté
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? tabKey, [FromQuery] string? mois, [FromQuery] string? annee)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = (currentUserContext.Role ?? "").Trim().ToLowerInvariant();

        IQueryable<Tableau> query = _context.Tableaus.AsNoTracking();

        // Le dashboard tableu est piloté par une portée métier (profil + direction),
        // pas uniquement par l'auteur du tableu.
        if (currentUserRole == "admin")
        {
            // Admin voit tous les tableux, y compris ceux émis par
            // les comptes admin, finance/comptabilite, direction et regionale.
        }
        else if (currentUserRole == "regionale")
        {
            // Les comptes regionale ne voient que leurs propres tableux.
            query = query.Where(d => d.UserId == userId);
        }
        else if (currentUserRole is "finance" or "comptabilite" or "direction")
        {
            // Les comptes finance/comptabilite/global(direction) voient tous les tableux,
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

        var Tableaus = await query
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

        return Ok(Tableaus);
    }

    // ─── GET api/tableu/{id} ─────────────────────────────────────────────────
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = GetCurrentUserId();
        var decl = await _context.Tableaus
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        // Vérifier les permissions d'accès
        if (!await CanUserAccessTableauAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez consulter que les tableux de votre groupe." });

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

    // ─── POST api/tableu ─────────────────────────────────────────────────────
    // Crée un nouveau tableu
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TableauRequest request)
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
        var uniquenessRequest = new TableauRequest
        {
            TabKey = request.TabKey,
            Mois = request.Mois,
            Annee = request.Annee,
            Direction = targetDirection,
            DataJson = request.DataJson,
        };

        var doubloonCheck = await ValidateTableauUniquenessAsync(uniquenessRequest);
        if (doubloonCheck.hasConflict && doubloonCheck.response != null)
            return doubloonCheck.response;

        var duplicateCheck = await ValidateTvaInvoiceUniquenessAsync(request);
        if (duplicateCheck.hasConflict && duplicateCheck.response != null)
            return duplicateCheck.response;

        var decl = new Tableau
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

        _context.Tableaus.Add(decl);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "TABLEU_SAVE", "Tableau", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, action = "create" });

        await NotifyTableauChangedAsync("create", decl, userId);

        return CreatedAtAction(nameof(GetById), new { id = decl.Id },
            new { decl.Id, decl.TabKey, decl.Mois, decl.Annee, decl.CreatedAt });
    }

    // ─── PUT api/tableu/{id} ─────────────────────────────────────────────────
    // Met à jour directement un tableu existant
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] TableauRequest request)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        
        var decl = await _context.Tableaus
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
        if (!await CanUserAccessTableauAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez modifier que les tableux de votre groupe." });

        var targetDirection = ResolveDirectionForRole(currentUserRole, request.Direction, currentUserContext.Direction, currentUserContext.Region, decl.Direction);

        var uniquenessRequest = new TableauRequest
        {
            TabKey = request.TabKey,
            Mois = request.Mois,
            Annee = request.Annee,
            Direction = targetDirection,
            DataJson = request.DataJson,
        };

        // La modification du même tableu est autorisée (on exclut son propre id)
        var doubloonCheck = await ValidateTableauUniquenessAsync(uniquenessRequest, id);
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
        // Toute modification remet le tableu en attente d'approbation.
        decl.IsApproved = false;
        decl.ApprovedByUserId = null;
        decl.ApprovedAt = null;
        decl.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "TABLEU_SAVE", "Tableau", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, action = "update", modifiedByUserId = userId });

        await NotifyTableauChangedAsync("update", decl, userId);

        return NoContent();
    }

    // ─── POST api/tableu/{id}/approve ───────────────────────────────────────
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

        var decl = await _context.Tableaus
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null)
            return NotFound();

        var isSelfTableau = decl.UserId == userId;

        var TableauOwnerRole = (decl.User.Role ?? "").Trim().ToLowerInvariant();
        var TableauOwnerRegion = (decl.User.Region ?? "").Trim().ToLowerInvariant();
        var TableauDirection = (decl.Direction ?? "").Trim().ToLowerInvariant();
        var isSiegeTableau = TableauDirection == "siège"
            || TableauDirection == "siege"
            || TableauDirection.Contains("siège")
            || TableauDirection.Contains("siege")
            || (string.IsNullOrWhiteSpace(decl.Direction)
                && (TableauOwnerRole == "finance"
                    || TableauOwnerRole == "comptabilite"
                    || TableauOwnerRole == "direction"
                    || TableauOwnerRole == "admin"));

        if (!canApproveAsAdmin && !isSelfTableau && canApproveAsRegional && (TableauOwnerRole != "regionale" || TableauOwnerRegion != approverRegion))
        {
            return StatusCode(403, new
            {
                message = "Vous ne pouvez approuver que les tableux des utilisateurs de votre région."
            });
        }

        if (!canApproveAsAdmin && !isSelfTableau && canApproveAsFinance && !isSiegeTableau)
        {
            return StatusCode(403, new
            {
                message = "Vous ne pouvez approuver que les tableux du niveau Siège."
            });
        }

        if (decl.IsApproved)
        {
            return Ok(new
            {
                message = "Tableu déjà approuvé.",
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

        await _auditService.LogAction(userId, "TABLEU_APPROVE", "Tableau", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, decl.UserId, approverRegion, approverRole = currentUserRole });

        await NotifyTableauChangedAsync("approve", decl, userId);

        return Ok(new
        {
            message = "Tableu approuvé avec succès.",
            decl.Id,
            decl.IsApproved,
            decl.ApprovedByUserId,
            decl.ApprovedAt
        });
    }

    // ─── DELETE api/tableu/{id} ──────────────────────────────────────────────
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        
        var decl = await _context.Tableaus
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        // Vérifier les permissions d'accès
        if (!await CanUserAccessTableauAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez supprimer que les tableux de votre groupe." });

        var info = new { decl.TabKey, decl.Mois, decl.Annee, deletedByUserId = userId };
        _context.Tableaus.Remove(decl);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "TABLEU_DELETE", "Tableau", id, info);

        await NotifyTableauChangedAsync("delete", decl, userId);

        return NoContent();
    }

    // ─── POST api/tableu/{id}/print ──────────────────────────────────────────
    // Enregistre un événement d'impression dans l'audit (pas de modification des données)
    [HttpPost("{id}/print")]
    public async Task<IActionResult> LogPrint(int id)
    {
        var userId = GetCurrentUserId();
        var decl = await _context.Tableaus
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        // Vérifier les permissions d'accès
        if (!await CanUserAccessTableauAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez imprimer que les tableux de votre groupe." });

        await _auditService.LogAction(userId, "TABLEU_PRINT", "Tableau", id,
            new { decl.TabKey, decl.Mois, decl.Annee });

        return Ok(new { message = "Impression enregistrée dans l'audit." });
    }

}

// ─── DTO ─────────────────────────────────────────────────────────────────────
public class TableauRequest
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

