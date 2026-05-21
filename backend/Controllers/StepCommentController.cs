using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DigitalisationDesTableauxDeBordAPI.Data;
using DigitalisationDesTableauxDeBordAPI.Models;
using Microsoft.EntityFrameworkCore;

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

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string tabKey, [FromQuery] string mois, [FromQuery] string annee, [FromQuery] string direction)
    {
        var comment = await _context.StepComments
            .AsNoTracking()
            .Where(c => c.TabKey == tabKey && c.Mois == mois && c.Annee == annee && c.Direction == direction)
            .FirstOrDefaultAsync();

        if (comment == null)
            return Ok(new { comment = "" });

        return Ok(new { comment = comment.Comment });
    }

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] StepCommentRequest request)
    {
        var existing = await _context.StepComments
            .FirstOrDefaultAsync(c =>
                c.TabKey == request.TabKey &&
                c.Mois == request.Mois &&
                c.Annee == request.Annee &&
                c.Direction == request.Direction);

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
                Direction = request.Direction,
                Comment = request.Comment ?? "",
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }
}

public record StepCommentRequest(string TabKey, string Mois, string Annee, string Direction, string? Comment);
