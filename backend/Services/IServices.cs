using CheckFillingAPI.Models;

namespace CheckFillingAPI.Services;

public interface IAuthService
{
    Task<(bool Success, string? Token, User? User)> LoginAsync(string email, string password);
    Task<(bool Success, User? User)> RegisterAsync(string email, string password);
    string GenerateJwtToken(User user);
    Task<User?> GetUserByIdAsync(int userId);
    Task<bool> ChangePasswordAsync(int userId, string newPassword);
}

public interface IBankService
{
    Task<IEnumerable<Bank>> GetAllBanksAsync();
    Task<Bank?> GetBankByIdAsync(int id);
    Task<Bank> CreateBankAsync(Bank bank, IFormFile? pdfFile);
    Task<Bank?> UpdateBankAsync(int id, Bank bank, IFormFile? pdfFile);
    Task<bool> DeleteBankAsync(int id);
    Task<Bank?> UpdateBankPositionsAsync(int id, BankPositions positions);
    Task<UserBankCalibration?> GetUserCalibrationAsync(int userId, int bankId);
    Task<UserBankCalibration> SaveUserCalibrationAsync(int userId, int bankId, BankPositions positions);
}

public interface ICheckService
{
    Task<IEnumerable<Check>> GetAllChecksAsync();
    Task<IEnumerable<Check>> GetChecksByUserIdAsync(int userId);
    Task<Check?> GetCheckByIdAsync(string reference);
    Task<Check> CreateCheckAsync(Check check);
    Task<Check?> UpdateCheckStatusAsync(string reference, string newStatus, string? motif);
    Task<object> GetStatsAsync();
}

public interface ISupplierService
{
    Task<IEnumerable<Supplier>> GetAllSuppliersAsync();
    Task<Supplier?> GetSupplierByIdAsync(int id);
    Task<Supplier> CreateSupplierAsync(Supplier supplier);
    Task<Supplier?> UpdateSupplierAsync(int id, Supplier supplier);
    Task<bool> DeleteSupplierAsync(int id);
    Task<bool> SupplierNameExistsAsync(string name, int? exceptId = null);
}
