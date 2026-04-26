using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DigitalisationDesTableauxDeBordAPI.Data;
using DigitalisationDesTableauxDeBordAPI.Models;
using DigitalisationDesTableauxDeBordAPI.Services;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Text.Json;

namespace DigitalisationDesTableauxDeBordAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public AdminController(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    private static readonly string[] ManagedTableauKeys =
    {
        "chiffre_affaires_mda",
        "parc_abonnes_gp",
        "total_parc_abonnes",
        "total_parc_abonnes_technologie",
        "parc_abonnes_b2b",
        "activation",
        "desactivation_resiliation",
        "reclamation",
        "reclamation_gp",
        "e_payement_pop",
        "e_payement_prp",
        "total_encaissement",
        "rechargement",
        "recouvrement",
        "realisation_technique_reseau",
        "situation_reseau",
        "trafic_data",
        "amelioration_qualite",
        "couverture_reseau",
        "action_notable_reseau",
        "disponibilite_reseau",
        "mttr",
        "creances_contentieuses",
        "frais_personnel",
        "effectif_gsp",
        "absenteisme",
        "mouvement_effectifs",
        "mouvement_effectifs_domaine",
        "effectifs_formes_gsp",
        "formations_domaines",
        "compte_resultat",
    };

    private static readonly Dictionary<string, string> ManagedTableauLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["chiffre_affaires_mda"] = "1 - Chiffre d'Affaires (MDA)",
        ["parc_abonnes_gp"] = "2 - Parc Abonnés GP",
        ["total_parc_abonnes"] = "3 - Total Parc Abonnés",
        ["total_parc_abonnes_technologie"] = "4 - Total Parc Abonnés par technologie",
        ["parc_abonnes_b2b"] = "5 - Parc Abonnés B2B",
        ["activation"] = "6 - Activation",
        ["desactivation_resiliation"] = "7 - Désactivation / Résiliation",
        ["reclamation"] = "8 - Réclamation",
        ["reclamation_gp"] = "9 - Réclamation GP",
        ["e_payement_pop"] = "10 - E-PAYEMENT Pop",
        ["e_payement_prp"] = "11 - E-PAYEMENT Prp",
        ["total_encaissement"] = "12 - Totale des encaissement",
        ["rechargement"] = "13 - Rechargement",
        ["recouvrement"] = "14 - Recouvrement",
        ["realisation_technique_reseau"] = "15 - Réalisation technique réseau",
        ["situation_reseau"] = "16 - Situation réseau",
        ["trafic_data"] = "17 - Trafic Data",
        ["amelioration_qualite"] = "18 - Amélioration qualité",
        ["couverture_reseau"] = "19 - Couverture réseau",
        ["action_notable_reseau"] = "20 - Action notable sur le réseau",
        ["disponibilite_reseau"] = "21 - Disponibilité réseau",
        ["mttr"] = "22 - MTTR",
        ["creances_contentieuses"] = "23 - Créances contentieuses",
        ["frais_personnel"] = "24 - Frais personnel",
        ["effectif_gsp"] = "25 - Effectif par GSP",
        ["absenteisme"] = "26 - Absentéisme",
        ["mouvement_effectifs"] = "27 - Mouvement des effectifs",
        ["mouvement_effectifs_domaine"] = "28 - Mouvement des effectifs par domaine",
        ["effectifs_formes_gsp"] = "29 - Effectifs formés par GSP",
        ["formations_domaines"] = "30 - Formations réalisées par domaines",
        ["compte_resultat"] = "31 - Compte de résultat",
    };

    private static readonly HashSet<string> ManagedTableauKeySet =
        new(ManagedTableauKeys, StringComparer.OrdinalIgnoreCase);

    private static string NormalizeTabKey(string? tabKey) => (tabKey ?? "").Trim().ToLowerInvariant();

    private static List<string> ParseDisabledTabKeys(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return new List<string>();

        try
        {
            var parsed = JsonSerializer.Deserialize<List<string>>(raw) ?? new List<string>();
            return parsed
                .Select(NormalizeTabKey)
                .Where(key => !string.IsNullOrWhiteSpace(key) && ManagedTableauKeySet.Contains(key))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        catch
        {
            return new List<string>();
        }
    }

    private static string SerializeDisabledTabKeys(IEnumerable<string> keys)
    {
        var normalized = keys
            .Select(NormalizeTabKey)
            .Where(key => !string.IsNullOrWhiteSpace(key) && ManagedTableauKeySet.Contains(key))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return JsonSerializer.Serialize(normalized);
    }

    private async Task<AdminSetting> GetOrCreateAdminSettingAsync()
    {
        var setting = await _context.AdminSettings.FirstOrDefaultAsync(x => x.Id == 1);
        if (setting != null)
            return setting;

        setting = new AdminSetting
        {
            Id = 1,
            DisabledTabKeysJson = "[]",
            UpdatedAt = DateTime.UtcNow,
        };
        _context.AdminSettings.Add(setting);
        await _context.SaveChangesAsync();
        return setting;
    }

    public class ToggleTableauRequest
    {
        public string TabKey { get; set; } = string.Empty;
        public bool IsEnabled { get; set; } = true;
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.Parse(userIdClaim ?? "0");
    }

    private async Task<bool> IsAdmin()
    {
        var userId = GetCurrentUserId();
        var user = await _context.Users.FindAsync(userId);
        return user?.Role == "admin";
    }

    // ?????????????????????????????????????????????
    // USERS
    // ?????????????????????????????????????????????

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers()
    {
        if (!await IsAdmin())
            return Forbid();

        var users = await _context.Users
            .Where(u => u.Role != "admin")
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FirstName,
                u.LastName,
                u.Direction,
                u.PhoneNumber,
                u.Role,
                u.Region,
                u.CreatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        if (!await IsAdmin())
            return Forbid();

        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound();

        if (user.Role == "admin")
            return Forbid();

        return Ok(new
        {
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            user.Direction,
            user.PhoneNumber,
            user.Role,
            user.Region,
            user.CreatedAt
        });
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (!await IsAdmin())
            return Forbid();

        var email = (request.Email ?? "").Trim();
        var password = request.Password ?? "";

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return BadRequest("Email et mot de passe requis");

        if (await _context.Users.AnyAsync(u => u.Email == email))
            return BadRequest("Email déjé utilisé");

        if (!Regex.IsMatch(request.PhoneNumber ?? "", @"^0\d{9}$"))
            return BadRequest("Numéro de téléphone invalide");

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            FirstName = request.FirstName ?? "",
            LastName = request.LastName ?? "",
            Direction = request.Direction ?? "",
            PhoneNumber = request.PhoneNumber ?? "",
            Role = request.Role ?? "comptabilite",
            Region = request.Role == "regionale" ? request.Region : null,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "CREATE_USER",
            "User",
            user.Id,
            new { user.Email, user.Role }
        );

        return Ok(user);
    }

    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        if (!await IsAdmin())
            return Forbid();

        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound();

        if (user.Role == "admin")
            return Forbid();

        if (!string.IsNullOrWhiteSpace(request.FirstName))
            user.FirstName = request.FirstName;

        if (!string.IsNullOrWhiteSpace(request.LastName))
            user.LastName = request.LastName;

        if (!string.IsNullOrWhiteSpace(request.Direction))
            user.Direction = request.Direction;

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            if (!Regex.IsMatch(request.PhoneNumber, @"^0\d{9}$"))
                return BadRequest("Numéro invalide");

            user.PhoneNumber = request.PhoneNumber;
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            user.Role = request.Role;
            user.Region = request.Role == "regionale" ? request.Region : null;
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "UPDATE_USER",
            "User",
            user.Id,
            new { user.Email }
        );

        return Ok(user);
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        if (!await IsAdmin())
            return Forbid();

        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound();

        if (user.Role == "admin")
            return Forbid();

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "DELETE_USER",
            "User",
            id,
            new { user.Email }
        );

        return NoContent();
    }

    [HttpPost("users/{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id)
    {
        if (!await IsAdmin())
            return Forbid();

        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound();

        if (user.Role == "admin")
            return Forbid();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456789");
        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "RESET_PASSWORD",
            "User",
            id,
            new { user.Email }
        );

        return Ok(new { message = "Mot de passe réinitialisé" });
    }

    // ?????????????????????????????????????????????
    // AUDIT LOGS
    // ?????????????????????????????????????????????

    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int? userId,
        [FromQuery] string? action,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
    {
        if (!await IsAdmin())
            return Forbid();

        var logs = await _auditService.GetAuditLogs(userId, action, from, to);

        return Ok(logs.Select(l => new
        {
            l.Id,
            l.UserId,
            UserEmail = l.User.Email,
            UserName = $"{l.User.FirstName} {l.User.LastName}",
            l.Action,
            l.EntityType,
            l.EntityId,
            l.Details,
            l.CreatedAt
        }));
    }

    // ?????????????????????????????????????????????
    // TABLEAU SETTINGS
    // ?????????????????????????????????????????????

    [HttpGet("tableau-settings")]
    public async Task<IActionResult> GetTableauSettings()
    {
        if (!await IsAdmin())
            return Forbid();

        var setting = await GetOrCreateAdminSettingAsync();
        var disabledTabKeys = ParseDisabledTabKeys(setting.DisabledTabKeysJson);

        var existingTabKeys = await _context.Tableaus
            .AsNoTracking()
            .Select(t => t.TabKey)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync();

        var allKeys = existingTabKeys.Concat(ManagedTableauKeys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Ok(new
        {
            disabledTabKeys,
            updatedAt = setting.UpdatedAt,
            tabs = allKeys.Select(key => new
            {
                key,
                label = ManagedTableauLabels.TryGetValue(key, out var label) ? label : key,
                isEnabled = !disabledTabKeys.Contains(key, StringComparer.OrdinalIgnoreCase),
            }),
        });
    }

    [HttpPut("tableau-settings/tabs")]
    public async Task<IActionResult> ToggleTableau([FromBody] ToggleTableauRequest request)
    {
        if (!await IsAdmin())
            return Forbid();

        var normalizedTabKey = NormalizeTabKey(request.TabKey);
        if (string.IsNullOrWhiteSpace(normalizedTabKey))
            return BadRequest(new { message = "Tableau invalide." });

        var setting = await GetOrCreateAdminSettingAsync();
        var disabledTabKeys = ParseDisabledTabKeys(setting.DisabledTabKeysJson);

        if (request.IsEnabled)
            disabledTabKeys.RemoveAll(key => string.Equals(key, normalizedTabKey, StringComparison.OrdinalIgnoreCase));
        else if (!disabledTabKeys.Contains(normalizedTabKey, StringComparer.OrdinalIgnoreCase))
            disabledTabKeys.Add(normalizedTabKey);

        setting.DisabledTabKeysJson = SerializeDisabledTabKeys(disabledTabKeys);
        setting.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "UPDATE_FISCAL_SETTING",
            "AdminSetting",
            setting.Id,
            new { tabKey = normalizedTabKey, isEnabled = request.IsEnabled }
        );

        return Ok(new
        {
            tabKey = normalizedTabKey,
            isEnabled = request.IsEnabled,
            disabledTabKeys = ParseDisabledTabKeys(setting.DisabledTabKeysJson),
            updatedAt = setting.UpdatedAt,
        });
    }
}
