using CheckFillingAPI.Data;
using CheckFillingAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace CheckFillingAPI.Services;

public class CheckService : ICheckService
{
    private readonly AppDbContext _context;

    public CheckService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Check>> GetAllChecksAsync()
    {
        return await _context.Checks
            .Include(c => c.User)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<Check>> GetChecksByUserIdAsync(int userId)
    {
        return await _context.Checks
            .Include(c => c.User)
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
    }

    public async Task<Check?> GetCheckByIdAsync(string reference)
    {
        return await _context.Checks
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.Reference == reference);
    }

    public async Task<Check> CreateCheckAsync(Check check)
    {
        check.CreatedAt = DateTime.UtcNow;
        check.Status = "emit"; // Statut par défaut
        _context.Checks.Add(check);
        await _context.SaveChangesAsync();
        return check;
    }

    public async Task<Check?> UpdateCheckStatusAsync(string reference, string newStatus, string? motif)
    {
        Console.WriteLine($"[CheckService.UpdateStatus] Check Reference={reference}, Current Status=?, New Status={newStatus}, Motif={motif}");
        
        var check = await _context.Checks.FindAsync(reference);
        if (check == null)
        {
            Console.WriteLine($"[CheckService.UpdateStatus] Check {reference} not found");
            return null;
        }
        
        Console.WriteLine($"[CheckService.UpdateStatus] Check {reference} found with current status '{check.Status}'");

        // Validation des transitions de statut
        var validStatuses = new[] { "emit", "annule", "rejete" };
        if (!validStatuses.Contains(newStatus))
        {
            Console.WriteLine($"[CheckService.UpdateStatus] Invalid status '{newStatus}'");
            throw new ArgumentException($"Statut invalide: {newStatus}. Les statuts valides sont: emit, annule, rejete");
        }

        // Interdire le retour vers "emit" depuis "annule" ou "rejete"
        if (check.Status != "emit" && newStatus == "emit")
        {
            Console.WriteLine($"[CheckService.UpdateStatus] Cannot revert from '{check.Status}' to 'emit'");
            throw new InvalidOperationException($"Impossible de revenir au statut 'emit' depuis '{check.Status}'");
        }

        // Si changement vers "annule", un motif est requis
        if (newStatus == "annule" && string.IsNullOrWhiteSpace(motif))
        {
            Console.WriteLine($"[CheckService.UpdateStatus] Motif is required for annulation");
            throw new ArgumentException("Un motif est requis pour annuler un chèque");
        }

        Console.WriteLine($"[CheckService.UpdateStatus] Updating check {reference} from '{check.Status}' to '{newStatus}'");
        check.Status = newStatus;
        check.Motif = motif;

        await _context.SaveChangesAsync();
        Console.WriteLine($"[CheckService.UpdateStatus] Check {reference} saved successfully");
        return check;
    }

    public async Task<object> GetStatsAsync()
    {
        // Ne compter que les chèques avec statut "emit"
        var checks = await _context.Checks
            .Include(c => c.User)
            .Include(c => c.Checkbook)
                .ThenInclude(cb => cb!.Bank)
            .ToListAsync();
            
        var activeChecks = checks.Where(c => c.Status == "emit").ToList();
        
        var users = await _context.Users.ToListAsync();

        var totalAmount = activeChecks.Sum(c => c.Amount);
        var totalChecks = activeChecks.Count;
        
        // Statistiques par statut
        var emittedChecks = checks.Count(c => c.Status == "emit");
        var canceledChecks = checks.Count(c => c.Status == "annule");
        var rejectedChecks = checks.Count(c => c.Status == "rejete");

        var checksByBank = activeChecks
            .GroupBy(c => c.Checkbook?.Bank?.Name ?? "Inconnu")
            .ToDictionary(g => g.Key, g => g.Count());

        var amountByUser = activeChecks
            .GroupBy(c => c.UserId)
            .ToDictionary(g => g.Key, g => g.Sum(c => c.Amount));

        return new
        {
            totalAmount,
            totalChecks,
            emittedChecks,
            canceledChecks,
            rejectedChecks,
            checksByBank,
            amountByUser
        };
    }
}
