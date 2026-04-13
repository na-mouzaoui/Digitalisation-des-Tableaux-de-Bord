namespace TableauDeBord.Api.Services;

internal sealed class DbUserRecord
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
    public string Name { get; set; } = string.Empty;
}
