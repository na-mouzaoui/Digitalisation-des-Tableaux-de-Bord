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
[Route("api/tableau")]
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

    // Liste des 30 tableaux conservés
    private static readonly string[] AllManageableTabOrder =
    {
        "reclamation",
        "reclamation_gp",
        "e_payement_pop",
        "e_payement_prp",
        "total_encaissement",
        "recouvrement",
        "realisation_technique_reseau",
        "situation_reseau",
        "trafic_data",
        "amelioration_qualite",
        "couverture_reseau",
        "action_notable_reseau",
        "disponibilite_reseau",
        "desactivation_resiliation",
        "parc_abonnes_b2b",
        "mttr",
        "creances_contentieuses",
        "frais_personnel",
        "effectif_gsp",
        "absenteisme",
        "mouvement_effectifs",
        "mouvement_effectifs_domaine",
        "compte_resultat",
        "effectifs_formes_gsp",
        "formations_domaines",
        "parc_abonnes_gp",
        "total_parc_abonnes",
        "total_parc_abonnes_technologie",
        "activation",
        "chiffre_affaires_mda"
    };

    private static readonly HashSet<string> AllManageableTabs = new(AllManageableTabOrder, StringComparer.OrdinalIgnoreCase);

    private static string NormalizeTabKey(string? tabKey) => (tabKey ?? "").Trim().ToLowerInvariant();

    private static string[] ParseDisabledTabKeys(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return Array.Empty<string>();

        try
        {
            var parsed = JsonSerializer.Deserialize<List<string>>(raw) ?? new List<string>();
            return parsed
                .Select(NormalizeTabKey)
                .Where(key => !string.IsNullOrWhiteSpace(key))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    private static bool CanManageTabForRole(string role, string? tabKey)
    {
        var normalizedRole = (role ?? "").Trim().ToLowerInvariant();
        var normalizedTabKey = NormalizeTabKey(tabKey);

        if (string.IsNullOrWhiteSpace(normalizedTabKey)) return false;

        if (normalizedRole == "admin")
            return true;

        return AllManageableTabs.Contains(normalizedTabKey);
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
            return AllManageableTabOrder;

        return AllManageableTabOrder;
    }

    private static string[] GetManageableTabsForRoleAndDirection(string role, string? direction)
    {
        return GetManageableTabsForRole(role);
    }

    /// <summary>
    /// Vérifie si l'utilisateur courant peut accéder à un tableau pour la modifier/consulter/supprimer
    /// basée sur sa direction et son rôle, indépendamment de qui l'a créée.
    /// </summary>
    private async Task<bool> CanUserAccessTableauAsync(int userId, Tableau tableau)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return false;

        var userRole = (user.Role ?? "").Trim().ToLowerInvariant();
        var userDirection = (user.Direction ?? "").Trim().ToLowerInvariant();
        var tableauDirection = (tableau.Direction ?? "").Trim().ToLowerInvariant();
        var tableauOwnerRole = (tableau.User.Role ?? "").Trim().ToLowerInvariant();
        var tableauOwnerRegion = (tableau.User.Region ?? "").Trim().ToLowerInvariant();

        // L'admin peut accéder à tout
        if (userRole == "admin")
            return true;

        // L'auteur peut toujours accéder à son propre tableau
        if (userId == tableau.UserId)
            return true;

        // Vérification par rôle et direction
        if (userRole == "regionale")
        {
            // Un utilisateur régional peut accéder aux tableaux de sa région
            if (!string.IsNullOrWhiteSpace(userDirection) && 
                (
                    userDirection == tableauDirection
                    || (string.IsNullOrWhiteSpace(tableauDirection)
                        && tableauOwnerRole == "regionale"
                        && tableauOwnerRegion == userDirection)
                ))
            {
                return true;
            }
        }
        else if (userRole == "finance" || userRole == "comptabilite")
        {
            // Finance peut accéder aux tableaux du siège
            if (IsHeadOfficeDirection(tableauDirection)
                || (string.IsNullOrWhiteSpace(tableauDirection)
                    && (tableauOwnerRole == "finance"
                        || tableauOwnerRole == "comptabilite"
                        || tableauOwnerRole == "direction"
                        || tableauOwnerRole == "admin")))
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

    private async Task<(bool hasConflict, IActionResult? response)> ValidateTableauUniquenessAsync(TableauRequest request, int? excludedTableauId = null)
    {
        // Vérifier qu'il n'existe pas déjà un tableau avec le même TabKey, Direction et Mois/Année
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
                message = $"Un tableau existe déjà pour ce tableau ({request.TabKey}), cette direction et cette période ({request.Mois}/{request.Annee}). Veuillez utiliser le tableau existant ou en supprimer un.",
                conflictingTableauId = existingTableau.Id,
                isDoubloon = true
            }));
        }

        return (false, null);
    }

    // ─── GET api/tableau/policy ─────────────────────────────────────────────
    [HttpGet("policy")]
    public async Task<IActionResult> GetPolicy([FromQuery] string? direction)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        var setting = await _context.AdminSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == 1);

        var manageableTabKeys = GetManageableTabsForRoleAndDirection(currentUserRole, direction);
        var disabledTabKeys = ParseDisabledTabKeys(setting?.DisabledTabKeysJson);

        return Ok(new
        {
            role = currentUserRole,
            requestedDirection = (direction ?? "").Trim(),
            manageableTabKeys,
            disabledTabKeys,
            serverNow = DateTime.UtcNow,
        });
    }

    // ─── GET api/tableau ───────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? tabKey, [FromQuery] string? mois, [FromQuery] string? annee)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = (currentUserContext.Role ?? "").Trim().ToLowerInvariant();

        IQueryable<Tableau> query = _context.Tableaus.AsNoTracking();

        if (currentUserRole == "admin")
        {
            // Admin voit tous les tableaux
        }
        else if (currentUserRole == "regionale")
        {
            // Les comptes regionale ne voient que leurs propres tableaux
            query = query.Where(d => d.UserId == userId);
        }
        else if (currentUserRole is "finance" or "comptabilite" or "direction")
        {
            // Les comptes finance/comptabilite/global(direction) voient tous les tableaux
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

        var tableaus = await query
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

        return Ok(tableaus);
    }

    // ─── GET api/tableau/{id} ─────────────────────────────────────────────────
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = GetCurrentUserId();
        var decl = await _context.Tableaus
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        if (!await CanUserAccessTableauAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez consulter que les tableaux de votre groupe." });

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

    // ─── POST api/tableau ─────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TableauRequest request)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        var targetDirection = ResolveDirectionForRole(currentUserRole, request.Direction, currentUserContext.Direction, currentUserContext.Region);

        if (!CanManageTabForRole(currentUserRole, request.TabKey))
            return BuildTabAccessDeniedResponse(currentUserRole, request.TabKey);

        // Vérifier qu'il n'existe pas de doublon
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

        await _auditService.LogAction(userId, "tableau_SAVE", "Tableau", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, action = "create" });

        await NotifyTableauChangedAsync("create", decl, userId);

        return CreatedAtAction(nameof(GetById), new { id = decl.Id },
            new { decl.Id, decl.TabKey, decl.Mois, decl.Annee, decl.CreatedAt });
    }

    // ─── PUT api/tableau/{id} ─────────────────────────────────────────────────
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

        if (!await CanUserAccessTableauAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez modifier que les tableaux de votre groupe." });

        var targetDirection = ResolveDirectionForRole(currentUserRole, request.Direction, currentUserContext.Direction, currentUserContext.Region, decl.Direction);

        var uniquenessRequest = new TableauRequest
        {
            TabKey = request.TabKey,
            Mois = request.Mois,
            Annee = request.Annee,
            Direction = targetDirection,
            DataJson = request.DataJson,
        };

        // La modification du même tableau est autorisée (on exclut son propre id)
        var doubloonCheck = await ValidateTableauUniquenessAsync(uniquenessRequest, id);
        if (doubloonCheck.hasConflict && doubloonCheck.response != null)
            return doubloonCheck.response;

        decl.TabKey = request.TabKey;
        decl.Mois = request.Mois;
        decl.Annee = request.Annee;
        decl.Direction = targetDirection;
        decl.DataJson = request.DataJson ?? decl.DataJson;
        decl.IsApproved = false;
        decl.ApprovedByUserId = null;
        decl.ApprovedAt = null;
        decl.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "tableau_SAVE", "Tableau", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, action = "update", modifiedByUserId = userId });

        await NotifyTableauChangedAsync("update", decl, userId);

        return NoContent();
    }

    // ─── POST api/tableau/{id}/approve ───────────────────────────────────────
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

        var tableauOwnerRole = (decl.User.Role ?? "").Trim().ToLowerInvariant();
        var tableauOwnerRegion = (decl.User.Region ?? "").Trim().ToLowerInvariant();
        var tableauDirection = (decl.Direction ?? "").Trim().ToLowerInvariant();
        var isSiegeTableau = tableauDirection == "siège"
            || tableauDirection == "siege"
            || tableauDirection.Contains("siège")
            || tableauDirection.Contains("siege")
            || (string.IsNullOrWhiteSpace(decl.Direction)
                && (tableauOwnerRole == "finance"
                    || tableauOwnerRole == "comptabilite"
                    || tableauOwnerRole == "direction"
                    || tableauOwnerRole == "admin"));

        if (!canApproveAsAdmin && !isSelfTableau && canApproveAsRegional && (tableauOwnerRole != "regionale" || tableauOwnerRegion != approverRegion))
        {
            return StatusCode(403, new
            {
                message = "Vous ne pouvez approuver que les tableaux des utilisateurs de votre région."
            });
        }

        if (!canApproveAsAdmin && !isSelfTableau && canApproveAsFinance && !isSiegeTableau)
        {
            return StatusCode(403, new
            {
                message = "Vous ne pouvez approuver que les tableaux du niveau Siège."
            });
        }

        if (decl.IsApproved)
        {
            return Ok(new
            {
                message = "Tableau déjà approuvé.",
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

        await _auditService.LogAction(userId, "tableau_APPROVE", "Tableau", decl.Id,
            new { decl.TabKey, decl.Mois, decl.Annee, decl.UserId, approverRegion, approverRole = currentUserRole });

        await NotifyTableauChangedAsync("approve", decl, userId);

        return Ok(new
        {
            message = "Tableau approuvé avec succès.",
            decl.Id,
            decl.IsApproved,
            decl.ApprovedByUserId,
            decl.ApprovedAt
        });
    }

    // ─── DELETE api/tableau/{id} ──────────────────────────────────────────────
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

        if (!await CanUserAccessTableauAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez supprimer que les tableaux de votre groupe." });

        var info = new { decl.TabKey, decl.Mois, decl.Annee, deletedByUserId = userId };
        _context.Tableaus.Remove(decl);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "tableau_DELETE", "Tableau", id, info);

        await NotifyTableauChangedAsync("delete", decl, userId);

        return NoContent();
    }

    // ─── POST api/tableau/{id}/print ──────────────────────────────────────────
    [HttpPost("{id}/print")]
    public async Task<IActionResult> LogPrint(int id)
    {
        var userId = GetCurrentUserId();
        var decl = await _context.Tableaus
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decl == null) return NotFound();

        if (!await CanUserAccessTableauAsync(userId, decl))
            return StatusCode(403, new { message = "Accès refusé. Vous ne pouvez imprimer que les tableaux de votre groupe." });

        await _auditService.LogAction(userId, "tableau_PRINT", "Tableau", id,
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