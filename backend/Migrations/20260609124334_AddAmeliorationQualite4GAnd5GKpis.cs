using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAmeliorationQualite4GAnd5GKpis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
SET IDENTITY_INSERT [dbo].[SousDomaines] ON;
INSERT INTO [dbo].[SousDomaines] ([Id], [DomaineId], [Designation]) VALUES
    (29, 2, N'Amelioration Qualite 4G'),
    (30, 2, N'Amelioration Qualite 5G');
SET IDENTITY_INSERT [dbo].[SousDomaines] OFF;

SET IDENTITY_INSERT [dbo].[Kpis] ON;
INSERT INTO [dbo].[Kpis] ([Id], [SousDomaineId], [Nom]) VALUES
    (46, 29, N'amelioration_qualite_4g'),
    (47, 30, N'amelioration_qualite_5g');
SET IDENTITY_INSERT [dbo].[Kpis] OFF;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM [dbo].[Valeurs] WHERE [Id_SousKpi] IN (SELECT [Id] FROM [dbo].[SousKpis] WHERE [KpiId] IN (46, 47));
DELETE FROM [dbo].[SousKpis] WHERE [KpiId] IN (46, 47);
DELETE FROM [dbo].[Kpis] WHERE [Id] IN (46, 47);
DELETE FROM [dbo].[SousDomaines] WHERE [Id] IN (29, 30);
");
        }
    }
}
