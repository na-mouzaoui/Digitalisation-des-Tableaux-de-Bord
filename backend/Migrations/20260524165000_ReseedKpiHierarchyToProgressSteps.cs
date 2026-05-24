using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    public partial class ReseedKpiHierarchyToProgressSteps : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE [SousDomaines] SET [DomaineId] = 1, [Designation] = N'Reclamation' WHERE [Id] = 1;
UPDATE [SousDomaines] SET [DomaineId] = 1, [Designation] = N'E-payment' WHERE [Id] = 2;
UPDATE [SousDomaines] SET [DomaineId] = 1, [Designation] = N'Encaissement' WHERE [Id] = 3;
UPDATE [SousDomaines] SET [DomaineId] = 1, [Designation] = N'Rechargement' WHERE [Id] = 4;
UPDATE [SousDomaines] SET [DomaineId] = 1, [Designation] = N'Recouvrement' WHERE [Id] = 5;
UPDATE [SousDomaines] SET [DomaineId] = 1, [Designation] = N'Parc Abonne' WHERE [Id] = 6;
UPDATE [SousDomaines] SET [DomaineId] = 1, [Designation] = N'Activation-Desactivation SIM' WHERE [Id] = 7;
UPDATE [SousDomaines] SET [DomaineId] = 1, [Designation] = N'Chiffre d''Affaires' WHERE [Id] = 8;
UPDATE [SousDomaines] SET [DomaineId] = 2, [Designation] = N'Reseau technique' WHERE [Id] = 9;
UPDATE [SousDomaines] SET [DomaineId] = 3, [Designation] = N'Qualite reseau' WHERE [Id] = 10;
UPDATE [SousDomaines] SET [DomaineId] = 4, [Designation] = N'Creances contentieuses' WHERE [Id] = 11;
UPDATE [SousDomaines] SET [DomaineId] = 4, [Designation] = N'RH' WHERE [Id] = 12;
UPDATE [SousDomaines] SET [DomaineId] = 4, [Designation] = N'Formation' WHERE [Id] = 13;
UPDATE [SousDomaines] SET [DomaineId] = 5, [Designation] = N'Finance DCG' WHERE [Id] = 14;
UPDATE [SousDomaines] SET [DomaineId] = 5, [Designation] = N'Finance DFC' WHERE [Id] = 15;
UPDATE [SousDomaines] SET [DomaineId] = 6, [Designation] = N'Reseau' WHERE [Id] = 16;

UPDATE [Kpis] SET [SousDomaineId] = 1 WHERE [Id] = 1;
UPDATE [Kpis] SET [SousDomaineId] = 2 WHERE [Id] IN (2, 3);
UPDATE [Kpis] SET [SousDomaineId] = 3 WHERE [Id] = 4;
UPDATE [Kpis] SET [SousDomaineId] = 4 WHERE [Id] = 5;
UPDATE [Kpis] SET [SousDomaineId] = 5 WHERE [Id] = 6;
UPDATE [Kpis] SET [SousDomaineId] = 6 WHERE [Id] IN (7, 8, 9, 10);
UPDATE [Kpis] SET [SousDomaineId] = 7 WHERE [Id] IN (11, 12, 13);
UPDATE [Kpis] SET [SousDomaineId] = 8 WHERE [Id] = 14;
UPDATE [Kpis] SET [SousDomaineId] = 9 WHERE [Id] IN (15, 16, 17, 18, 19, 20);
UPDATE [Kpis] SET [SousDomaineId] = 10 WHERE [Id] IN (21, 22);
UPDATE [Kpis] SET [SousDomaineId] = 11 WHERE [Id] = 23;
UPDATE [Kpis] SET [SousDomaineId] = 12 WHERE [Id] IN (24, 25, 26, 27, 28);
UPDATE [Kpis] SET [SousDomaineId] = 13 WHERE [Id] IN (29, 30, 31);
UPDATE [Kpis] SET [SousDomaineId] = 14 WHERE [Id] IN (32, 33);
UPDATE [Kpis] SET [SousDomaineId] = 15 WHERE [Id] = 34;
UPDATE [Kpis] SET [SousDomaineId] = 16 WHERE [Id] IN (35, 36, 37);

DELETE FROM [SousDomaines] WHERE [Id] > 16;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM [SousKpis];
DELETE FROM [Kpis];
DELETE FROM [SousDomaines];
DELETE FROM [Domaines];
");
        }
    }
}