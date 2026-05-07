-- Populate Domaines
INSERT INTO Domaines (Designation) VALUES
('Commerciale'),
('DVDRS'),
('DQRPC'),
('Support'),
('Finances'),
('Regionale');

-- Get Domaine IDs for reference
DECLARE @CommercialId INT = 1;
DECLARE @DvdrsId INT = 2;
DECLARE @DqrpcId INT = 3;
DECLARE @SupportId INT = 4;
DECLARE @FinancesId INT = 5;
DECLARE @RegionaleId INT = 6;

-- Populate SousDomaines for Commercial
INSERT INTO SousDomaines (DomaineId, Designation) VALUES
(@CommercialId, 'Chiffre d''Affaires'),
(@CommercialId, 'Parc Abonné'),
(@CommercialId, 'Activation-Desactivation SIM'),
(@CommercialId, 'Reclamation'),
(@CommercialId, 'E-payment'),
(@CommercialId, 'Encaissement'),
(@CommercialId, 'Rechargement'),
(@CommercialId, 'Recouvrement');

-- Populate SousDomaines for DVDRS
INSERT INTO SousDomaines (DomaineId, Designation) VALUES
(@DvdrsId, 'Disponibilité réseau'),
(@DvdrsId, 'MTTR');

-- Populate SousDomaines for DQRPC
INSERT INTO SousDomaines (DomaineId, Designation) VALUES
(@DqrpcId, 'Réalisation technique réseau'),
(@DqrpcId, 'Amélioration qualité'),
(@DqrpcId, 'MTTR');

-- Populate SousDomaines for Support
INSERT INTO SousDomaines (DomaineId, Designation) VALUES
(@SupportId, 'Créances contentieuses'),
(@SupportId, 'RH'),
(@SupportId, 'Formation');

-- Populate SousDomaines for Finances
INSERT INTO SousDomaines (DomaineId, Designation) VALUES
(@FinancesId, 'Compte de résultat');

-- Populate SousDomaines for Regionale
INSERT INTO SousDomaines (DomaineId, Designation) VALUES
(@RegionaleId, 'Réalisation technique réseau'),
(@RegionaleId, 'Amélioration qualité'),
(@RegionaleId, 'MTTR');

-- Get SousDomaine IDs
DECLARE @SousDomCommerChiffre INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @CommercialId AND Designation = 'Chiffre d''Affaires');
DECLARE @SousDomCommerParc INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @CommercialId AND Designation = 'Parc Abonné');
DECLARE @SousDomCommerActiv INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @CommercialId AND Designation = 'Activation-Desactivation SIM');
DECLARE @SousDomCommerRecla INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @CommercialId AND Designation = 'Reclamation');
DECLARE @SousDomCommerEpay INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @CommercialId AND Designation = 'E-payment');
DECLARE @SousDomCommerEncais INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @CommercialId AND Designation = 'Encaissement');
DECLARE @SousDomCommerRecharge INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @CommercialId AND Designation = 'Rechargement');
DECLARE @SousDomCommerRecouv INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @CommercialId AND Designation = 'Recouvrement');

DECLARE @SousDomDvdrsDispo INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @DvdrsId AND Designation = 'Disponibilité réseau');
DECLARE @SousDomDvdrsMttr INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @DvdrsId AND Designation = 'MTTR');

DECLARE @SousDomDqrpcReal INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @DqrpcId AND Designation = 'Réalisation technique réseau');
DECLARE @SousDomDqrpcAmel INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @DqrpcId AND Designation = 'Amélioration qualité');
DECLARE @SousDomDqrpcMttr INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @DqrpcId AND Designation = 'MTTR');

DECLARE @SousDomSupportCreance INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @SupportId AND Designation = 'Créances contentieuses');
DECLARE @SousDomSupportRH INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @SupportId AND Designation = 'RH');
DECLARE @SousDomSupportForm INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @SupportId AND Designation = 'Formation');

DECLARE @SousDomFinanceCR INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @FinancesId AND Designation = 'Compte de résultat');

DECLARE @SousDomRegionalReal INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @RegionaleId AND Designation = 'Réalisation technique réseau');
DECLARE @SousDomRegionalAmel INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @RegionaleId AND Designation = 'Amélioration qualité');
DECLARE @SousDomRegionalMttr INT = (SELECT Id FROM SousDomaines WHERE DomaineId = @RegionaleId AND Designation = 'MTTR');

-- Populate Categories for Commercial
INSERT INTO Categories (SousDomaineId, Designation) VALUES
(@SousDomCommerChiffre, 'Chiffre d''Affaires'),
(@SousDomCommerParc, 'Parc Abonné'),
(@SousDomCommerActiv, 'Activations et Désactivations'),
(@SousDomCommerRecla, 'Traitement des Reclamations GP et B2B'),
(@SousDomCommerEpay, 'Paiment électronique'),
(@SousDomCommerEncais, 'Total des Encaissements'),
(@SousDomCommerRecharge, 'Rechargement'),
(@SousDomCommerRecouv, 'Recouvrement');

-- Populate Categories for DVDRS
INSERT INTO Categories (SousDomaineId, Designation) VALUES
(@SousDomDvdrsDispo, 'Disponibilité réseau'),
(@SousDomDvdrsMttr, 'MTTR');

-- Populate Categories for DQRPC
INSERT INTO Categories (SousDomaineId, Designation) VALUES
(@SousDomDqrpcReal, 'Réalisation technique réseau'),
(@SousDomDqrpcAmel, 'Amélioration qualité'),
(@SousDomDqrpcMttr, 'MTTR');

-- Populate Categories for Support
INSERT INTO Categories (SousDomaineId, Designation) VALUES
(@SousDomSupportCreance, 'Créances contentieuses'),
(@SousDomSupportRH, 'RH'),
(@SousDomSupportForm, 'Formation');

