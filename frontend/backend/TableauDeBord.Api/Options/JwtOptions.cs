namespace TableauDeBord.Api.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = "CHANGE_ME_MINIMUM_16_CHARS";
    public string Issuer { get; set; } = "TableauDeBord.Api";
    public string Audience { get; set; } = "TableauDeBord.Frontend";
    public int ExpiryMinutes { get; set; } = 480;
}
