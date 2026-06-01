using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    public partial class UpdateRegionaleSousDomaines : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @RegionaleId INT = (SELECT TOP 1 [Id] FROM [Domaines] WHERE [Designation] = N'Regionale');
IF @RegionaleId IS NULL
BEGIN
    INSERT INTO [Domaines]([Designation]) VALUES (N'Regionale');
    SET @RegionaleId = SCOPE_IDENTITY();
END;

DECLARE @SousDomaines TABLE ([Designation] NVARCHAR(255) NOT NULL);
INSERT INTO @SousDomaines ([Designation]) VALUES
(N'Commerciale DR'),
(N'Genie Civil & Environnement'),
(N'Maintenance & Equipements'),
(N'Nouveaux Sites & Extension Radio'),
(N'MTTR & Debit Internet'),
(N'Recouvrement Contentieux'),
(N'Ressources Humaines'),
(N'Formation'),
(N'Acquisition Terrain & Location Immeuble');

INSERT INTO [SousDomaines]([DomaineId], [Designation])
SELECT @RegionaleId, s.[Designation]
FROM @SousDomaines AS s
WHERE NOT EXISTS (
    SELECT 1 FROM [SousDomaines] sd
    WHERE sd.[DomaineId] = @RegionaleId
      AND sd.[Designation] = s.[Designation]
);

DECLARE @SdCommerciale INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Commerciale DR');
DECLARE @SdGenieCivil INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Genie Civil & Environnement');
DECLARE @SdMaintenance INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Maintenance & Equipements');
DECLARE @SdNouveauxSites INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Nouveaux Sites & Extension Radio');
DECLARE @SdMttrDebit INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'MTTR & Debit Internet');
DECLARE @SdRecouvrement INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Recouvrement Contentieux');
DECLARE @SdRessources INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Ressources Humaines');
DECLARE @SdFormation INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Formation');
DECLARE @SdAcquisition INT = (SELECT TOP 1 [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId AND [Designation] = N'Acquisition Terrain & Location Immeuble');

DECLARE @Keep TABLE ([Nom] NVARCHAR(120) NOT NULL);
INSERT INTO @Keep ([Nom]) VALUES
(N'genie_civil'),
(N'maintenance_equipement'),
(N'nouveaux_sites'),
(N'mttr_debit'),
(N'recouvrement_contentieux'),
(N'ressources_humaines'),
(N'formation'),
(N'acquisition_terrain'),
(N'realisations_commerciales'),
(N'reseau_distribution');

DELETE sk
FROM [SousKpis] AS sk
INNER JOIN [Kpis] AS k ON k.[Id] = sk.[KpiId]
INNER JOIN [SousDomaines] sd ON sd.[Id] = k.[SousDomaineId]
WHERE sd.[DomaineId] = @RegionaleId
  AND k.[Nom] NOT IN (SELECT [Nom] FROM @Keep);

DELETE k
FROM [Kpis] AS k
INNER JOIN [SousDomaines] sd ON sd.[Id] = k.[SousDomaineId]
WHERE sd.[DomaineId] = @RegionaleId
  AND k.[Nom] NOT IN (SELECT [Nom] FROM @Keep);

UPDATE [Kpis] SET [SousDomaineId] = @SdCommerciale
WHERE [Nom] IN (N'realisations_commerciales', N'reseau_distribution')
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

UPDATE [Kpis] SET [SousDomaineId] = @SdGenieCivil
WHERE [Nom] = N'genie_civil'
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

UPDATE [Kpis] SET [SousDomaineId] = @SdMaintenance
WHERE [Nom] = N'maintenance_equipement'
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

UPDATE [Kpis] SET [SousDomaineId] = @SdNouveauxSites
WHERE [Nom] = N'nouveaux_sites'
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

UPDATE [Kpis] SET [SousDomaineId] = @SdMttrDebit
WHERE [Nom] = N'mttr_debit'
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

UPDATE [Kpis] SET [SousDomaineId] = @SdRecouvrement
WHERE [Nom] = N'recouvrement_contentieux'
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

UPDATE [Kpis] SET [SousDomaineId] = @SdRessources
WHERE [Nom] = N'ressources_humaines'
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

UPDATE [Kpis] SET [SousDomaineId] = @SdFormation
WHERE [Nom] = N'formation'
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

UPDATE [Kpis] SET [SousDomaineId] = @SdAcquisition
WHERE [Nom] = N'acquisition_terrain'
  AND [SousDomaineId] IN (SELECT [Id] FROM [SousDomaines] WHERE [DomaineId] = @RegionaleId);

DECLARE @KpiId INT;

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdCommerciale AND [Nom] = N'realisations_commerciales')
    INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdCommerciale, N'realisations_commerciales');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdCommerciale AND [Nom] = N'realisations_commerciales';
