namespace TableauDeBord.Api.Models.Auth;

public sealed class AuthUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
    public string Name { get; set; } = string.Empty;
}
