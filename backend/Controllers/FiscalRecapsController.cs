using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CheckFillingAPI.Data;
using CheckFillingAPI.Models;
using CheckFillingAPI.Services;
using System.Security.Claims;
using System.Text.Json;

namespace CheckFillingAPI.Controllers;

[ApiController]
[Route("api/fiscal-recaps")]
[Authorize]
public class EtatsDeSortieController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public EtatsDeSortieController(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private async Task<string> GetCurrentUserRoleAsync(int userId)
    {
        var dbUser = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Role })
            .FirstOrDefaultAsync();

        var roleClaim = User.FindFirst("role")?.Value
            ?? User.FindFirst(ClaimTypes.Role)?.Value
            ?? string.Empty;

        var role = !string.IsNullOrWhiteSpace(dbUser?.Role)
            ? dbUser!.Role.Trim().ToLowerInvariant()
            : roleClaim.Trim().ToLowerInvariant();

        return role;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? key, [FromQuery] string? mois, [FromQuery] string? annee)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized();

        var role = await GetCurrentUserRoleAsync(userId);

        IQueryable<EtatsDeSortie> query = _context.EtatsDeSortie.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(key))
            query = query.Where(r => r.Key == key);

        if (!string.IsNullOrWhiteSpace(mois))
            query = query.Where(r => r.Mois == mois);

        if (!string.IsNullOrWhiteSpace(annee))
            query = query.Where(r => r.Annee == annee);

        if (role == "regionale" || role == "direction")
        {
            // Sans colonne Direction, ces rôles ne voient que leurs propres états de sortie.
            query = query.Where(r => r.UserId == userId);
        }

        var recaps = await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                r.Key,
                r.Title,
                r.Mois,
                r.Annee,
                r.RowsJson,
                r.FormulasJson,
                r.IsGenerated,
                r.CreatedAt,
                r.UpdatedAt,
                r.UserId
            })
            .ToListAsync();

        return Ok(recaps);
    }

    [HttpPost("save")]
    public async Task<IActionResult> Save([FromBody] EtatsDeSortieSaveRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Key)
            || string.IsNullOrWhiteSpace(request.Title)
            || string.IsNullOrWhiteSpace(request.Mois)
            || string.IsNullOrWhiteSpace(request.Annee))
        {
            return BadRequest(new { message = "Les champs key, title, mois et annee sont obligatoires." });
        }

        if (request.Rows.ValueKind != JsonValueKind.Array)
        {
            return BadRequest(new { message = "Le champ rows doit être un tableau JSON." });
        }

        var now = DateTime.UtcNow;
        var rowsJson = request.Rows.GetRawText();
        var formulasJson = request.Formulas.ValueKind == JsonValueKind.Undefined
            ? "{}"
            : request.Formulas.GetRawText();

        var existing = await _context.EtatsDeSortie
            .FirstOrDefaultAsync(r => r.Key == request.Key && r.Mois == request.Mois && r.Annee == request.Annee);
        var isCreate = existing is null;

        if (existing is null)
        {
            existing = new EtatsDeSortie
            {
                Key = request.Key.Trim(),
                Title = request.Title.Trim(),
                Mois = request.Mois.Trim(),
                Annee = request.Annee.Trim(),
                RowsJson = rowsJson,
                FormulasJson = formulasJson,
                IsGenerated = request.IsGenerated,
                UserId = userId,
                CreatedAt = now,
                UpdatedAt = now,
            };

            _context.EtatsDeSortie.Add(existing);
        }
        else
        {
            existing.Title = request.Title.Trim();
            existing.RowsJson = rowsJson;
            existing.FormulasJson = formulasJson;
            existing.IsGenerated = request.IsGenerated;
            existing.UserId = userId;
            existing.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "ETATS_SORTIE_SAVE", "EtatsDeSortie", existing.Id,
            new
            {
                existing.Key,
                existing.Title,
                existing.Mois,
                existing.Annee,
                existing.IsGenerated,
                action = isCreate ? "create" : "update"
            });

        return Ok(new
        {
            existing.Id,
            existing.Key,
            existing.Title,
            existing.Mois,
            existing.Annee,
            existing.RowsJson,
            existing.FormulasJson,
            existing.IsGenerated,
            existing.CreatedAt,
            existing.UpdatedAt,
            existing.UserId
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized();

        var recap = await _context.EtatsDeSortie.FirstOrDefaultAsync(r => r.Id == id);
        if (recap is null) return NotFound(new { message = "Recap introuvable." });

        var role = await GetCurrentUserRoleAsync(userId);

        var canDelete = role == "admin"
            || recap.UserId == userId
            || (role is "finance" or "comptabilite");

        if (!canDelete)
            return Forbid();

        _context.EtatsDeSortie.Remove(recap);
        await _context.SaveChangesAsync();

        await _auditService.LogAction(userId, "ETATS_SORTIE_DELETE", "EtatsDeSortie", recap.Id,
            new { recap.Key, recap.Mois, recap.Annee });

        return Ok(new { message = "Recap supprimé." });
    }

    [HttpPost("{id:int}/print")]
    public async Task<IActionResult> LogPrint(int id)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized();

        var recap = await _context.EtatsDeSortie
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);

        if (recap is null) return NotFound(new { message = "Recap introuvable." });

        var role = await GetCurrentUserRoleAsync(userId);
        var canPrint = role == "admin"
            || role == "finance"
            || role == "comptabilite"
            || recap.UserId == userId;

        if (!canPrint)
            return Forbid();

        await _auditService.LogAction(userId, "ETATS_SORTIE_PRINT", "EtatsDeSortie", recap.Id,
            new { recap.Key, recap.Mois, recap.Annee });

        return Ok(new { message = "Impression enregistrée dans l'audit." });
    }
}

public class EtatsDeSortieSaveRequest
{
    public string Key { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Mois { get; set; } = string.Empty;
    public string Annee { get; set; } = string.Empty;
    public JsonElement Rows { get; set; }
    public JsonElement Formulas { get; set; }
    public bool IsGenerated { get; set; } = true;
}
