using CheckFillingAPI.Data;
using CheckFillingAPI.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace CheckFillingAPI.Services;

public class BankService : IBankService
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public BankService(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    public async Task<IEnumerable<Bank>> GetAllBanksAsync()
    {
        return await _context.Banks.ToListAsync();
    }

    public async Task<Bank?> GetBankByIdAsync(int id)
    {
        return await _context.Banks.FindAsync(id);
    }

    public async Task<Bank> CreateBankAsync(Bank bank, IFormFile? pdfFile)
    {
        if (pdfFile != null)
        {
            bank.PdfUrl = await SavePdfFileAsync(pdfFile, bank.Code);
        }

        _context.Banks.Add(bank);
        await _context.SaveChangesAsync();
        return bank;
    }

    public async Task<Bank?> UpdateBankAsync(int id, Bank bank, IFormFile? pdfFile)
    {
        var existingBank = await _context.Banks.FindAsync(id);
        if (existingBank == null) return null;

        existingBank.Code = bank.Code;
        existingBank.Name = bank.Name;

        if (pdfFile != null)
        {
            existingBank.PdfUrl = await SavePdfFileAsync(pdfFile, bank.Code);
        }

        if (!string.IsNullOrEmpty(bank.PositionsJson))
        {
            existingBank.PositionsJson = bank.PositionsJson;
        }

        await _context.SaveChangesAsync();
        return existingBank;
    }

    public async Task<bool> DeleteBankAsync(int id)
    {
        var bank = await _context.Banks.FindAsync(id);
        if (bank == null) return false;

        // Get all checkbooks associated with this bank
        var checkbooks = await _context.Checkbooks.Where(c => c.BankId == id).ToListAsync();
        
        if (checkbooks.Any())
        {
            var checkbookIds = checkbooks.Select(cb => cb.Id).ToList();
            
            // Delete all checks associated with these checkbooks first
            var checks = await _context.Checks.Where(c => checkbookIds.Contains(c.CheckbookId ?? 0)).ToListAsync();
            if (checks.Any())
            {
                _context.Checks.RemoveRange(checks);
            }
            
            // Then delete the checkbooks
            _context.Checkbooks.RemoveRange(checkbooks);
        }

        // Finally delete the bank
        _context.Banks.Remove(bank);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<Bank?> UpdateBankPositionsAsync(int id, BankPositions positions)
    {
        var bank = await _context.Banks.FindAsync(id);
        if (bank == null) return null;

        bank.PositionsJson = JsonSerializer.Serialize(positions);
        await _context.SaveChangesAsync();
        return bank;
    }

    public async Task<UserBankCalibration?> GetUserCalibrationAsync(int userId, int bankId)
    {
        return await _context.UserBankCalibrations
            .FirstOrDefaultAsync(c => c.UserId == userId && c.BankId == bankId);
    }

    public async Task<UserBankCalibration> SaveUserCalibrationAsync(int userId, int bankId, BankPositions positions)
    {
        var calibration = await _context.UserBankCalibrations
            .FirstOrDefaultAsync(c => c.UserId == userId && c.BankId == bankId);

        var positionsJson = JsonSerializer.Serialize(positions);

        if (calibration == null)
        {
            // Create new calibration
            calibration = new UserBankCalibration
            {
                UserId = userId,
                BankId = bankId,
                PositionsJson = positionsJson,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.UserBankCalibrations.Add(calibration);
        }
        else
        {
            // Update existing calibration
            calibration.PositionsJson = positionsJson;
            calibration.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return calibration;
    }

    private async Task<string> SavePdfFileAsync(IFormFile file, string bankCode)
    {
        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");
        Directory.CreateDirectory(uploadsFolder);

        var fileName = $"{bankCode}-{DateTime.Now.Ticks}.pdf";
        var filePath = Path.Combine(uploadsFolder, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return $"/uploads/{fileName}";
    }
}
