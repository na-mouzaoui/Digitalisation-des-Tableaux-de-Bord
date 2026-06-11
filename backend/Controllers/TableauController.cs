using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DigitalisationDesTableauxDeBordAPI.Data;
using DigitalisationDesTableauxDeBordAPI.Models;
using DigitalisationDesTableauxDeBordAPI.RealTime;
using DigitalisationDesTableauxDeBordAPI.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Globalization;

namespace DigitalisationDesTableauxDeBordAPI.Controllers;

[ApiController]
[Route("api/tableau")]
[Route("api/fiscal")]
[Authorize]
public class TableauController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    private readonly IHubContext<CheckUpdatesHub> _hubContext;
    private readonly INormalizedTableauPersistenceService _normalizedPersistenceService;

    public TableauController(
        AppDbContext context,
        IAuditService auditService,
        IHubContext<CheckUpdatesHub> hubContext,
        INormalizedTableauPersistenceService normalizedPersistenceService)
    {
        _context = context;
        _auditService = auditService;
        _hubContext = hubContext;
        _normalizedPersistenceService = normalizedPersistenceService;
    }

    private async Task NotifyTableauChangedAsync(string action, string tabKey, string mois, string annee, string direction, int changedByUserId)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("tableauChanged", new
            {
                action,
                tabKey,
                mois,
                annee,
                direction,
                updatedAt = DateTime.UtcNow,
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

        if (normalizedRole is "utilisateur")
            return "Siége";

        if (normalizedRole == "divisionnaire")
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

    private static readonly string[] AllManageableTabOrder =
    {
        "reclamation", "e_payement", "total_encaissement", "rechargement",
        "recouvrement", "suivi_infrastructures_reseau", "situation_reseau", "trafic_data",
        "action_notable_reseau", "amelioration_qualite_4g", "amelioration_qualite_5g",
        "disponibilite_reseau", "mttr", "impact_mttr", "creances_contentieuses",
        "creances_contentieuses_anterieur", "frais_personnel", "effectif_gsp",
        "absenteisme", "mouvement_effectifs", "mouvement_effectifs_domaine",
        "compte_resultat", "investissement", "avancement_engagement", "tresorerie",
        "effectifs_formes_gsp", "formations_domaines", "parc_abonnes_gp",
        "total_parc_abonnes_technologie", "activation", "desactivation", "resiliation",
        "chiffre_affaires_mda", "reseau_distribution"
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
        if (normalizedRole == "admin") return true;
        return AllManageableTabs.Contains(normalizedTabKey);
    }

    private static bool IsHeadOfficeDirection(string? direction)
    {
        var normalizedDirection = (direction ?? "").Trim().ToLowerInvariant();
        return normalizedDirection is "siege" or "siége"
            || normalizedDirection.Contains("siege")
            || normalizedDirection.Contains("siége");
    }

    private static string[] GetManageableTabsForRole(string role)
    {
        return AllManageableTabOrder;
    }

    private async Task<int> GetPeriodIdAsync(string? mois, string? annee)
    {
        var m = int.TryParse((mois ?? "").Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var mv) ? mv : 0;
        var y = int.TryParse((annee ?? "").Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var av) ? av : 0;
        if (m == 0 || y == 0) return 0;
        return await _context.Database.SqlQuery<int>(
            $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Periode] WHERE [Mois] = {m} AND [Annee] = {y} ORDER BY [Id]")
            .FirstOrDefaultAsync();
    }

    [HttpGet("policy")]
    public async Task<IActionResult> GetPolicy([FromQuery] string? direction)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        var setting = await _context.AdminSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == 1);

        var manageableTabKeys = GetManageableTabsForRole(currentUserRole);
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

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? tabKey, [FromQuery] string? mois, [FromQuery] string? annee)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = (currentUserContext.Role ?? "").Trim().ToLowerInvariant();

        var query = _context.Valeurs
            .Include(v => v.SousKpi).ThenInclude(sk => sk.Kpi)
            .Include(v => v.User)
            .AsNoTracking();

        if (currentUserRole != "admin")
            query = query.Where(v => v.UserId == userId);

        if (!string.IsNullOrEmpty(tabKey))
            query = query.Where(v => v.SousKpi.Kpi.Nom == NormalizeTabKey(tabKey));

        var periodId = await GetPeriodIdAsync(mois, annee);
        if (periodId > 0)
            query = query.Where(v => v.Id_Periode == periodId);

        var rows = await query.OrderBy(v => v.SousKpi.Kpi.Nom).ThenBy(v => v.User.Direction).ToListAsync();

        var periodIds = rows.Select(r => r.Id_Periode).Distinct().ToList();
        var periodeMois = new Dictionary<int, int>();
        var periodeAnnee = new Dictionary<int, int>();
        foreach (var pid in periodIds)
        {
            var m = await _context.Database.SqlQuery<int>($"SELECT [Mois] AS [Value] FROM [dbo].[Periode] WHERE [Id] = {pid}").FirstOrDefaultAsync();
            var y = await _context.Database.SqlQuery<int>($"SELECT [Annee] AS [Value] FROM [dbo].[Periode] WHERE [Id] = {pid}").FirstOrDefaultAsync();
            periodeMois[pid] = m;
            periodeAnnee[pid] = y;
        }

        var submissions = rows
            .GroupBy(v => new
            {
                v.SousKpi.Kpi.Nom,
                v.UserId,
                Direction = v.User.Direction,
                v.Id_Periode,
            })
            .Select(g =>
            {
                var latest = g.OrderByDescending(x => x.CreatedAt).First();
                var isApproved = latest.ApprovedByDirecteurUserId.HasValue && latest.ApprovedByDivisionnaireUserId.HasValue;

                var dataJson = latest.DataJson ?? ReconstructDataJson(g.Key.Nom, g.ToList());
                var hasPeriode = periodeMois.TryGetValue(g.Key.Id_Periode, out var pMois) & periodeAnnee.TryGetValue(g.Key.Id_Periode, out var pAnnee);

                return new
                {
                    id = HashCode.Combine(g.Key.Nom, g.Key.UserId, g.Key.Id_Periode, latest.CreatedAt.Ticks),
                    tabKey = g.Key.Nom,
                    userId = g.Key.UserId,
                    direction = g.Key.Direction,
                    mois = hasPeriode ? pMois.ToString("00") : "",
                    annee = hasPeriode ? pAnnee.ToString() : "",
                    isApproved,
                    approvedByUserId = latest.ApprovedByUserId,
                    approvedAt = (DateTime?)null,
                    approvedByDirecteurUserId = latest.ApprovedByDirecteurUserId,
                    approvedByDirecteurAt = (DateTime?)null,
                    approvedByDivisionnaireUserId = latest.ApprovedByDivisionnaireUserId,
                    approvedByDivisionnaireAt = (DateTime?)null,
                    createdAt = latest.CreatedAt,
                    dataJson
                };
            })
            .ToList();

        return Ok(submissions.OrderByDescending(s => s.createdAt).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveValeursRequest request)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;
        var targetDirection = ResolveDirectionForRole(currentUserRole, request.Direction, currentUserContext.Direction, currentUserContext.Region);

        if (!CanManageTabForRole(currentUserRole, request.TabKey))
            return StatusCode(403, new { message = $"Le profil {currentUserRole} n'est pas autorisé à gérer le tableau '{NormalizeTabKey(request.TabKey)}'." });

        var (kpiId, exists) = await GetKpiIdByTabKeyAsync(request.TabKey);
        if (!exists)
            return BadRequest(new { message = $"Le tableau '{request.TabKey}' n'existe pas dans la hiérarchie KPI." });

        if ((request.Rows == null || request.Rows.Count == 0) && !string.IsNullOrWhiteSpace(request.DataJson))
            request.Rows = ParseDataJsonToRows(request.DataJson, request.TabKey);

        try
        {
            await _normalizedPersistenceService.PersistAsync(request, userId, targetDirection);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Erreur lors de la sauvegarde: {ex.Message}" });
        }

        await _auditService.LogAction(userId, "tableau_SAVE", "Valeurs", 0,
            new { request.TabKey, request.Mois, request.Annee, action = "save" });

        await NotifyTableauChangedAsync("save", request.TabKey, request.Mois, request.Annee, targetDirection, userId);

        return Ok(new
        {
            message = "Tableau sauvegardé avec succès.",
            request.TabKey,
            request.Mois,
            request.Annee,
            direction = targetDirection,
        });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] string tabKey, [FromQuery] string mois, [FromQuery] string annee, [FromQuery] string direction)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = currentUserContext.Role;

        if (!CanManageTabForRole(currentUserRole, tabKey))
            return StatusCode(403, new { message = "Accès refusé." });

        var targetDirection = ResolveDirectionForRole(currentUserRole, direction, currentUserContext.Direction, currentUserContext.Region);

        try
        {
            await _normalizedPersistenceService.DeleteValeursAsync(tabKey, mois, annee, targetDirection);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Erreur lors de la suppression: {ex.Message}" });
        }

        await _auditService.LogAction(userId, "tableau_DELETE", "Valeurs", 0,
            new { tabKey, mois, annee, deletedByUserId = userId });

        await NotifyTableauChangedAsync("delete", tabKey, mois, annee, targetDirection, userId);

        return NoContent();
    }

    [HttpPost("approve")]
    public async Task<IActionResult> Approve([FromBody] ApproveRequest request)
    {
        var userId = GetCurrentUserId();
        var currentUserContext = await GetCurrentUserContextAsync(userId);
        var currentUserRole = (currentUserContext.Role ?? "").Trim().ToLowerInvariant();

        var isDirecteur = currentUserRole == "directeur" || currentUserRole == "admin";
        var isDivisionnaire = currentUserRole == "divisionnaire";

        if (!isDirecteur && !isDivisionnaire)
            return StatusCode(403, new { message = "Seuls les directeurs et divisionnaires peuvent approuver." });

        var normalizedTabKey = NormalizeTabKey(request.TabKey);
        var targetDirection = ResolveDirectionForRole(currentUserRole, request.Direction, currentUserContext.Direction, currentUserContext.Region);

        var periodId = await GetPeriodIdAsync(request.Mois, request.Annee);
        if (periodId == 0)
            return NotFound(new { message = "Période non trouvée." });

        var valeurs = await _context.Valeurs
            .Include(v => v.User)
            .Where(v => v.SousKpi.Kpi.Nom == normalizedTabKey
                && v.Id_Periode == periodId
                && v.User.Direction == targetDirection)
            .ToListAsync();

        if (valeurs.Count == 0)
            return NotFound(new { message = "Aucune donnée trouvée pour ce tableau." });

        var now = DateTime.UtcNow;
        string approverLabel;

        if (isDirecteur)
        {
            if (valeurs.Any(v => v.ApprovedByDirecteurUserId.HasValue))
                return Ok(new { message = "Déjà approuvé par le directeur.", status = GetApprovalStatus(valeurs) });

            foreach (var v in valeurs)
                v.ApprovedByDirecteurUserId = userId;

            approverLabel = "directeur";
        }
        else
        {
            if (valeurs.Any(v => v.ApprovedByDivisionnaireUserId.HasValue))
                return Ok(new { message = "Déjà approuvé par le divisionnaire.", status = GetApprovalStatus(valeurs) });

            foreach (var v in valeurs)
                v.ApprovedByDivisionnaireUserId = userId;

            approverLabel = "divisionnaire";
        }

        var bothApproved = valeurs.All(v => v.ApprovedByDirecteurUserId.HasValue) && valeurs.All(v => v.ApprovedByDivisionnaireUserId.HasValue);
        foreach (var v in valeurs)
        {
            if (bothApproved)
                v.ApprovedByUserId = userId;
            v.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "tableau_APPROVE", "Valeurs", 0,
            new { tabKey = normalizedTabKey, request.Mois, request.Annee, approverRole = currentUserRole });

        await NotifyTableauChangedAsync("approve", normalizedTabKey, request.Mois, request.Annee, targetDirection, userId);

        var first = valeurs.First();
        return Ok(new
        {
            message = $"{approverLabel} approuvé avec succès.",
            isApproved = bothApproved,
            approvedByUserId = first.ApprovedByUserId,
            approvedByDirecteurUserId = first.ApprovedByDirecteurUserId,
            approvedByDivisionnaireUserId = first.ApprovedByDivisionnaireUserId,
            status = GetApprovalStatus(valeurs)
        });
    }

    private static string GetApprovalStatus(List<Valeur> valeurs)
    {
        var directeurOk = valeurs.All(v => v.ApprovedByDirecteurUserId.HasValue);
        var divisionnaireOk = valeurs.All(v => v.ApprovedByDivisionnaireUserId.HasValue);
        if (directeurOk && divisionnaireOk) return "valide";
        if (directeurOk) return "approuve_directeur";
        if (divisionnaireOk) return "approuve_divisionnaire";
        return "en_attente";
    }

    [HttpPost("print")]
    public async Task<IActionResult> LogPrint([FromQuery] string tabKey, [FromQuery] string mois, [FromQuery] string annee, [FromQuery] string direction)
    {
        var userId = GetCurrentUserId();
        var ctx = await GetCurrentUserContextAsync(userId);
        var targetDirection = ResolveDirectionForRole(ctx.Role, direction, ctx.Direction, ctx.Region);

        await _auditService.LogAction(userId, "tableau_PRINT", "Valeurs", 0,
            new { tabKey = NormalizeTabKey(tabKey), mois, annee });

        return Ok(new { message = "Impression enregistrée dans l'audit." });
    }

    private async Task<(int KpiId, bool exists)> GetKpiIdByTabKeyAsync(string tabKey)
    {
        var kpiId = await _context.Database.SqlQuery<int>(
            $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Kpis] WHERE [Nom] = {tabKey} ORDER BY [Id]")
            .FirstOrDefaultAsync();
        return (kpiId, kpiId != 0);
    }

    private static List<ValeurRowData> ParseDataJsonToRows(string dataJson, string? tabKey)
    {
        using var doc = JsonDocument.Parse(dataJson);
        var root = doc.RootElement;

        JsonElement rowsElement = default;
        var found = false;

        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Array)
            {
                rowsElement = prop.Value;
                found = true;
                break;
            }
        }

        if (!found)
            return new List<ValeurRowData>();

        var result = new List<ValeurRowData>();
        foreach (var item in rowsElement.EnumerateArray())
        {
            var row = new ValeurRowData
            {
                Designation = JsonGetString(item, "designation")
            };

            switch ((tabKey ?? "").Trim().ToLowerInvariant())
            {
                case "compte_resultat":
                    row.M_Objectif = JsonGetDecimal(item, "mBudget");
                    row.M_Realise = JsonGetDecimal(item, "mRealise");
                    row.M_Taux = JsonGetDecimal(item, "mTaux");
                    row.M_1_Realise = JsonGetDecimal(item, "m1Realise");
                    break;
                case "chiffre_affaires_mda":
                    row.M_Objectif = JsonGetDecimal(item, "mObjectif");
                    row.M_Realise = JsonGetDecimal(item, "mRealise");
                    row.M_Taux = JsonGetDecimal(item, "mTaux");
                    row.M_1_Realise = JsonGetDecimal(item, "m1Realise");
                    break;
                case "investissement":
                case "avancement_engagement":
                case "tresorerie":
                    row.M_1 = JsonGetDecimal(item, "m1");
                    row.M = JsonGetDecimal(item, "m");
                    row.Evol = JsonGetDecimal(item, "evol");
                    break;
                case "creances_contentieuses_anterieur":
                    row.M_1_Montant_Recouvre = JsonGetDecimal(item, "m1Montant");
                    row.M_Montant_Recouvre = JsonGetDecimal(item, "mMontant");
                    row.Evol = JsonGetDecimal(item, "evol");
                    break;
                default:
                    row.M = JsonGetDecimal(item, "m");
                    row.M_1 = JsonGetDecimal(item, "m1");
                    break;
            }

            result.Add(row);
        }

        return result;
    }

    private static string ReconstructDataJson(string tabKey, List<Valeur> rows)
    {
        var normalizedTabKey = (tabKey ?? "").Trim().ToLowerInvariant();

        switch (normalizedTabKey)
        {
            case "compte_resultat":
                return JsonSerializer.Serialize(new
                {
                    compteResultatRows = rows.Select(v => new
                    {
                        designation = v.SousKpi?.Designation ?? "",
                        mBudget = v.M_Objectif?.ToString(CultureInfo.InvariantCulture) ?? "",
                        mRealise = v.M_Realise?.ToString(CultureInfo.InvariantCulture) ?? "",
                        mTaux = v.M_Taux?.ToString(CultureInfo.InvariantCulture) ?? "",
                        m1Realise = v.M_1_Realise?.ToString(CultureInfo.InvariantCulture) ?? ""
                    })
                });

            case "chiffre_affaires_mda":
                return JsonSerializer.Serialize(new
                {
                    chiffreAffairesMdaRows = rows.Select(v => new
                    {
                        designation = v.SousKpi?.Designation ?? "",
                        mObjectif = v.M_Objectif?.ToString(CultureInfo.InvariantCulture) ?? "",
                        mRealise = v.M_Realise?.ToString(CultureInfo.InvariantCulture) ?? "",
                        mTaux = v.M_Taux?.ToString(CultureInfo.InvariantCulture) ?? "",
                        m1Realise = v.M_1_Realise?.ToString(CultureInfo.InvariantCulture) ?? ""
                    })
                });

            case "investissement":
                return JsonSerializer.Serialize(new
                {
                    investissementRows = rows.Select(v => new
                    {
                        designation = v.SousKpi?.Designation ?? "",
                        m1 = v.M_1?.ToString(CultureInfo.InvariantCulture) ?? "",
                        m = v.M?.ToString(CultureInfo.InvariantCulture) ?? "",
                        evol = v.Evol?.ToString(CultureInfo.InvariantCulture) ?? ""
                    })
                });

            case "avancement_engagement":
                return JsonSerializer.Serialize(new
                {
                    avancementEngagementRows = rows.Select(v => new
                    {
                        designation = v.SousKpi?.Designation ?? "",
                        m1 = v.M_1?.ToString(CultureInfo.InvariantCulture) ?? "",
                        m = v.M?.ToString(CultureInfo.InvariantCulture) ?? "",
                        evol = v.Evol?.ToString(CultureInfo.InvariantCulture) ?? ""
                    })
                });

            case "tresorerie":
                return JsonSerializer.Serialize(new
                {
                    tresorerieMobilisRows = rows.Select(v => new
                    {
                        designation = v.SousKpi?.Designation ?? "",
                        m1 = v.M_1?.ToString(CultureInfo.InvariantCulture) ?? "",
                        m = v.M?.ToString(CultureInfo.InvariantCulture) ?? "",
                        evol = v.Evol?.ToString(CultureInfo.InvariantCulture) ?? ""
                    })
                });

            case "creances_contentieuses_anterieur":
                return JsonSerializer.Serialize(new
                {
                    recouvrementAnterieurRows = rows.Select(v => new
                    {
                        designation = v.SousKpi?.Designation ?? "",
                        m1Montant = v.M_1_Montant_Recouvre?.ToString(CultureInfo.InvariantCulture) ?? "",
                        mMontant = v.M_Montant_Recouvre?.ToString(CultureInfo.InvariantCulture) ?? "",
                        evol = v.Evol?.ToString(CultureInfo.InvariantCulture) ?? ""
                    })
                });
            default:
                return JsonSerializer.Serialize(new
                {
                    rows = rows.Select(v => new
                    {
                        designation = v.SousKpi?.Designation ?? "",
                        m1 = v.M_1?.ToString(CultureInfo.InvariantCulture) ?? "",
                        m = v.M?.ToString(CultureInfo.InvariantCulture) ?? ""
                    })
                });
        }
    }

    private static string? JsonGetString(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.String)
            return prop.GetString();
        return null;
    }

    private static decimal? JsonGetDecimal(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop))
        {
            if (prop.ValueKind == JsonValueKind.Number)
                return prop.GetDecimal();
            if (prop.ValueKind == JsonValueKind.String && decimal.TryParse(prop.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var val))
                return val;
        }
        return null;
    }
}

public class ApproveRequest
{
    public string TabKey { get; set; } = "";
    public string Mois { get; set; } = "";
    public string Annee { get; set; } = "";
    public string? Direction { get; set; }
}
