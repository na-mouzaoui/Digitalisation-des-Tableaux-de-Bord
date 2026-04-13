namespace TableauDeBord.Api.Models.Auth;

public sealed class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public AuthUserDto User { get; set; } = new();
}
