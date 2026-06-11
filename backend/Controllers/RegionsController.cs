using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DigitalisationDesTableauxDeBordAPI.Data;
using DigitalisationDesTableauxDeBordAPI.Models;
using DigitalisationDesTableauxDeBordAPI.Services;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DigitalisationDesTableauxDeBordAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RegionsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public RegionsController(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.Parse(userIdClaim ?? "0");
    }

    private static bool AreWilayaIds(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        return value.Split(';', StringSplitOptions.RemoveEmptyEntries)
            .All(w => int.TryParse(w.Trim(), out _));
    }

    private static List<int> ParseWilayaIds(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return new();
        return value
            .Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => int.TryParse(w.Trim(), out var id) ? id : -1)
            .Where(id => id > 0)
            .Distinct()
            .ToList();
    }

    private static List<string> ParseWilayaNames(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return new();
        return value
            .Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.Trim())
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task<List<string>> ResolveWilayaNamesAsync(List<int> ids)
    {
        if (ids.Count == 0) return new();
        return await _context.Wilayas
            .Where(w => ids.Contains(w.Id))
            .OrderBy(w => w.Nom)
            .Select(w => w.Nom)
            .ToListAsync();
    }

    private static string SerializeWilayaIds(List<int>? ids)
    {
        if (ids == null || ids.Count == 0) return string.Empty;
        return string.Join(';', ids.Distinct().OrderBy(id => id));
    }

    private async Task<List<int>> GetWilayaIdsFromRequest(RegionUpdateBase request)
    {
        if (request.WilayaIds != null && request.WilayaIds.Count > 0)
            return request.WilayaIds.Distinct().ToList();

        var names = new List<string>();
        if (request.Wilayas != null)
            names = request.Wilayas;
        else if (request.Villes != null)
            names = request.Villes;

        if (names.Count == 0) return new();

        return await _context.Wilayas
            .Where(w => names.Contains(w.Nom))
            .Select(w => w.Id)
            .ToListAsync();
    }

    private async Task<List<string>> GetWilayaNamesFromStored(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return new();
        if (AreWilayaIds(stored))
        {
            var ids = ParseWilayaIds(stored);
            return await ResolveWilayaNamesAsync(ids);
        }
        return ParseWilayaNames(stored);
    }

    [HttpGet("wilayas")]
    public async Task<IActionResult> GetWilayas()
    {
        var wilayas = await _context.Wilayas
            .OrderBy(w => w.Nom)
            .Select(w => new { w.Id, Name = w.Nom })
            .ToListAsync();

        return Ok(wilayas);
    }

    // GET: api/regions
    [HttpGet]
    public async Task<IActionResult> GetAllRegions()
    {
        var regions = await _context.Regions
            .OrderBy(r => r.Nom)
            .ToListAsync();

        var result = new List<object>();
        foreach (var r in regions)
        {
            result.Add(new
            {
                r.Id,
                Nom = r.Nom,
                Wilayas = await GetWilayaNamesFromStored(r.Wilayas),
                r.CreatedAt
            });
        }

        return Ok(result);
    }

    // GET: api/regions/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetRegion(int id)
    {
        var region = await _context.Regions.FindAsync(id);
        if (region == null)
            return NotFound();

        return Ok(new
        {
            region.Id,
            Nom = region.Nom,
            Wilayas = await GetWilayaNamesFromStored(region.Wilayas),
            region.CreatedAt
        });
    }

    // GET: api/regions/by-name/{name}
    [HttpGet("by-name/{name}")]
    public async Task<IActionResult> GetRegionByName(string name)
    {
        var trimmedName = name?.Trim() ?? string.Empty;
        var region = await _context.Regions.FirstOrDefaultAsync(r => r.Nom == trimmedName);
        if (region == null)
            return NotFound();

        return Ok(new
        {
            region.Id,
            Nom = region.Nom,
            Wilayas = await GetWilayaNamesFromStored(region.Wilayas),
            region.CreatedAt
        });
    }

    // PUT: api/regions/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRegion(int id, [FromBody] UpdateRegionRequest request)
    {
        var region = await _context.Regions.FindAsync(id);
        if (region == null)
            return NotFound();

        var oldWilayaNames = await GetWilayaNamesFromStored(region.Wilayas);
        var oldValues = new { Nom = region.Nom, Wilayas = oldWilayaNames };

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var newName = request.Name.Trim();
            var duplicate = await _context.Regions.AnyAsync(r => r.Id != id && r.Nom == newName);
            if (duplicate)
            {
                return Conflict(new { message = "Une région avec ce nom existe déjà" });
            }

            region.Nom = newName;
        }

        if (request.WilayaIds != null || request.Villes != null || request.Wilayas != null)
        {
            var ids = await GetWilayaIdsFromRequest(request);
            region.Wilayas = SerializeWilayaIds(ids);
        }

        await _context.SaveChangesAsync();

        var newWilayaNames = await GetWilayaNamesFromStored(region.Wilayas);
        var newValues = new { Nom = region.Nom, Wilayas = newWilayaNames };
        await _auditService.LogAction(
            GetCurrentUserId(), 
            "UPDATE_REGION", 
            "Region", 
            id, 
            new { OldValues = oldValues, NewValues = newValues }
        );

        return Ok(new
        {
            region.Id,
            Nom = region.Nom,
            Wilayas = await GetWilayaNamesFromStored(region.Wilayas),
            region.CreatedAt
        });
    }

    // POST: api/regions
    [HttpPost]
    public async Task<IActionResult> CreateRegion([FromBody] CreateRegionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Le nom de la région est requis" });
        }

        var name = request.Name.Trim();
        var existingRegion = await _context.Regions.FirstOrDefaultAsync(r => r.Nom == name);
        if (existingRegion != null)
        {
            return Conflict(new { message = "Une région avec ce nom existe déjà" });
        }

        var requestedWilayaIds = await GetWilayaIdsFromRequest(request);
        var region = new Region
        {
            Nom = name,
            Wilayas = SerializeWilayaIds(requestedWilayaIds),
            CreatedAt = DateTime.UtcNow
        };

        _context.Regions.Add(region);
        await _context.SaveChangesAsync();

        var createdWilayaNames = await GetWilayaNamesFromStored(region.Wilayas);
        await _auditService.LogAction(
            GetCurrentUserId(),
            "CREATE_REGION",
            "Region",
            region.Id,
            new { Nom = region.Nom, Wilayas = createdWilayaNames }
        );

        return CreatedAtAction(nameof(GetRegion), new { id = region.Id }, new
        {
            region.Id,
            Nom = region.Nom,
            Wilayas = createdWilayaNames,
            region.CreatedAt
        });
    }

    // DELETE: api/regions/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRegion(int id)
    {
        var region = await _context.Regions.FindAsync(id);
        if (region == null)
        {
            return NotFound(new { message = "Région non trouvée" });
        }

        var usersInRegion = await _context.Users.AnyAsync(u => u.Region == region.Nom);
        if (usersInRegion)
        {
            return BadRequest(new { message = "Impossible de supprimer une région assignée é des utilisateurs" });
        }

        var deletedData = new
        {
            Nom = region.Nom,
            Wilayas = await GetWilayaNamesFromStored(region.Wilayas)
        };

        _context.Regions.Remove(region);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "DELETE_REGION",
            "Region",
            id,
            deletedData
        );

        return NoContent();
    }
}

public class RegionUpdateBase
{
    public List<string>? Villes { get; set; }
    public List<string>? Wilayas { get; set; }
    public List<int>? WilayaIds { get; set; }
}

public class UpdateRegionRequest : RegionUpdateBase
{
    public string? Name { get; set; }
}

public class CreateRegionRequest : RegionUpdateBase
{
    public string Name { get; set; } = string.Empty;
}
