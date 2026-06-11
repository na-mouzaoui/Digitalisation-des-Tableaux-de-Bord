using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddImpactMttrKpi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Ajouter le KPI impact_mttr sous Qualite reseau (SousDomaineId = 10)
SET IDENTITY_INSERT [Kpis] ON;
INSERT INTO [Kpis] ([Id], [SousDomaineId], [Nom]) VALUES (45, 10, N'impact_mttr');
SET IDENTITY_INSERT [Kpis] OFF;

-- Ajouter les SousKpis (8 DRs)
SET IDENTITY_INSERT [SousKpis] ON;
INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
(603, 45, N'DR Alger', 0),
(604, 45, N'DR Oran', 1),
(605, 45, N'DR Constantine', 2),
(606, 45, N'DR Setif', 3),
(607, 45, N'DR Ouargla', 4),
(608, 45, N'DR Bechar', 5),
(609, 45, N'DR Annaba', 6),
(610, 45, N'DR Chlef', 7);
SET IDENTITY_INSERT [SousKpis] OFF;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM [SousKpis] WHERE [KpiId] = 45;
DELETE FROM [Kpis] WHERE [Id] = 45;
");
        }
    }
}
