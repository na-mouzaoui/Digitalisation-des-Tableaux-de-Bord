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

    [HttpGet("by-name/{name}")]
    public async Task<IActionResult> GetKpiByName(string name)
    {
        var normalizedName = NormalizeKpiName(name);
        if (string.IsNullOrWhiteSpace(normalizedName))
            return BadRequest(new { message = "Nom KPI invalide." });

        var kpi = await _context.Kpis
            .Include(k => k.SousKpis)
            .AsNoTracking()
            .FirstOrDefaultAsync(k => k.Nom == normalizedName);

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
            rows,
        });
    }
}
