namespace TableauDeBord.Api.Options;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public string ConnectionString { get; set; } = "Server=localhost;Database=TabDeBord;Trusted_Connection=True;TrustServerCertificate=True;";
    public string Schema { get; set; } = "dbo";
    public string UserTable { get; set; } = "user";
    public string IdColumn { get; set; } = "id";
    public string EmailColumn { get; set; } = "email";
    public string PasswordColumn { get; set; } = "password";
    public string RoleColumn { get; set; } = "role";
    public string DisplayNameColumn { get; set; } = "name";
    public bool PasswordIsHashedWithBcrypt { get; set; } = false;
}
