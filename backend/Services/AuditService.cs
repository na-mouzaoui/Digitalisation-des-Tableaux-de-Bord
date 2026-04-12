using CheckFillingAPI.Data;
using CheckFillingAPI.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace CheckFillingAPI.Services;

public interface IAuditService
{
    Task LogAction(int userId, string action, string entityType, int? entityId, object? details);
    Task<IEnumerable<AuditLog>> GetAuditLogs(int? userId = null, string? action = null, DateTime? from = null, DateTime? to = null);
}

public class AuditService : IAuditService
{
    private readonly AppDbContext _context;

    public AuditService(AppDbContext context)
    {
        _context = context;
    }

    public async Task LogAction(int userId, string action, string entityType, int? entityId, object? details)
    {
        var auditLog = new AuditLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details != null ? JsonSerializer.Serialize(details) : "{}",
            CreatedAt = DateTime.UtcNow
        };

        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<AuditLog>> GetAuditLogs(int? userId = null, string? action = null, DateTime? from = null, DateTime? to = null)
    {
        var query = _context.AuditLogs.Include(a => a.User).AsQueryable();

        if (userId.HasValue)
            query = query.Where(a => a.UserId == userId.Value);

        if (!string.IsNullOrEmpty(action))
            query = query.Where(a => a.Action == action);

        if (from.HasValue)
            query = query.Where(a => a.CreatedAt >= from.Value);

        if (to.HasValue)
            query = query.Where(a => a.CreatedAt <= to.Value);

        return await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
    }
}
