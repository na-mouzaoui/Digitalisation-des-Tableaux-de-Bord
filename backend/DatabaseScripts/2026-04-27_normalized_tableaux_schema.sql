/*
  Normalized tableau storage schema
  Target DB: [Tab de Bord]
  Date: 2026-04-27
*/

USE [Tab de Bord];
GO

IF OBJECT_ID('dbo.Periode', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Periode (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Mois TINYINT NOT NULL,
        Annee SMALLINT NOT NULL,
        CONSTRAINT UQ_Periode_Mois_Annee UNIQUE (Mois, Annee)
    );
END
GO

/* 1) Reclamation */
IF OBJECT_ID('dbo.Reclamation_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Reclamation_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Reclamation', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Reclamation (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Reclamation INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        CONSTRAINT FK_Reclamation_Ligne FOREIGN KEY (Id_Designation_Reclamation) REFERENCES dbo.Reclamation_Lignes(Id),
        CONSTRAINT FK_Reclamation_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 2) ReclamationGP */
IF OBJECT_ID('dbo.ReclamationGP_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReclamationGP_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.ReclamationGP', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReclamationGP (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_ReclamationGP INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_Recues DECIMAL(18,2) NULL,
        M_Traitees DECIMAL(18,2) NULL,
        Taux DECIMAL(18,2) NULL,
        Part DECIMAL(18,2) NULL,
        CONSTRAINT FK_ReclamationGP_Ligne FOREIGN KEY (Id_Designation_ReclamationGP) REFERENCES dbo.ReclamationGP_Lignes(Id),
        CONSTRAINT FK_ReclamationGP_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 3/4) Epayement (POP/PRP) */
IF OBJECT_ID('dbo.Epayement_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Epayement_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Epayement', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Epayement (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Epayement INT NOT NULL,
        Id_Periode INT NOT NULL,
        Type VARCHAR(30) NOT NULL, -- Epaymentpop / Epaymentprp
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        Evol DECIMAL(18,2) NULL,
        CONSTRAINT FK_Epayement_Ligne FOREIGN KEY (Id_Designation_Epayement) REFERENCES dbo.Epayement_Lignes(Id),
        CONSTRAINT FK_Epayement_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 5) Encaissement */
IF OBJECT_ID('dbo.Encaissement_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Encaissement_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Encaissement', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Encaissement (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Encaissement INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_GP DECIMAL(18,2) NULL,
        M_1_B2B DECIMAL(18,2) NULL,
        M_GP DECIMAL(18,2) NULL,
        M_B2B DECIMAL(18,2) NULL,
        Evol DECIMAL(18,2) NULL,
        CONSTRAINT FK_Encaissement_Ligne FOREIGN KEY (Id_Designation_Encaissement) REFERENCES dbo.Encaissement_Lignes(Id),
        CONSTRAINT FK_Encaissement_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 6) Recouvrement */
IF OBJECT_ID('dbo.Recouvrement_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Recouvrement_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Recouvrement', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Recouvrement (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Recouvrement INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_GP DECIMAL(18,2) NULL,
        M_1_B2B DECIMAL(18,2) NULL,
        M_GP DECIMAL(18,2) NULL,
        M_B2B DECIMAL(18,2) NULL,
        CONSTRAINT FK_Recouvrement_Ligne FOREIGN KEY (Id_Designation_Recouvrement) REFERENCES dbo.Recouvrement_Lignes(Id),
        CONSTRAINT FK_Recouvrement_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 7) CA */
IF OBJECT_ID('dbo.CA_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CA_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.CA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CA (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_CA INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_1_Taux DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        M_Taux DECIMAL(18,2) NULL,
        CONSTRAINT FK_CA_Ligne FOREIGN KEY (Id_Designation_CA) REFERENCES dbo.CA_Lignes(Id),
        CONSTRAINT FK_CA_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 8/9/10/11) ParcAbonnes */
IF OBJECT_ID('dbo.ParcAbonnes_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParcAbonnes_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.ParcAbonnes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParcAbonnes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_ParcAbonnes INT NOT NULL,
        Id_Periode INT NOT NULL,
        Type VARCHAR(40) NOT NULL, -- GP / Global / Technologie / B2B
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        Evol DECIMAL(18,2) NULL,
        CONSTRAINT FK_ParcAbonnes_Ligne FOREIGN KEY (Id_Designation_ParcAbonnes) REFERENCES dbo.ParcAbonnes_Lignes(Id),
        CONSTRAINT FK_ParcAbonnes_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 12) Des/Activation */
IF OBJECT_ID('dbo.Des_Activation_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Des_Activation_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Des_Activation', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Des_Activation (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Des_Activation INT NOT NULL,
        Id_Periode INT NOT NULL,
        Type VARCHAR(30) NOT NULL, -- Activation / Desactivation
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        Evol DECIMAL(18,2) NULL,
        CONSTRAINT FK_DesActivation_Ligne FOREIGN KEY (Id_Designation_Des_Activation) REFERENCES dbo.Des_Activation_Lignes(Id),
        CONSTRAINT FK_DesActivation_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 14) Rechargement */
IF OBJECT_ID('dbo.Rechargement', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Rechargement (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_DR INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        Taux DECIMAL(18,2) NULL,
        CONSTRAINT FK_Rechargement_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 15) Realisation technique */
IF OBJECT_ID('dbo.Realisation_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Realisation_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Realisation', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Realisation (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Realisation INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        CONSTRAINT FK_Realisation_Ligne FOREIGN KEY (Id_Designation_Realisation) REFERENCES dbo.Realisation_Lignes(Id),
        CONSTRAINT FK_Realisation_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 16) Situation reseaux */
IF OBJECT_ID('dbo.Situation_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Situation_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Situation_Reseaux', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Situation_Reseaux (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Situation INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        CONSTRAINT FK_SituationReseaux_Ligne FOREIGN KEY (Id_Designation_Situation) REFERENCES dbo.Situation_Lignes(Id),
        CONSTRAINT FK_SituationReseaux_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 17) Trafic DATA */
IF OBJECT_ID('dbo.TD_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TD_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.TD', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TD (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_TD INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        CONSTRAINT FK_TD_Ligne FOREIGN KEY (Id_Designation_TD) REFERENCES dbo.TD_Lignes(Id),
        CONSTRAINT FK_TD_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 18) Amelioration qualite */
IF OBJECT_ID('dbo.Amelioration_Qualite', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Amelioration_Qualite (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_DR INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        Ecart DECIMAL(18,2) NULL,
        CONSTRAINT FK_AmeliorationQualite_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 19) Couverture reseau */
IF OBJECT_ID('dbo.Couverture_Reseau', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Couverture_Reseau (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Region INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        CONSTRAINT FK_CouvertureReseau_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 20) Action notable */
IF OBJECT_ID('dbo.AN_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AN_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.AN', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AN (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_AN INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_1_Taux DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        M_Taux DECIMAL(18,2) NULL,
        CONSTRAINT FK_AN_Ligne FOREIGN KEY (Id_Designation_AN) REFERENCES dbo.AN_Lignes(Id),
        CONSTRAINT FK_AN_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 21) Disponibilite reseau */
IF OBJECT_ID('dbo.DispoReseau_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DispoReseau_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.DispoReseau', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DispoReseau (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_DispoReseau INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_1_Taux DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        M_Taux DECIMAL(18,2) NULL,
        CONSTRAINT FK_DispoReseau_Ligne FOREIGN KEY (Id_Designation_DispoReseau) REFERENCES dbo.DispoReseau_Lignes(Id),
        CONSTRAINT FK_DispoReseau_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 22) MTTR */
IF OBJECT_ID('dbo.MTTR', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MTTR (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Wilaya INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        Ecart DECIMAL(18,2) NULL,
        CONSTRAINT FK_MTTR_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 23) Creances */
IF OBJECT_ID('dbo.Creances_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Creances_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Creances', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Creances (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Creances INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        Total DECIMAL(18,2) NULL,
        CONSTRAINT FK_Creances_Ligne FOREIGN KEY (Id_Designation_Creances) REFERENCES dbo.Creances_Lignes(Id),
        CONSTRAINT FK_Creances_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 24) Frais personnel */
IF OBJECT_ID('dbo.FraisPersonnel_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FraisPersonnel_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.FraisPersonnel', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FraisPersonnel (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_FraisPersonnel INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        CONSTRAINT FK_FraisPersonnel_Ligne FOREIGN KEY (Id_Designation_FraisPersonnel) REFERENCES dbo.FraisPersonnel_Lignes(Id),
        CONSTRAINT FK_FraisPersonnel_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 25) Effectif GSP */
IF OBJECT_ID('dbo.EffectifGSP_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EffectifGSP_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.EffectifGSP', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EffectifGSP (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_EffectifGSP INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        Part DECIMAL(18,2) NULL,
        CONSTRAINT FK_EffectifGSP_Ligne FOREIGN KEY (Id_Designation_EffectifGSP) REFERENCES dbo.EffectifGSP_Lignes(Id),
        CONSTRAINT FK_EffectifGSP_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 26) Absenteisme */
IF OBJECT_ID('dbo.Absenteisme_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Absenteisme_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Absenteisme', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Absenteisme (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_Absenteisme INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1 DECIMAL(18,2) NULL,
        M DECIMAL(18,2) NULL,
        Part DECIMAL(18,2) NULL,
        CONSTRAINT FK_Absenteisme_Ligne FOREIGN KEY (Id_Designation_Absenteisme) REFERENCES dbo.Absenteisme_Lignes(Id),
        CONSTRAINT FK_Absenteisme_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 27) Mouvement effectifs */
IF OBJECT_ID('dbo.MouvEffectifs_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MouvEffectifs_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.MouvEffectifs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MouvEffectifs (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_MouvEffectifs INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_CadresSup DECIMAL(18,2) NULL,
        M_1_Cadres DECIMAL(18,2) NULL,
        M_1_Maitrise DECIMAL(18,2) NULL,
        M_1_Execution DECIMAL(18,2) NULL,
        M_CadresSup DECIMAL(18,2) NULL,
        M_Cadres DECIMAL(18,2) NULL,
        M_Maitrise DECIMAL(18,2) NULL,
        M_Execution DECIMAL(18,2) NULL,
        CONSTRAINT FK_MouvEffectifs_Ligne FOREIGN KEY (Id_Designation_MouvEffectifs) REFERENCES dbo.MouvEffectifs_Lignes(Id),
        CONSTRAINT FK_MouvEffectifs_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 28) Mouvement effectifs domaines */
IF OBJECT_ID('dbo.MouvEffectifsDom_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MouvEffectifsDom_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.MouvEffectifsDom', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MouvEffectifsDom (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_MouvEffectifsDom INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_CDI DECIMAL(18,2) NULL,
        M_1_CDD DECIMAL(18,2) NULL,
        M_1_CTA DECIMAL(18,2) NULL,
        M_CDI DECIMAL(18,2) NULL,
        M_CDD DECIMAL(18,2) NULL,
        M_CTA DECIMAL(18,2) NULL,
        CONSTRAINT FK_MouvEffectifsDom_Ligne FOREIGN KEY (Id_Designation_MouvEffectifsDom) REFERENCES dbo.MouvEffectifsDom_Lignes(Id),
        CONSTRAINT FK_MouvEffectifsDom_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 29) Formation GSP */
IF OBJECT_ID('dbo.FormationGSP_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FormationGSP_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.FormationGSP', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FormationGSP (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_FormationGSP INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_1_Taux DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        M_Taux DECIMAL(18,2) NULL,
        CONSTRAINT FK_FormationGSP_Ligne FOREIGN KEY (Id_Designation_FormationGSP) REFERENCES dbo.FormationGSP_Lignes(Id),
        CONSTRAINT FK_FormationGSP_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 30) Formation domaines */
IF OBJECT_ID('dbo.FormationDom_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FormationDom_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.FormationDom', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FormationDom (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_FormationDom INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_1_Taux DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        M_Taux DECIMAL(18,2) NULL,
        CONSTRAINT FK_FormationDom_Ligne FOREIGN KEY (Id_Designation_FormationDom) REFERENCES dbo.FormationDom_Lignes(Id),
        CONSTRAINT FK_FormationDom_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 31) Frequence formation */
IF OBJECT_ID('dbo.FreqFormation', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FreqFormation (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Periode INT NOT NULL,
        M_1_Objectif DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_1_Taux DECIMAL(18,2) NULL,
        M_Objectif DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        M_Taux DECIMAL(18,2) NULL,
        CONSTRAINT FK_FreqFormation_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO

/* 32) Compte resultat */
IF OBJECT_ID('dbo.CompteResultat_Lignes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CompteResultat_Lignes (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Designation NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.CompteResultat', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CompteResultat (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Id_Designation_CompteResultat INT NOT NULL,
        Id_Periode INT NOT NULL,
        M_1_Budget DECIMAL(18,2) NULL,
        M_1_Realise DECIMAL(18,2) NULL,
        M_1_Taux DECIMAL(18,2) NULL,
        M_Budget DECIMAL(18,2) NULL,
        M_Realise DECIMAL(18,2) NULL,
        M_Taux DECIMAL(18,2) NULL,
        CONSTRAINT FK_CompteResultat_Ligne FOREIGN KEY (Id_Designation_CompteResultat) REFERENCES dbo.CompteResultat_Lignes(Id),
        CONSTRAINT FK_CompteResultat_Periode FOREIGN KEY (Id_Periode) REFERENCES dbo.Periode(Id)
    );
END
GO