-- Populate Categories for Finances
INSERT INTO Categories (SousDomaineId, Designation) VALUES
(@SousDomFinanceCR, 'Compte de résultat');

-- Populate Categories for Regionale
INSERT INTO Categories (SousDomaineId, Designation) VALUES
(@SousDomRegionalReal, 'Réalisation technique réseau'),
(@SousDomRegionalAmel, 'Amélioration qualité'),
(@SousDomRegionalMttr, 'MTTR');

-- Get Categorie IDs
DECLARE @CategCommerChiffre INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomCommerChiffre AND Designation = 'Chiffre d''Affaires');
DECLARE @CategCommerParc INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomCommerParc AND Designation = 'Parc Abonné');
DECLARE @CategCommerActiv INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomCommerActiv AND Designation = 'Activations et Désactivations');
DECLARE @CategCommerRecla INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomCommerRecla AND Designation = 'Traitement des Reclamations GP et B2B');
DECLARE @CategCommerEpay INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomCommerEpay AND Designation = 'Paiment électronique');
DECLARE @CategCommerEncais INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomCommerEncais AND Designation = 'Total des Encaissements');
DECLARE @CategCommerRecharge INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomCommerRecharge AND Designation = 'Rechargement');
DECLARE @CategCommerRecouv INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomCommerRecouv AND Designation = 'Recouvrement');

DECLARE @CategDvdrsDispo INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomDvdrsDispo AND Designation = 'Disponibilité réseau');
DECLARE @CategDvdrsMttr INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomDvdrsMttr AND Designation = 'MTTR');

DECLARE @CategDqrpcReal INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomDqrpcReal AND Designation = 'Réalisation technique réseau');
DECLARE @CategDqrpcAmel INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomDqrpcAmel AND Designation = 'Amélioration qualité');
DECLARE @CategDqrpcMttr INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomDqrpcMttr AND Designation = 'MTTR');

DECLARE @CategSupportCreance INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomSupportCreance AND Designation = 'Créances contentieuses');
DECLARE @CategSupportRH INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomSupportRH AND Designation = 'RH');
DECLARE @CategSupportForm INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomSupportForm AND Designation = 'Formation');

DECLARE @CategFinanceCR INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomFinanceCR AND Designation = 'Compte de résultat');

DECLARE @CategRegionalReal INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomRegionalReal AND Designation = 'Réalisation technique réseau');
DECLARE @CategRegionalAmel INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomRegionalAmel AND Designation = 'Amélioration qualité');
DECLARE @CategRegionalMttr INT = (SELECT Id FROM Categories WHERE SousDomaineId = @SousDomRegionalMttr AND Designation = 'MTTR');

-- Populate KPIs for Commercial - Chiffre d'Affaires
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategCommerChiffre, 'Chiffre d''Affaires (MDA)');

-- Populate KPIs for Commercial - Parc Abonné
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategCommerParc, 'Parc Abonnes B2B'),
(@CategCommerParc, 'Parc Abonnes GP'),
(@CategCommerParc, 'Total Parc Abonnes'),
(@CategCommerParc, 'Total Parc Abonnes par technologie');

-- Populate KPIs for Commercial - Activation/Desactivation
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategCommerActiv, 'Desactivation / Resiliation'),
(@CategCommerActiv, 'Activation');

-- Populate KPIs for Commercial - Reclamation
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategCommerRecla, 'Reclamation'),
(@CategCommerRecla, 'Reclamation GP');

-- Populate KPIs for Commercial - E-payment
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategCommerEpay, 'E-PAYEMENT Pop (MDA)'),
(@CategCommerEpay, 'E-PAYEMENT Prp (MDA)');

-- Populate KPIs for Commercial - Encaissement
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategCommerEncais, 'Encaissement (MDA)');

-- Populate KPIs for Commercial - Rechargement
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategCommerRecharge, 'Rechargement');

-- Populate KPIs for Commercial - Recouvrement
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategCommerRecouv, 'Recouvrement');

-- Populate KPIs for DVDRS - Disponibilité réseau
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategDvdrsDispo, 'Disponibilite reseau');

-- Populate KPIs for DVDRS - MTTR
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategDvdrsMttr, 'MTTR');

-- Populate KPIs for DQRPC - Réalisation technique réseau
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategDqrpcReal, 'Realisation technique Reseau');

-- Populate KPIs for DQRPC - Amélioration qualité
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategDqrpcAmel, 'Amelioration qualite');

-- Populate KPIs for DQRPC - MTTR
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategDqrpcMttr, 'MTTR');

-- Populate KPIs for Support - Créances contentieuses
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategSupportCreance, 'Creance contentieuses');

-- Populate KPIs for Support - RH
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategSupportRH, 'Frais Personnel'),
(@CategSupportRH, 'Effectif GSP'),
(@CategSupportRH, 'Absenteisme'),
(@CategSupportRH, 'Mouvement Effectifs'),
(@CategSupportRH, 'Mouvement Effectifs Domaine');

-- Populate KPIs for Support - Formation
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategSupportForm, 'Effectifs Formes GSP'),
(@CategSupportForm, 'Formations Domaines'),
(@CategSupportForm, 'Frequence Formation');

-- Populate KPIs for Finances - Compte de résultat
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategFinanceCR, 'Compte de resultat');

-- Populate KPIs for Regionale - Réalisation technique réseau
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategRegionalReal, 'Realisation technique Reseau');

-- Populate KPIs for Regionale - Amélioration qualité
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategRegionalAmel, 'Amelioration qualite');

-- Populate KPIs for Regionale - MTTR
INSERT INTO Kpis (CategorieId, Nom) VALUES
(@CategRegionalMttr, 'MTTR');
