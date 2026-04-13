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