DELETE FROM [SousKpis] WHERE [KpiId] = @KpiId;
INSERT INTO [SousKpis]([KpiId], [Designation], [Order]) VALUES
(@KpiId, N'Chiffre d''Affaires', 0),
(@KpiId, N'Activation SIM', 1),
(@KpiId, N'Stock SIM', 2),
(@KpiId, N'Stock Carte de Recharge', 3);

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdCommerciale AND [Nom] = N'reseau_distribution')
    INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdCommerciale, N'reseau_distribution');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdCommerciale AND [Nom] = N'reseau_distribution';
DELETE FROM [SousKpis] WHERE [KpiId] = @KpiId;
INSERT INTO [SousKpis]([KpiId], [Designation], [Order]) VALUES
(@KpiId, N'Nombre Agence', 0),
(@KpiId, N'Nombre Point de vente Agree', 1),
(@KpiId, N'Nombre Point de Vente Arsseli', 2),
(@KpiId, N'Nombre Point de Presence VI', 3);

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdGenieCivil AND [Nom] = N'genie_civil')
    INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdGenieCivil, N'genie_civil');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdGenieCivil AND [Nom] = N'genie_civil';
DELETE FROM [SousKpis] WHERE [KpiId] = @KpiId;
INSERT INTO [SousKpis]([KpiId], [Designation], [Order]) VALUES
(@KpiId, N'Acquisition des nouveaux sites', 0),
(@KpiId, N'Notes de calculs', 1),
(@KpiId, N'Acquisition des nouveaux sites SUCE', 2),
(@KpiId, N'Construction GC des nouveaux sites SUCES', 3),
(@KpiId, N'Construction GC de nouveaux sites', 4),
(@KpiId, N'Renforcement GC', 5);

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdMaintenance AND [Nom] = N'maintenance_equipement')
    INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdMaintenance, N'maintenance_equipement');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdMaintenance AND [Nom] = N'maintenance_equipement';
DELETE FROM [SousKpis] WHERE [KpiId] = @KpiId;
INSERT INTO [SousKpis]([KpiId], [Designation], [Order]) VALUES
(@KpiId, N'Maintenance curative des sites', 0),
(@KpiId, N'Maintenance preventive des sites', 1),
(@KpiId, N'Acquisition de 100 groupes electrogenes de differentes puissances', 2),
(@KpiId, N'Equipements electriques (transfos MT-BT)', 3),
(@KpiId, N'Alimentation des sites SUCE par une solution solaire', 4),
(@KpiId, N'Acquisition des climatiseurs split-systeme pour les sites techniques', 5);

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdNouveauxSites AND [Nom] = N'nouveaux_sites')
    INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdNouveauxSites, N'nouveaux_sites');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdNouveauxSites AND [Nom] = N'nouveaux_sites';
DELETE FROM [SousKpis] WHERE [KpiId] = @KpiId;
INSERT INTO [SousKpis]([KpiId], [Designation], [Order]) VALUES
(@KpiId, N'Nouveaux Sites ON AIR', 0),
(@KpiId, N'Densification du LTE_30Mhz (1800_15+2100_15)', 1),
(@KpiId, N'Ajout de la couche LTE TDD 2300', 2),
(@KpiId, N'Modernisation Module RADIO', 3),
(@KpiId, N'Introduction de la nouvelle technologie 5G + Implementation de la couche LTE TDD 2600', 4),
(@KpiId, N'Ajout de la couche LTE 900', 5),
(@KpiId, N'Nouveaux sites SUCE', 6);

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdRecouvrement AND [Nom] = N'recouvrement_contentieux')
    INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdRecouvrement, N'recouvrement_contentieux');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdRecouvrement AND [Nom] = N'recouvrement_contentieux';
DELETE FROM [SousKpis] WHERE [KpiId] = @KpiId;
INSERT INTO [SousKpis]([KpiId], [Designation], [Order]) VALUES
(@KpiId, N'Envoi LMD', 0);

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdRessources AND [Nom] = N'ressources_humaines')
  INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdRessources, N'ressources_humaines');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdRessources AND [Nom] = N'ressources_humaines';
DELETE FROM [SousKpis] WHERE [KpiId] = @KpiId;
INSERT INTO [SousKpis]([KpiId], [Designation], [Order]) VALUES
(@KpiId, N'Personnel Technique', 0),
(@KpiId, N'Personnel Commerciale', 1),
(@KpiId, N'Personnel Support', 2),
(@KpiId, N'Effectifs Total', 3),
(@KpiId, N'Taux d''Absentéisme', 4);

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdFormation AND [Nom] = N'formation')
  INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdFormation, N'formation');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdFormation AND [Nom] = N'formation';
