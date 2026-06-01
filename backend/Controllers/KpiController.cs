using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DigitalisationDesTableauxDeBordAPI.Data;

namespace DigitalisationDesTableauxDeBordAPI.Controllers;

[ApiController]
[Route("api/kpis")]
[Authorize]
public class KpiController : ControllerBase
{
    private readonly AppDbContext _context;

    public KpiController(AppDbContext context)
    {
        _context = context;
    }

    private static string NormalizeKpiName(string? name) => (name ?? "").Trim().ToLowerInvariant();

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

    private static string? ResolveDomainDisplayName(string? domain)
    {
        var normalized = (domain ?? "").Trim().ToLowerInvariant();
        return DomainDisplayNames.TryGetValue(normalized, out var displayName) ? displayName : null;
    }

    [HttpGet("domain/{domainName}")]
    public async Task<IActionResult> GetKpisByDomain(string domainName)
    {
        var domainDisplayName = ResolveDomainDisplayName(domainName);
        if (string.IsNullOrWhiteSpace(domainDisplayName))
            return BadRequest(new { message = "Domaine invalide." });

        var domaines = await _context.Domaines
            .AsNoTracking()
            .Include(d => d.SousDomaines)
                .ThenInclude(sd => sd.Kpis)
                    .ThenInclude(k => k.SousKpis)
            .Where(d => d.Designation == domainDisplayName)
            .ToListAsync();

        if (domaines.Count == 0)
            return Ok(Array.Empty<object>());

        var result = domaines.SelectMany(d => d.SousDomaines)
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
                            .OrderBy(r => r.Order)
                            .Select(r => r.Designation)
                            .ToArray(),
                    })
                    .ToArray(),
            })
            .ToArray();

        return Ok(result);
    }

    [HttpGet("by-name/{name}")]
    public async Task<IActionResult> GetKpiByName(string name, [FromQuery] string? domain = null)
    {
        var normalizedName = NormalizeKpiName(name);
        if (string.IsNullOrWhiteSpace(normalizedName))
            return BadRequest(new { message = "Nom KPI invalide." });

        var domainDisplayName = ResolveDomainDisplayName(domain);
        var query = _context.Kpis
            .Include(k => k.SousDomaine)
                .ThenInclude(sd => sd.Domaine)
            .Include(k => k.SousKpis)
            .AsNoTracking()
            .Where(k => k.Nom == normalizedName);

        if (!string.IsNullOrWhiteSpace(domainDisplayName))
        {
            query = query.Where(k => k.SousDomaine.Domaine.Designation == domainDisplayName || k.SousDomaine.Designation == domainDisplayName);
        }

        var kpi = await query.FirstOrDefaultAsync();

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
}
