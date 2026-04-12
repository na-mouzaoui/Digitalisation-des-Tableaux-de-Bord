using CheckFillingAPI.Data;
using CheckFillingAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace CheckFillingAPI.Services;

public class SupplierService : ISupplierService
{
    private readonly AppDbContext _context;

    public SupplierService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Supplier>> GetAllSuppliersAsync()
    {
        return await _context.Suppliers
            .OrderBy(s => s.Name)
            .ToListAsync();
    }

    public async Task<Supplier?> GetSupplierByIdAsync(int id)
    {
        return await _context.Suppliers.FindAsync(id);
    }

    public async Task<Supplier> CreateSupplierAsync(Supplier supplier)
    {
        supplier.CreatedAt = DateTime.UtcNow;
        _context.Suppliers.Add(supplier);
        await _context.SaveChangesAsync();
        return supplier;
    }

    public async Task<Supplier?> UpdateSupplierAsync(int id, Supplier supplier)
    {
        var existing = await _context.Suppliers.FindAsync(id);
        if (existing == null)
            return null;

        existing.Name = supplier.Name;
        existing.CompanyType = supplier.CompanyType;
        existing.Email = supplier.Email;
        existing.Phone = supplier.Phone;
        existing.Address = supplier.Address;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteSupplierAsync(int id)
    {
        var supplier = await _context.Suppliers.FindAsync(id);
        if (supplier == null)
            return false;

        _context.Suppliers.Remove(supplier);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SupplierNameExistsAsync(string name, int? exceptId = null)
    {
        var normalized = name?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(normalized))
            return false;

        return await _context.Suppliers
            .Where(s => !exceptId.HasValue || s.Id != exceptId.Value)
            .AnyAsync(s => s.Name.ToLower() == normalized);
    }
}
