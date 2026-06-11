-- Seed missing SousKpis for KPIs that have 0 lines
-- Target DB: [Tab de Bord]
-- Date: 2026-06-11

USE [Tab de Bord];
GO

-- ============================================================
-- KPI 35: genie_civil (SD 17 - Regionale / Technique)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 35)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (643, 35, N'Acquisition des nouveaux sites', 0),
    (644, 35, N'Notes de calculs', 1),
    (645, 35, N'Construction GC des nouveaux sites', 2),
    (646, 35, N'Renforcement GC', 3);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 36: maintenance_equipement (SD 17 - Regionale / Technique)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 36)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (647, 36, N'Maintenance curative des sites', 0),
    (648, 36, N'Maintenance preventive des sites', 1),
    (649, 36, N'Equipements electriques', 2),
    (650, 36, N'Gestion du parc groupes electrogenes', 3);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 37: nouveaux_sites (SD 17 - Regionale / Technique)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 37)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (651, 37, N'Nouveaux Sites ON AIR', 0),
    (652, 37, N'Densification LTE', 1),
    (653, 37, N'Modernisation Radio', 2),
    (654, 37, N'Nouveaux sites SUCE', 3);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 38: mttr_debit (SD 17 - Regionale / Technique)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 38)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (655, 38, N'MTTR Objectif', 0),
    (656, 38, N'MTTR Realise', 1),
    (657, 38, N'Debit Objectif', 2),
    (658, 38, N'Debit Realise', 3);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 39: recouvrement_contentieux (SD 18 - Regionale / Support)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 39)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (659, 39, N'Envoi LMD', 0),
    (660, 39, N'Montant Recouvre', 1),
    (661, 39, N'Taux Recouvrement', 2);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 40: ressources_humaines (SD 18 - Regionale / Support)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 40)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (662, 40, N'Effectif Total', 0),
    (663, 40, N'Personnel Technique', 1),
    (664, 40, N'Personnel Commercial', 2),
    (665, 40, N'Personnel Support', 3),
    (666, 40, N'Taux d''Absenteisme', 4);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 41: formation (SD 18 - Regionale / Support)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 41)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (667, 41, N'Nombre Effectifs Formes', 0),
    (668, 41, N'Nombre Formations Realisees', 1);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 42: acquisition_terrain (SD 19 - Regionale / CSM)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 42)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (669, 42, N'Nombre Terrains Acquis', 0),
    (670, 42, N'Surface Acquise (m2)', 1),
    (671, 42, N'Montant Investi', 2);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 46: amelioration_qualite_4g (SD 29 - DVDRS / Amelioration Qualite 4G)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 46)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (672, 46, N'Taux d''acces RRC', 0),
    (673, 46, N'Taux Succes E-RAB', 1),
    (674, 46, N'Taux Drop E-RAB', 2),
    (675, 46, N'Debit Moyen DL (Mbps)', 3),
    (676, 46, N'Disponibilite 4G', 4);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

-- ============================================================
-- KPI 47: amelioration_qualite_5g (SD 30 - DVDRS / Amelioration Qualite 5G)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 47)
BEGIN
    SET IDENTITY_INSERT [SousKpis] ON;
    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES
    (677, 47, N'Taux Succes NR (5G)', 0),
    (678, 47, N'Taux Drop NR (5G)', 1),
    (679, 47, N'Debit Moyen DL 5G (Mbps)', 2),
    (680, 47, N'Disponibilite 5G', 3);
    SET IDENTITY_INSERT [SousKpis] OFF;
END
GO

PRINT N'Seed des SousKpis manquants termine.';
GO
