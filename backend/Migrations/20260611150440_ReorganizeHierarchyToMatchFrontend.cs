using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    public partial class ReorganizeHierarchyToMatchFrontend : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- ============================================================
-- 1) DVDRS: Move 4G/5G KPIs under 'Reseau technique' (SD 9)
--    then delete separate SD 29, 30
--    then rename SD 9 to match frontend
-- ============================================================

UPDATE [Kpis] SET [SousDomaineId] = 9 WHERE [Id] IN (46, 47);

DELETE FROM [SousDomaines] WHERE [Id] IN (29, 30);

UPDATE [SousDomaines] SET [Designation] = N'Réseau technique' WHERE [Id] = 9;

-- Delete leftover/orphan KPIs amelioration_qualite and couverture_reseau (only 1 SousKpi each)
DELETE FROM [SousKpis] WHERE [KpiId] IN (16, 17);
DELETE FROM [Kpis] WHERE [Id] IN (16, 17);

-- ============================================================
-- 2) DQRPC: Rename SD 10 to match frontend
-- ============================================================

UPDATE [SousDomaines] SET [Designation] = N'Qualité Réseau' WHERE [Id] = 10;

-- ============================================================
-- 3) FINANCES: Add 'Finance DFC' SD with KPIs avancement_engagement & tresorerie
-- ============================================================

DECLARE @FinancesId INT = (SELECT TOP 1 [Id] FROM [Domaines] WHERE [Designation] = N'Finances');

IF NOT EXISTS (SELECT 1 FROM [SousDomaines] WHERE [DomaineId] = @FinancesId AND [Designation] = N'Finance DFC')
BEGIN
    SET IDENTITY_INSERT [SousDomaines] ON;
    INSERT INTO [SousDomaines] ([Id], [DomaineId], [Designation])
    VALUES (31, @FinancesId, N'Finance DFC');
    SET IDENTITY_INSERT [SousDomaines] OFF;
END;

DECLARE @FinanceDfcId INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @FinancesId AND [Designation] = N'Finance DFC');

-- KPI 48: avancement_engagement
IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [Nom] = N'avancement_engagement')
BEGIN
    SET IDENTITY_INSERT [Kpis] ON;
    INSERT INTO [Kpis] ([Id], [SousDomaineId], [Nom]) VALUES (48, @FinanceDfcId, N'avancement_engagement');
    SET IDENTITY_INSERT [Kpis] OFF;
END;

IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 48)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (681, 48, N'Montant de l''investissement', 0),
    (682, 48, N'Dépenses engagées', 1),
    (683, 48, N'Taux d''engagement', 2),
    (684, 48, N'Droits de Douane Exonorés', 3),
    (685, 48, N'TVA Exonérée', 4),
    (686, 48, N'Total des emplois créés', 5);
    SET IDENTITY_INSERT [SousKpis] OFF;
END;

-- KPI 49: tresorerie
IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [Nom] = N'tresorerie')
BEGIN
    SET IDENTITY_INSERT [Kpis] ON;
    INSERT INTO [Kpis] ([Id], [SousDomaineId], [Nom]) VALUES (49, @FinanceDfcId, N'tresorerie');
    SET IDENTITY_INSERT [Kpis] OFF;
END;

IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 49)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (687, 49, N'Trésorerie disponible', 0),
    (688, 49, N'Flux entrants', 1),
    (689, 49, N'Flux sortants', 2),
    (690, 49, N'Solde net', 3);
    SET IDENTITY_INSERT [SousKpis] OFF;
END;

-- ============================================================
-- 4) REGIONALE: Add 'Commercial' SD with KPIs realisations_commerciales & reseau_distribution
-- ============================================================

DECLARE @RegionaleId INT = (SELECT TOP 1 [Id] FROM [Domaines] WHERE [Designation] = N'Regionale');

