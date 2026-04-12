using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CheckFillingAPI.Data;
using CheckFillingAPI.Models;
using CheckFillingAPI.Services;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Security.Claims;

namespace CheckFillingAPI.Controllers;

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

    // GET: api/regions
    [HttpGet]
    public async Task<IActionResult> GetAllRegions()
    {
        var regions = await _context.Regions.ToListAsync();

        return Ok(regions.Select(r => new
        {
            r.Id,
            r.Name,
            Villes = JsonSerializer.Deserialize<List<string>>(r.VillesJson),
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
            Villes = JsonSerializer.Deserialize<List<string>>(region.VillesJson),
            region.CreatedAt
        });
    }

    // GET: api/regions/by-name/{name}
    [HttpGet("by-name/{name}")]
    public async Task<IActionResult> GetRegionByName(string name)
    {
        var region = await _context.Regions.FirstOrDefaultAsync(r => r.Name == name);
        if (region == null)
            return NotFound();

        return Ok(new
        {
            region.Id,
            region.Name,
            Villes = JsonSerializer.Deserialize<List<string>>(region.VillesJson),
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

        var oldValues = new { region.Name, Villes = JsonSerializer.Deserialize<List<string>>(region.VillesJson) };

        // Mettre à jour le nom si fourni
        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            region.Name = request.Name;
        }

        // Mettre à jour les villes (même si la liste est vide pour permettre la dé-assignation)
        if (request.Villes != null)
        {
            region.VillesJson = JsonSerializer.Serialize(request.Villes);
        }

        await _context.SaveChangesAsync();

        // Log audit
        var newValues = new { region.Name, Villes = JsonSerializer.Deserialize<List<string>>(region.VillesJson) };
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
            Villes = JsonSerializer.Deserialize<List<string>>(region.VillesJson),
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

        // Vérifier si une région avec ce nom existe déjà
        var existingRegion = await _context.Regions.FirstOrDefaultAsync(r => r.Name == request.Name);
        if (existingRegion != null)
        {
            return Conflict(new { message = "Une région avec ce nom existe déjà" });
        }

        var region = new Region
        {
            Name = request.Name,
            VillesJson = JsonSerializer.Serialize(request.Villes ?? new List<string>()),
            CreatedAt = DateTime.UtcNow
        };

        _context.Regions.Add(region);
        await _context.SaveChangesAsync();

        // Log audit
        await _auditService.LogAction(
            GetCurrentUserId(),
            "CREATE_REGION",
            "Region",
            region.Id,
            new { region.Name, Villes = request.Villes ?? new List<string>() }
        );

        return CreatedAtAction(nameof(GetRegion), new { id = region.Id }, new
        {
            region.Id,
            region.Name,
            Villes = JsonSerializer.Deserialize<List<string>>(region.VillesJson),
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

        // Vérifier s'il y a des utilisateurs associés à cette région
        var usersInRegion = await _context.Users.AnyAsync(u => u.Region == region.Name);
        if (usersInRegion)
        {
            return BadRequest(new { message = "Impossible de supprimer une région assignée à des utilisateurs" });
        }

        var deletedData = new
        {
            region.Name,
            Villes = JsonSerializer.Deserialize<List<string>>(region.VillesJson)
        };

        _context.Regions.Remove(region);
        await _context.SaveChangesAsync();

        // Log audit
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

public class UpdateRegionRequest
{
    public string? Name { get; set; }
    public List<string>? Villes { get; set; }
}

public class CreateRegionRequest
{
    public string Name { get; set; } = string.Empty;
    public List<string>? Villes { get; set; }
}
