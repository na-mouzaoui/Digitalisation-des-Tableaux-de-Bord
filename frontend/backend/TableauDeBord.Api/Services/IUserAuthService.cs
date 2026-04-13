using TableauDeBord.Api.Models.Auth;

namespace TableauDeBord.Api.Services;

public interface IUserAuthService
{
    Task<LoginResponse?> LoginAsync(string emailOrLogin, string password, CancellationToken cancellationToken = default);
    Task<AuthUserDto?> GetCurrentUserAsync(string userId, CancellationToken cancellationToken = default);
    Task<bool> ChangePasswordAsync(string userId, string currentPassword, string newPassword, CancellationToken cancellationToken = default);
}
