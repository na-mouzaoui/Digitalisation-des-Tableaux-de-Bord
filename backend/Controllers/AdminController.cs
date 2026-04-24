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
        "encaissement",
        "tva_immo",
        "tva_biens",
        "droits_timbre",
        "ca_tap",
        "etat_tap",
        "ca_siege",
        "irg",
        "taxe2",
        "taxe_masters",
        "taxe_vehicule",
        "taxe_formation",
        "acompte",
        "ibs",
        "taxe_domicil",
        "tva_autoliq",
    };

    private static readonly Dictionary<string, string> ManagedTableauLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["encaissement"] = "1 - Encaissement",
        ["tva_immo"] = "2 - TVA / IMMO",
        ["tva_biens"] = "3 - TVA / Biens & Services",
        ["droits_timbre"] = "4 - Droits de Timbre",
        ["ca_tap"] = "5 - CA 7% & CA Global 1%",
        ["etat_tap"] = "6 - ETAT TAP",
        ["ca_siege"] = "7a - CA Siege",
        ["irg"] = "8a - Situation IRG",
        ["taxe2"] = "9a - Taxe 2%",
        ["taxe_masters"] = "10a - Taxe Masters 1,5%",
        ["taxe_vehicule"] = "11a - Taxe Vehicule",
        ["taxe_formation"] = "12a - Taxe Formation",
        ["acompte"] = "13a - Acompte Provisionnel",
        ["ibs"] = "14a - IBS Fournisseurs Etrangers",
        ["taxe_domicil"] = "15a - Taxe Domiciliation",
        ["tva_autoliq"] = "16a - TVA Auto Liquidation",
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

        return Ok(new
        {
            disabledTabKeys,
            updatedAt = setting.UpdatedAt,
            tabs = ManagedTableauKeys.Select(key => new
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
        if (!ManagedTableauKeySet.Contains(normalizedTabKey))
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
