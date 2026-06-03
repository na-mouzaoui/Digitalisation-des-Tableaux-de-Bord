using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DigitalisationDesTableauxDeBordAPI.Data;
using DigitalisationDesTableauxDeBordAPI.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DigitalisationDesTableauxDeBordAPI.Controllers;

[ApiController]
[Route("api/step-comment")]
[Authorize]
public class StepCommentController : ControllerBase
{
    private readonly AppDbContext _context;

    public StepCommentController(AppDbContext context)
    {
        _context = context;
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.Parse(userIdClaim ?? "0");
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string tabKey, [FromQuery] string mois, [FromQuery] string annee)
    {
        var userId = GetCurrentUserId();

        var comment = await _context.StepComments
            .AsNoTracking()
            .Where(c => c.TabKey == tabKey && c.Mois == mois && c.Annee == annee && c.UserId == userId)
            .FirstOrDefaultAsync();

        if (comment == null)
            return Ok(new { comment = "" });

        return Ok(new { comment = comment.Comment });
    }

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] StepCommentRequest request)
    {
        var userId = GetCurrentUserId();

        var existing = await _context.StepComments
            .FirstOrDefaultAsync(c =>
                c.TabKey == request.TabKey &&
                c.Mois == request.Mois &&
                c.Annee == request.Annee &&
                c.UserId == userId);

        if (existing != null)
        {
            existing.Comment = request.Comment ?? "";
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.StepComments.Add(new StepComment
            {
                TabKey = request.TabKey,
                Mois = request.Mois,
                Annee = request.Annee,
                UserId = userId,
                Comment = request.Comment ?? "",
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] string tabKey, [FromQuery] string mois, [FromQuery] string annee)
    {
        var userId = GetCurrentUserId();

        var existing = await _context.StepComments
            .FirstOrDefaultAsync(c =>
                c.TabKey == tabKey &&
                c.Mois == mois &&
                c.Annee == annee &&
                c.UserId == userId);

        if (existing == null)
            return NotFound(new { success = false, message = "Commentaire introuvable" });

        _context.StepComments.Remove(existing);
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent([FromQuery] int limit = 20)
    {
        var comments = await _context.StepComments
            .AsNoTracking()
            .Include(c => c.User)
            .OrderByDescending(c => c.UpdatedAt)
            .Take(limit)
            .ToListAsync();

        var tabKeys = comments.Select(c => c.TabKey).Distinct().ToList();
        var kpiMap = await _context.Kpis
            .AsNoTracking()
            .Where(k => tabKeys.Contains(k.Nom))
            .Include(k => k.SousDomaine)
            .ThenInclude(sd => sd.Domaine)
            .ToDictionaryAsync(k => k.Nom, k => new { k.SousDomaine.Designation, Domaine = k.SousDomaine.Domaine.Designation });

        var result = comments.Select(c => new RecentCommentResponse(
            c.Id,
            c.TabKey,
            c.Comment,
            c.Mois,
            c.Annee,
            c.UpdatedAt,
            $"{c.User.FirstName} {c.User.LastName}",
            c.User.Direction,
            kpiMap.GetValueOrDefault(c.TabKey)?.Domaine,
            kpiMap.GetValueOrDefault(c.TabKey)?.Designation
        ));

        return Ok(result);
    }
}

public record StepCommentRequest(string TabKey, string Mois, string Annee, string? Comment);
public record RecentCommentResponse(
    int Id,
    string TabKey,
    string Comment,
    string Mois,
    string Annee,
    DateTime UpdatedAt,
    string UserName,
    string UserDirection,
    string? Domaine,
    string? SousDomaine
);