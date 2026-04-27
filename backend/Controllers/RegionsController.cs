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

    private static List<string> ParseWilayas(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return new List<string>();

        return value
            .Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.Trim())
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string SerializeWilayas(IEnumerable<string>? values)
    {
        if (values == null)
            return string.Empty;

        return string.Join(';', values
            .Select(w => (w ?? string.Empty).Trim())
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Distinct(StringComparer.OrdinalIgnoreCase));
    }

    private static List<string> GetRequestedWilayas(RegionUpdateBase request)
    {
        if (request.Wilayas != null)
            return request.Wilayas;

        if (request.Villes != null)
            return request.Villes;

        return new List<string>();
    }

    [HttpGet("wilayas")]
    public async Task<IActionResult> GetWilayas()
    {
        var wilayas = await _context.Wilayas
            .OrderBy(w => w.Nom)
            .Select(w => new { w.Id, w.Code, Name = w.Nom })
            .ToListAsync();

        return Ok(wilayas);
    }

    // GET: api/regions
    [HttpGet]
    public async Task<IActionResult> GetAllRegions()
    {
        var regions = await _context.Regions
            .OrderBy(r => r.Name)
            .ToListAsync();

        return Ok(regions.Select(r => new
        {
            r.Id,
            r.Name,
            Villes = ParseWilayas(r.VillesJson),
            Wilayas = ParseWilayas(r.VillesJson),
            r.CreatedAt
        }));
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
            region.Name,
            Villes = ParseWilayas(region.VillesJson),
            Wilayas = ParseWilayas(region.VillesJson),
            region.CreatedAt
        });
    }

    // GET: api/regions/by-name/{name}
    [HttpGet("by-name/{name}")]
    public async Task<IActionResult> GetRegionByName(string name)
    {
        var trimmedName = name?.Trim() ?? string.Empty;
        var region = await _context.Regions.FirstOrDefaultAsync(r => r.Name == trimmedName);
        if (region == null)
            return NotFound();

        return Ok(new
        {
            region.Id,
            region.Name,
            Villes = ParseWilayas(region.VillesJson),
            Wilayas = ParseWilayas(region.VillesJson),
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

        var oldValues = new { region.Name, Villes = ParseWilayas(region.VillesJson) };

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var newName = request.Name.Trim();
            var duplicate = await _context.Regions.AnyAsync(r => r.Id != id && r.Name == newName);
            if (duplicate)
            {
                return Conflict(new { message = "Une région avec ce nom existe déjà" });
            }

            region.Name = newName;
        }

        if (request.Villes != null || request.Wilayas != null)
        {
            region.VillesJson = SerializeWilayas(GetRequestedWilayas(request));
        }

        await _context.SaveChangesAsync();

        var newValues = new { region.Name, Villes = ParseWilayas(region.VillesJson) };
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
            region.Name,
            Villes = ParseWilayas(region.VillesJson),
            Wilayas = ParseWilayas(region.VillesJson),
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
        var existingRegion = await _context.Regions.FirstOrDefaultAsync(r => r.Name == name);
        if (existingRegion != null)
        {
            return Conflict(new { message = "Une région avec ce nom existe déjà" });
        }

        var requestedWilayas = GetRequestedWilayas(request);
        var region = new Region
        {
            Name = name,
            VillesJson = SerializeWilayas(requestedWilayas),
            CreatedAt = DateTime.UtcNow
        };

        _context.Regions.Add(region);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(
            GetCurrentUserId(),
            "CREATE_REGION",
            "Region",
            region.Id,
            new { region.Name, Villes = requestedWilayas }
        );

        return CreatedAtAction(nameof(GetRegion), new { id = region.Id }, new
        {
            region.Id,
            region.Name,
            Villes = ParseWilayas(region.VillesJson),
            Wilayas = ParseWilayas(region.VillesJson),
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

        var usersInRegion = await _context.Users.AnyAsync(u => u.Region == region.Name);
        if (usersInRegion)
        {
            return BadRequest(new { message = "Impossible de supprimer une région assignée é des utilisateurs" });
        }

        var deletedData = new
        {
            region.Name,
            Villes = ParseWilayas(region.VillesJson)
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
}

public class UpdateRegionRequest : RegionUpdateBase
{
    public string? Name { get; set; }
}

public class CreateRegionRequest : RegionUpdateBase
{
    public string Name { get; set; } = string.Empty;
}
