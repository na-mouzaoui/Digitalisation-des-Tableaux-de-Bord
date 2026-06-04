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

    private static readonly Dictionary<string, string> DomainDisplayNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["commercial"] = "Commerciale",
        ["commerciale"] = "Commerciale",
        ["dvdrs"] = "DVDRS",
        ["dqrpc"] = "DQRPC",
        ["support"] = "Support",
        ["finance"] = "Finances",
        ["finances"] = "Finances",
        ["regionale"] = "Regionale",
    };

    private static string NormalizeTabKey(string? tabKey) => (tabKey ?? "").Trim().ToLowerInvariant();
    private static string NormalizeKpiName(string? name) => (name ?? "").Trim().ToLowerInvariant();
    private static string? ResolveDomainDisplayName(string? domain)
    {
        var normalized = (domain ?? "").Trim().ToLowerInvariant();
        return DomainDisplayNames.TryGetValue(normalized, out var displayName) ? displayName : null;
    }

    private static List<string> ParseDisabledTabKeys(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return new List<string>();

        try
        {
            var parsed = JsonSerializer.Deserialize<List<string>>(raw) ?? new List<string>();
            return parsed
                .Select(NormalizeTabKey)
                .Where(key => !string.IsNullOrWhiteSpace(key))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        catch
        {
            return new List<string>();
        }
    }

    private static List<int> ParseCommaSeparatedIds(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return new List<int>();
        return raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => { int.TryParse(s.Trim(), out var id); return id; })
            .Where(id => id > 0)
            .Distinct()
            .ToList();
    }

    private static string SerializeCommaSeparatedIds(List<int> ids)
    {
        if (ids == null || ids.Count == 0)
            return "";
        return string.Join(",", ids.Distinct().OrderBy(x => x));
    }

    private async Task<(List<int> DomaineIds, List<int> SousDomaineIds)> DeriveDomainAndSdFromKpis(List<int> kpiIds)
    {
        if (kpiIds.Count == 0) return (new List<int>(), new List<int>());

        var sousDomaineIds = await _context.Kpis
            .Where(k => kpiIds.Contains(k.Id))
            .Select(k => k.SousDomaineId)
            .Distinct()
            .ToListAsync();

        var domaineIds = await _context.SousDomaines
            .Where(sd => sousDomaineIds.Contains(sd.Id))
            .Select(sd => sd.DomaineId)
            .Distinct()
            .ToListAsync();

        return (domaineIds, sousDomaineIds);
    }

    private static string SerializeDisabledTabKeys(IEnumerable<string> keys)
    {
        var normalized = keys
            .Select(NormalizeTabKey)
            .Where(key => !string.IsNullOrWhiteSpace(key))
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

    public class KpiRowsRequest
    {
        public List<string> Designations { get; set; } = new();
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
                u.AllowedKpis,
                u.AllowedDomaines,
                u.AllowedSousDomaines,
                u.MustChangePassword,
                u.CreatedAt
            })
            .ToListAsync();

        var result = users.Select(u => new
        {
            u.Id,
            u.Email,
            u.FirstName,
            u.LastName,
            u.Direction,
            u.PhoneNumber,
            u.Role,
            u.Region,
            allowedKpiIds = ParseCommaSeparatedIds(u.AllowedKpis),
            allowedDomaineIds = ParseCommaSeparatedIds(u.AllowedDomaines),
            allowedSousDomaineIds = ParseCommaSeparatedIds(u.AllowedSousDomaines),
            u.MustChangePassword,
            u.CreatedAt
        }).ToList();

        return Ok(result);
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        if (!await IsAdmin())
            return Forbid();

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == id);
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
            allowedKpiIds = ParseCommaSeparatedIds(user.AllowedKpis),
            allowedDomaineIds = ParseCommaSeparatedIds(user.AllowedDomaines),
            allowedSousDomaineIds = ParseCommaSeparatedIds(user.AllowedSousDomaines),
            user.MustChangePassword,
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

        var kpiIds = request.AllowedKpiIds ?? new List<int>();
        var (domaineIds, sousDomaineIds) = kpiIds.Count > 0
            ? await DeriveDomainAndSdFromKpis(kpiIds)
            : (new List<int>(), new List<int>());

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            FirstName = request.FirstName ?? "",
            LastName = request.LastName ?? "",
            Direction = request.Direction ?? "",
            PhoneNumber = request.PhoneNumber ?? "",
            Role = request.Role ?? "utilisateur",
            Region = request.Region,
            AllowedKpis = SerializeCommaSeparatedIds(kpiIds),
            AllowedDomaines = SerializeCommaSeparatedIds(domaineIds),
            AllowedSousDomaines = SerializeCommaSeparatedIds(sousDomaineIds),
            MustChangePassword = true,
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
        }

        if (request.Region != null)
        {
            user.Region = request.Region;
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        if (request.AllowedKpiIds != null)
        {
            var kpiIds = request.AllowedKpiIds;
            user.AllowedKpis = SerializeCommaSeparatedIds(kpiIds);

            var (domaineIds, sousDomaineIds) = kpiIds.Count > 0
                ? await DeriveDomainAndSdFromKpis(kpiIds)
                : (new List<int>(), new List<int>());

            user.AllowedDomaines = SerializeCommaSeparatedIds(domaineIds);
            user.AllowedSousDomaines = SerializeCommaSeparatedIds(sousDomaineIds);
        }
        else
        {
            if (request.AllowedDomaineIds != null)
                user.AllowedDomaines = SerializeCommaSeparatedIds(request.AllowedDomaineIds);

            if (request.AllowedSousDomaineIds != null)
                user.AllowedSousDomaines = SerializeCommaSeparatedIds(request.AllowedSousDomaineIds);
        }

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
        user.MustChangePassword = true;
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
    // IMPORT USERS FROM EXCEL
    // ?????????????????????????????????????????????

    public class ImportUserItem
    {
        public string Nom { get; set; } = string.Empty;
        public string Prenom { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Direction { get; set; } = string.Empty;
        public string Tel { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    [HttpPost("users/import")]
    public async Task<IActionResult> ImportUsers([FromBody] List<ImportUserItem> users)
    {
        if (!await IsAdmin())
            return Forbid();

        if (users == null || users.Count == 0)
            return BadRequest("Aucun utilisateur é importer");

        var validRoles = new[] { "utilisateur", "directeur", "divisionnaire" };
        var created = 0;
        var errors = new List<string>();

        foreach (var item in users)
        {
            var email = (item.Email ?? "").Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(email))
            {
                errors.Add($"Email manquant pour {item.Prenom} {item.Nom}");
                continue;
            }

            if (await _context.Users.AnyAsync(u => u.Email == email))
            {
                errors.Add($"Email déjé utilisé: {email}");
                continue;
            }

            if (!Regex.IsMatch(item.Tel ?? "", @"^0\d{9}$"))
            {
                errors.Add($"Téléphone invalide pour {email}: {item.Tel}");
                continue;
            }

            var normalizedRole = (item.Role ?? "").Trim().ToLowerInvariant();
            if (!string.IsNullOrWhiteSpace(normalizedRole) && !validRoles.Contains(normalizedRole))
            {
                errors.Add($"Réle invalide pour {email}: {item.Role}. Réles acceptés: {string.Join(", ", validRoles)}");
                continue;
            }

            var user = new User
            {
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456789"),
                FirstName = (item.Prenom ?? "").Trim(),
                LastName = (item.Nom ?? "").Trim(),
                Direction = (item.Direction ?? "").Trim(),
                PhoneNumber = (item.Tel ?? "").Trim(),
                Role = normalizedRole,
                MustChangePassword = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await _auditService.LogAction(
                GetCurrentUserId(),
                "IMPORT_USER",
                "User",
                user.Id,
                new { user.Email, user.Role, source = "excel_import" }
            );

            created++;
        }

        return Ok(new
        {
            message = $"{created} utilisateur(s) créé(s) avec succés",
            created,
            errors = errors.Count > 0 ? errors : null
        });
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
    // DOMAINES / SOUS-DOMAINES
    // ?????????????????????????????????????????????

    [HttpGet("domaines")]
    public async Task<IActionResult> GetDomaines()
    {
        if (!await IsAdmin())
            return Forbid();

        var domaines = await _context.Domaines
            .AsNoTracking()
            .Include(d => d.SousDomaines.OrderBy(sd => sd.Designation))
            .OrderBy(d => d.Designation)
            .Select(d => new
            {
                d.Id,
                d.Designation,
                SousDomaines = d.SousDomaines.Select(sd => new
                {
                    sd.Id,
                    sd.Designation,
                }).ToArray(),
            })
            .ToArrayAsync();

        return Ok(domaines);
    }

    public class CreateSousDomaineRequest
    {
        public int DomaineId { get; set; }
        public string Designation { get; set; } = string.Empty;
    }

    [HttpPost("sous-domaines")]
    public async Task<IActionResult> CreateSousDomaine([FromBody] CreateSousDomaineRequest request)
    {
        if (!await IsAdmin())
            return Forbid();

        var designation = (request.Designation ?? "").Trim();
        if (string.IsNullOrWhiteSpace(designation))
            return BadRequest(new { message = "La désignation du sous-domaine est requise." });

        var domaine = await _context.Domaines.FindAsync(request.DomaineId);
        if (domaine == null)
            return BadRequest(new { message = "Domaine introuvable." });

        var exists = await _context.SousDomaines
            .AnyAsync(sd => sd.DomaineId == request.DomaineId && sd.Designation == designation);

        if (exists)
            return BadRequest(new { message = "Ce sous-domaine existe déjé dans ce domaine." });

        var sousDomaine = new SousDomaine
        {
            DomaineId = request.DomaineId,
            Designation = designation,
        };

        _context.SousDomaines.Add(sousDomaine);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "CREATE_SOUS_DOMAINE",
            "SousDomaine",
            sousDomaine.Id,
            new { sousDomaine.Designation, domaineId = request.DomaineId }
        );

        return Ok(new
        {
            id = sousDomaine.Id,
            designation = sousDomaine.Designation,
            domaineId = sousDomaine.DomaineId,
        });
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

        var kpiKeys = await _context.Kpis
            .AsNoTracking()
            .Select(k => k.Nom)
            .Distinct()
            .OrderBy(k => k)
            .ToListAsync();

        var tableauKeys = await _context.Tableaus
            .AsNoTracking()
            .Select(t => t.TabKey)
            .Distinct()
            .ToListAsync();

        var allKeys = kpiKeys.Concat(tableauKeys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(k => k)
            .ToList();

        return Ok(new
        {
            disabledTabKeys,
            updatedAt = setting.UpdatedAt,
            tabs = allKeys.Select(key => new
            {
                key,
                label = GenerateTableauLabel(key),
                isEnabled = !disabledTabKeys.Contains(key, StringComparer.OrdinalIgnoreCase),
            }),
        });
    }

    private static string GenerateTableauLabel(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return key ?? "";

        var specialUpper = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "mda", "gp", "b2b", "mttr", "gsp", "dvdrs", "dqrpc"
        };

        var parts = key.Split('_', StringSplitOptions.RemoveEmptyEntries);
        for (var i = 0; i < parts.Length; i++)
        {
            if (specialUpper.Contains(parts[i]))
            {
                parts[i] = parts[i].ToUpperInvariant();
            }
            else if (parts[i].Length > 0)
            {
                parts[i] = char.ToUpperInvariant(parts[i][0]) + parts[i].Substring(1);
            }
        }

        return string.Join(" ", parts);
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

    // ?????????????????????????????????????????????
    // KPI ROW MANAGEMENT
    // ?????????????????????????????????????????????

    [HttpGet("kpis/by-name/{name}")]
    public async Task<IActionResult> GetKpiByName(string name, [FromQuery] string? domain = null)
    {
        if (!await IsAdmin())
            return Forbid();

        var normalizedName = NormalizeKpiName(name);
        if (string.IsNullOrWhiteSpace(normalizedName))
            return BadRequest(new { message = "Nom KPI invalide." });

        var domainDisplayName = ResolveDomainDisplayName(domain);
        var kpisQuery = _context.Kpis
            .Include(k => k.SousDomaine)
                .ThenInclude(sd => sd.Domaine)
            .Include(k => k.SousKpis)
            .AsNoTracking()
            .Where(k => k.Nom == normalizedName);

        if (!string.IsNullOrWhiteSpace(domainDisplayName))
        {
            kpisQuery = kpisQuery.Where(k => k.SousDomaine.Domaine.Designation == domainDisplayName || k.SousDomaine.Designation == domainDisplayName);
        }

        var kpi = await kpisQuery.FirstOrDefaultAsync();

        if (kpi == null)
        {
            return Ok(new
            {
                id = (int?)null,
                name = normalizedName,
                rows = Array.Empty<string>(),
            });
        }

        var rows = kpi.SousKpis
            .OrderBy(r => r.Order)
            .Select(r => r.Designation)
            .ToArray();

        return Ok(new
        {
            id = kpi.Id,
            name = kpi.Nom,
            sousDomaineId = kpi.SousDomaineId,
            sousDomaine = kpi.SousDomaine.Designation,
            rows,
        });
    }

    [HttpGet("hierarchy")]
    public async Task<IActionResult> GetHierarchy()
    {
        if (!await IsAdmin())
            return Forbid();

        var domaines = await _context.Domaines
            .AsNoTracking()
            .Include(d => d.SousDomaines)
                .ThenInclude(sd => sd.Kpis)
                    .ThenInclude(k => k.SousKpis)
            .OrderBy(d => d.Designation)
            .ToListAsync();

        var hierarchy = domaines.Select(d => new
        {
            id = d.Id,
            designation = d.Designation,
            sousDomaines = d.SousDomaines
                .OrderBy(sd => sd.Designation)
                .Select(sd => new
                {
                    id = sd.Id,
                    designation = sd.Designation,
                    kpis = sd.Kpis
                        .OrderBy(k => k.Nom)
                        .Select(k => new
                        {
                            id = k.Id,
                            name = k.Nom,
                            rows = k.SousKpis
                                .OrderBy(row => row.Order)
                                .Select(row => new
                                {
                                    id = row.Id,
                                    designation = row.Designation,
                                    order = row.Order,
                                })
                                .ToArray(),
                        })
                        .ToArray(),
                })
                .ToArray(),
        }).ToArray();

        return Ok(hierarchy);
    }

    [HttpDelete("kpis/{id}")]
    public async Task<IActionResult> DeleteKpi(int id)
    {
        if (!await IsAdmin())
            return Forbid();

        var kpi = await _context.Kpis
            .Include(k => k.SousKpis)
            .FirstOrDefaultAsync(k => k.Id == id);

        if (kpi == null)
            return NotFound(new { message = "KPI introuvable." });

        var kpiName = kpi.Nom;
        var sousDomaineId = kpi.SousDomaineId;

        _context.SousKpis.RemoveRange(kpi.SousKpis);
        _context.Kpis.Remove(kpi);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "DELETE_KPI",
            "Kpi",
            id,
            new { name = kpiName, sousDomaineId }
        );

        return Ok(new { message = "KPI supprimé.", name = kpiName });
    }

    [HttpPut("kpis/by-name/{name}")]
    public async Task<IActionResult> UpsertKpiRows(string name, [FromBody] KpiRowsRequest request, [FromQuery] string? domain = null, [FromQuery] int? sousDomaineId = null)
    {
        if (!await IsAdmin())
            return Forbid();

        var normalizedName = NormalizeKpiName(name);
        if (string.IsNullOrWhiteSpace(normalizedName))
            return BadRequest(new { message = "Nom KPI invalide." });

        var cleanedRows = (request.Designations ?? new List<string>())
            .Select(d => (d ?? "").Trim())
            .Where(d => !string.IsNullOrWhiteSpace(d))
            .ToList();

        var domainDisplayName = ResolveDomainDisplayName(domain);
        var kpisQuery = _context.Kpis
            .Include(k => k.SousDomaine)
                .ThenInclude(sd => sd.Domaine)
            .Include(k => k.SousKpis)
            .Where(k => k.Nom == normalizedName);

        if (!string.IsNullOrWhiteSpace(domainDisplayName))
        {
            kpisQuery = kpisQuery.Where(k => k.SousDomaine.Domaine.Designation == domainDisplayName || k.SousDomaine.Designation == domainDisplayName);
        }

        var kpi = await kpisQuery.FirstOrDefaultAsync();

        if (kpi == null)
        {
            if (sousDomaineId.HasValue)
            {
                var sousDomaine = await _context.SousDomaines.FindAsync(sousDomaineId.Value);
                if (sousDomaine == null)
                    return BadRequest(new { message = "Sous-domaine introuvable." });
                kpi = new Kpi { Nom = normalizedName, SousDomaineId = sousDomaine.Id };
            }
            else if (!string.IsNullOrWhiteSpace(domainDisplayName))
            {
                var sousDomaine = await _context.SousDomaines
                    .Include(sd => sd.Domaine)
                    .FirstOrDefaultAsync(sd => sd.Domaine.Designation == domainDisplayName || sd.Designation == domainDisplayName);

                if (sousDomaine == null)
                    return BadRequest(new { message = "Sous-domaine introuvable." });

                kpi = new Kpi { Nom = normalizedName, SousDomaineId = sousDomaine.Id };
            }
            else
            {
                return BadRequest(new { message = "Le domaine du KPI est requis pour créer ce tableau." });
            }

            _context.Kpis.Add(kpi);
        }

        _context.SousKpis.RemoveRange(kpi.SousKpis);
        kpi.SousKpis = cleanedRows
            .Select((designation, index) => new SousKpi
            {
                Designation = designation,
                Order = index,
            })
            .ToList();

        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "UPDATE_KPI_ROWS",
            "Kpi",
            kpi.Id,
            new { name = kpi.Nom, rows = cleanedRows }
        );

        return Ok(new
        {
            id = kpi.Id,
            name = kpi.Nom,
            sousDomaineId = kpi.SousDomaineId,
            sousDomaine = kpi.SousDomaine?.Designation,
            rows = cleanedRows,
        });
    }
}
