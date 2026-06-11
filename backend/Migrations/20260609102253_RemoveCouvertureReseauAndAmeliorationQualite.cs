using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCouvertureReseauAndAmeliorationQualite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Supprimer les SousDomaines Couverture Reseau et Amelioration qualite
-- Les FK en cascade suppriment automatiquement :
--   Kpis → SousKpis → Valeurs
DELETE FROM [dbo].[SousDomaines] WHERE [Id] IN (15, 16, 27);

-- Nettoyer les tables legacy si elles existent encore
IF OBJECT_ID(N'[dbo].[Amelioration_Qualite]', N'U') IS NOT NULL
    DROP TABLE [dbo].[Amelioration_Qualite];

IF OBJECT_ID(N'[dbo].[Couverture_Reseau]', N'U') IS NOT NULL
    DROP TABLE [dbo].[Couverture_Reseau];
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Restaurer les SousDomaines
SET IDENTITY_INSERT [dbo].[SousDomaines] ON;
INSERT INTO [dbo].[SousDomaines] ([Id], [DomaineId], [Designation]) VALUES
    (15, 2, N'Amelioration qualite'),
    (16, 2, N'Couverture Reseau'),
    (27, 6, N'Amelioration qualite');
SET IDENTITY_INSERT [dbo].[SousDomaines] OFF;

-- Restaurer les Kpis
SET IDENTITY_INSERT [dbo].[Kpis] ON;
INSERT INTO [dbo].[Kpis] ([Id], [SousDomaineId], [Nom]) VALUES
    (18, 15, N'amelioration_qualite'),
    (19, 16, N'couverture_reseau'),
    (36, 27, N'amelioration_qualite');
SET IDENTITY_INSERT [dbo].[Kpis] OFF;
");
        }
    }
}