IF NOT EXISTS (SELECT 1 FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Commercial')
BEGIN
    SET IDENTITY_INSERT [SousDomaines] ON;
    INSERT INTO [SousDomaines] ([Id], [DomaineId], [Designation])
    VALUES (32, @RegionaleId, N'Commercial');
    SET IDENTITY_INSERT [SousDomaines] OFF;
END;

DECLARE @RegionaleCommercialId INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Commercial');

-- KPI 50: realisations_commerciales
IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [Nom] = N'realisations_commerciales')
BEGIN
    SET IDENTITY_INSERT [Kpis] ON;
    INSERT INTO [Kpis] ([Id], [SousDomaineId], [Nom]) VALUES (50, @RegionaleCommercialId, N'realisations_commerciales');
    SET IDENTITY_INSERT [Kpis] OFF;
END;

IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 50)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (691, 50, N'Chiffre d''Affaires', 0),
    (692, 50, N'Activation SIM', 1),
    (693, 50, N'Stock SIM', 2),
    (694, 50, N'Stock Carte de Recharge', 3);
    SET IDENTITY_INSERT [SousKpis] OFF;
END;

-- KPI 51: reseau_distribution
IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [Nom] = N'reseau_distribution')
BEGIN
    SET IDENTITY_INSERT [Kpis] ON;
    INSERT INTO [Kpis] ([Id], [SousDomaineId], [Nom]) VALUES (51, @RegionaleCommercialId, N'reseau_distribution');
    SET IDENTITY_INSERT [Kpis] OFF;
END;

IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 51)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (695, 51, N'Nombre Agences', 0),
    (696, 51, N'Points de vente Agréés', 1),
    (697, 51, N'Points de Vente Arsseli', 2),
    (698, 51, N'Points de Présence VI', 3);
    SET IDENTITY_INSERT [SousKpis] OFF;
END;

-- ============================================================
-- 5) COMMERCIAL: Fix SousDomaine names to match frontend
-- ============================================================

UPDATE [SousDomaines] SET [Designation] = N'Parc Abonné' WHERE [Id] = 6;
UPDATE [SousDomaines] SET [Designation] = N'Réclamation' WHERE [Id] = 1;
UPDATE [SousDomaines] SET [Designation] = N'Chiffre d''affaires' WHERE [Id] = 8;

-- ============================================================
-- 6) SUPPORT: Fix SD name accents
-- ============================================================

UPDATE [SousDomaines] SET [Designation] = N'Créances contentieuses' WHERE [Id] = 11;

PRINT N'Réorganisation terminée.';
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Revert regionale: delete Commercial SD and its KPIs
DELETE FROM [SousKpis] WHERE [KpiId] IN (50, 51);
DELETE FROM [Kpis] WHERE [Id] IN (50, 51);
DELETE FROM [SousDomaines] WHERE [Id] = 32;

-- Revert finances: delete Finance DFC SD and its KPIs
DELETE FROM [SousKpis] WHERE [KpiId] IN (48, 49);
DELETE FROM [Kpis] WHERE [Id] IN (48, 49);
DELETE FROM [SousDomaines] WHERE [Id] = 31;

-- Restore commercial SD names
UPDATE [SousDomaines] SET [Designation] = N'Parc Abonne' WHERE [Id] = 6;
UPDATE [SousDomaines] SET [Designation] = N'Reclamation' WHERE [Id] = 1;
UPDATE [SousDomaines] SET [Designation] = N'Chiffre d''Affaires' WHERE [Id] = 8;

-- Restore support SD name
UPDATE [SousDomaines] SET [Designation] = N'Creances contentieuses' WHERE [Id] = 11;

-- Restore DVDRS SD name
UPDATE [SousDomaines] SET [Designation] = N'Reseau technique' WHERE [Id] = 9;

-- Restore DQRPC SD name
UPDATE [SousDomaines] SET [Designation] = N'Qualite reseau' WHERE [Id] = 10;

-- Recreate SD 29, 30 and move KPIs back
SET IDENTITY_INSERT [SousDomaines] ON;
INSERT INTO [SousDomaines] ([Id], [DomaineId], [Designation]) VALUES
    (29, 2, N'Amelioration Qualite 4G'),
    (30, 2, N'Amelioration Qualite 5G');
SET IDENTITY_INSERT [SousDomaines] OFF;

UPDATE [Kpis] SET [SousDomaineId] = 29 WHERE [Id] = 46;
UPDATE [Kpis] SET [SousDomaineId] = 30 WHERE [Id] = 47;
");
        }
    }
}
