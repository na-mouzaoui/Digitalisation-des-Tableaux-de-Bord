using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TableauDeBord.Api.Models.Auth;
using TableauDeBord.Api.Options;

namespace TableauDeBord.Api.Services;

public sealed class UserAuthService : IUserAuthService
{
    private readonly DatabaseOptions _databaseOptions;
    private readonly JwtOptions _jwtOptions;

    public UserAuthService(IOptions<DatabaseOptions> databaseOptions, IOptions<JwtOptions> jwtOptions)
    {
        _databaseOptions = databaseOptions.Value;
        _jwtOptions = jwtOptions.Value;
    }

    public async Task<LoginResponse?> LoginAsync(string emailOrLogin, string password, CancellationToken cancellationToken = default)
    {
        var user = await GetUserByLoginAsync(emailOrLogin, cancellationToken);
        if (user is null)
        {
            return null;
        }

        if (!VerifyPassword(password, user.Password))
        {
            return null;
        }

        return new LoginResponse
        {
            Token = GenerateJwt(user),
            User = ToAuthUserDto(user)
        };
    }

    public async Task<AuthUserDto?> GetCurrentUserAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await GetUserByIdAsync(userId, cancellationToken);
        return user is null ? null : ToAuthUserDto(user);
    }

    public async Task<bool> ChangePasswordAsync(string userId, string currentPassword, string newPassword, CancellationToken cancellationToken = default)
    {
        var user = await GetUserByIdAsync(userId, cancellationToken);
        if (user is null)
        {
            return false;
        }

        if (!VerifyPassword(currentPassword, user.Password))
        {
            return false;
        }

        var nextPassword = _databaseOptions.PasswordIsHashedWithBcrypt
            ? BCrypt.Net.BCrypt.HashPassword(newPassword)
            : newPassword;

        await using var connection = new SqlConnection(_databaseOptions.ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = $@"
UPDATE {GetQualifiedUserTable()}
SET {Q(_databaseOptions.PasswordColumn)} = @Password
WHERE CAST({Q(_databaseOptions.IdColumn)} AS NVARCHAR(255)) = @Id";

        command.Parameters.Add(new SqlParameter("@Password", SqlDbType.NVarChar, -1) { Value = nextPassword });
        command.Parameters.Add(new SqlParameter("@Id", SqlDbType.NVarChar, 255) { Value = userId });

        var affectedRows = await command.ExecuteNonQueryAsync(cancellationToken);
        return affectedRows > 0;
    }

    private async Task<DbUserRecord?> GetUserByLoginAsync(string emailOrLogin, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(_databaseOptions.ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = $@"
SELECT TOP 1
    CAST({Q(_databaseOptions.IdColumn)} AS NVARCHAR(255)) AS UserId,
    CAST({Q(_databaseOptions.EmailColumn)} AS NVARCHAR(255)) AS UserEmail,
    CAST({Q(_databaseOptions.PasswordColumn)} AS NVARCHAR(255)) AS UserPassword,
    CAST({Q(_databaseOptions.RoleColumn)} AS NVARCHAR(100)) AS UserRole,
    CAST({Q(_databaseOptions.DisplayNameColumn)} AS NVARCHAR(255)) AS UserName
FROM {GetQualifiedUserTable()}
WHERE LOWER(CAST({Q(_databaseOptions.EmailColumn)} AS NVARCHAR(255))) = LOWER(@Login)
   OR LOWER(CAST({Q(_databaseOptions.DisplayNameColumn)} AS NVARCHAR(255))) = LOWER(@Login);";

        command.Parameters.Add(new SqlParameter("@Login", SqlDbType.NVarChar, 255) { Value = emailOrLogin });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return ReadUser(reader);
    }

    private async Task<DbUserRecord?> GetUserByIdAsync(string userId, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(_databaseOptions.ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = $@"
SELECT TOP 1
    CAST({Q(_databaseOptions.IdColumn)} AS NVARCHAR(255)) AS UserId,
    CAST({Q(_databaseOptions.EmailColumn)} AS NVARCHAR(255)) AS UserEmail,
    CAST({Q(_databaseOptions.PasswordColumn)} AS NVARCHAR(255)) AS UserPassword,
    CAST({Q(_databaseOptions.RoleColumn)} AS NVARCHAR(100)) AS UserRole,
    CAST({Q(_databaseOptions.DisplayNameColumn)} AS NVARCHAR(255)) AS UserName
FROM {GetQualifiedUserTable()}
WHERE CAST({Q(_databaseOptions.IdColumn)} AS NVARCHAR(255)) = @Id;";

        command.Parameters.Add(new SqlParameter("@Id", SqlDbType.NVarChar, 255) { Value = userId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return ReadUser(reader);
    }

    private DbUserRecord ReadUser(SqlDataReader reader)
    {
        return new DbUserRecord
        {
            Id = reader["UserId"]?.ToString() ?? string.Empty,
            Email = reader["UserEmail"]?.ToString() ?? string.Empty,
            Password = reader["UserPassword"]?.ToString() ?? string.Empty,
            Role = reader["UserRole"]?.ToString() ?? "user",
            Name = reader["UserName"]?.ToString() ?? string.Empty
        };
    }

    private bool VerifyPassword(string inputPassword, string storedPassword)
    {
        if (_databaseOptions.PasswordIsHashedWithBcrypt)
        {
            return BCrypt.Net.BCrypt.Verify(inputPassword, storedPassword);
        }

        return string.Equals(inputPassword, storedPassword, StringComparison.Ordinal);
    }

    private string GenerateJwt(DbUserRecord user)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Role, user.Role)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_jwtOptions.ExpiryMinutes);

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private AuthUserDto ToAuthUserDto(DbUserRecord user)
    {
        return new AuthUserDto
        {
            Id = user.Id,
            Email = user.Email,
            Role = user.Role,
            Name = user.Name
        };
    }

    private string GetQualifiedUserTable()
    {
        return $"{Q(_databaseOptions.Schema)}.{Q(_databaseOptions.UserTable)}";
    }

    private static string Q(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier) || !IsSafeSqlIdentifier(identifier))
        {
            throw new InvalidOperationException($"Invalid SQL identifier in configuration: '{identifier}'.");
        }

        return $"[{identifier}]";
    }

    private static bool IsSafeSqlIdentifier(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        if (!char.IsLetter(value[0]) && value[0] != '_')
        {
            return false;
        }

        for (var i = 1; i < value.Length; i++)
        {
            if (!char.IsLetterOrDigit(value[i]) && value[i] != '_')
            {
                return false;
            }
        }

        return true;
    }
}