DELETE FROM [SousKpis] WHERE [KpiId] = @KpiId;
INSERT INTO [SousKpis]([KpiId], [Designation], [Order]) VALUES
(@KpiId, N'Nombre Effectifs Formés', 0),
(@KpiId, N'Nombre de Formations Réalisées', 1);

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdMttrDebit AND [Nom] = N'mttr_debit')
  INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdMttrDebit, N'mttr_debit');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdMttrDebit AND [Nom] = N'mttr_debit';
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = @KpiId)
BEGIN
  INSERT INTO [SousKpis]([KpiId], [Designation], [Order])
  SELECT @KpiId, w.[nom], ROW_NUMBER() OVER (ORDER BY TRY_CONVERT(int, w.[code]), w.[nom]) - 1
  FROM [Wilaya] AS w
  WHERE LTRIM(RTRIM(ISNULL(w.[nom], N''))) <> N'';
END;

IF NOT EXISTS (SELECT 1 FROM [Kpis] WHERE [SousDomaineId] = @SdAcquisition AND [Nom] = N'acquisition_terrain')
  INSERT INTO [Kpis]([SousDomaineId], [Nom]) VALUES (@SdAcquisition, N'acquisition_terrain');
SELECT @KpiId = [Id] FROM [Kpis] WHERE [SousDomaineId] = @SdAcquisition AND [Nom] = N'acquisition_terrain';
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = @KpiId)
BEGIN
  INSERT INTO [SousKpis]([KpiId], [Designation], [Order])
  SELECT @KpiId, w.[nom], ROW_NUMBER() OVER (ORDER BY TRY_CONVERT(int, w.[code]), w.[nom]) - 1
  FROM [Wilaya] AS w
  WHERE LTRIM(RTRIM(ISNULL(w.[nom], N''))) <> N'';
END;

DELETE sd
FROM [SousDomaines] sd
WHERE sd.[DomaineId] = @RegionaleId
  AND sd.[Designation] NOT IN (SELECT [Designation] FROM @SousDomaines)
  AND NOT EXISTS (SELECT 1 FROM [Kpis] k WHERE k.[SousDomaineId] = sd.[Id]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @RegionaleId INT = (SELECT TOP 1 [Id] FROM [Domaines] WHERE [Designation] = N'Regionale');
IF @RegionaleId IS NOT NULL
BEGIN
    DECLARE @SousDomaines TABLE ([Designation] NVARCHAR(255) NOT NULL);
    INSERT INTO @SousDomaines ([Designation]) VALUES
    (N'Commerciale DR'),
    (N'Genie Civil & Environnement'),
    (N'Maintenance & Equipements'),
    (N'Nouveaux Sites & Extension Radio'),
    (N'MTTR & Debit Internet'),
    (N'Recouvrement Contentieux'),
    (N'Ressources Humaines'),
    (N'Formation'),
    (N'Acquisition Terrain & Location Immeuble');

    DELETE sk
    FROM [SousKpis] AS sk
    INNER JOIN [Kpis] AS k ON k.[Id] = sk.[KpiId]
    INNER JOIN [SousDomaines] sd ON sd.[Id] = k.[SousDomaineId]
    WHERE sd.[DomaineId] = @RegionaleId
      AND k.[Nom] IN (
          N'genie_civil',
          N'maintenance_equipement',
          N'nouveaux_sites',
          N'mttr_debit',
          N'recouvrement_contentieux',
          N'ressources_humaines',
          N'formation',
          N'acquisition_terrain',
          N'realisations_commerciales',
          N'reseau_distribution'
      );

    DELETE k
    FROM [Kpis] AS k
    INNER JOIN [SousDomaines] sd ON sd.[Id] = k.[SousDomaineId]
    WHERE sd.[DomaineId] = @RegionaleId
      AND k.[Nom] IN (
          N'genie_civil',
          N'maintenance_equipement',
          N'nouveaux_sites',
          N'mttr_debit',
          N'recouvrement_contentieux',
          N'ressources_humaines',
          N'formation',
          N'acquisition_terrain',
          N'realisations_commerciales',
          N'reseau_distribution'
      );

    DELETE sd
    FROM [SousDomaines] sd
    WHERE sd.[DomaineId] = @RegionaleId
      AND sd.[Designation] IN (SELECT [Designation] FROM @SousDomaines)
      AND NOT EXISTS (SELECT 1 FROM [Kpis] k WHERE k.[SousDomaineId] = sd.[Id]);
END;
");
        }
    }
}
