using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    public partial class ReseedKpiHierarchyToPageTabs : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var sql = new StringBuilder();

            sql.AppendLine("DELETE FROM [SousKpis];");
            sql.AppendLine("DELETE FROM [Kpis];");
            sql.AppendLine("DELETE FROM [SousDomaines];");
            sql.AppendLine("DELETE FROM [Domaines];");
            sql.AppendLine();

            AppendIdentityInsert(
                sql,
                "Domaines",
                new[] { "Id", "Designation" },
                new[]
                {
                    (1, "Commerciale"),
                    (2, "DVDRS"),
                    (3, "DQRPC"),
                    (4, "Support"),
                    (5, "Finances"),
                    (6, "Regionale"),
                },
                item => new[] { SqlInt(item.Item1), SqlString(item.Item2) }
            );

            AppendIdentityInsert(
                sql,
                "SousDomaines",
                new[] { "Id", "DomaineId", "Designation" },
                new[]
                {
                    (1, 1, "Reclamation"),
                    (2, 1, "E-PAYEMENT (MDA)"),
                    (3, 1, "Encaissement (MDA)"),
                    (4, 1, "Rechargement"),
                    (5, 1, "Recouvrement (MDA)"),
                    (6, 1, "Parc Abonnes GP"),
                    (7, 1, "Total Parc Abonnes par technologie"),
                    (8, 1, "Activation"),
                    (9, 1, "Désactivation"),
                    (10, 1, "Résiliation"),
                    (11, 1, "Chiffre d'Affaires (MDA)"),
                    (12, 2, "Realisation technique Reseau"),
                    (13, 2, "Situation Reseau"),
                    (14, 2, "Evolution du Trafic Data"),
                    (15, 2, "Amelioration qualite"),
                    (16, 2, "Couverture Reseau"),
                    (17, 2, "Action notable sur le Reseau"),
                    (18, 3, "Disponibilite reseau"),
                    (19, 3, "MTTR"),
                    (20, 4, "Creance contentieuses"),
                    (21, 4, "RH"),
                    (22, 4, "Formation"),
                    (23, 5, "Compte de resultat"),
                    (24, 5, "Investissement (MDA)"),
                    (25, 5, "Finance DFC"),
                    (26, 6, "Realisation technique Reseau"),
                    (27, 6, "Amelioration qualite"),
                    (28, 6, "MTTR"),
                },
                item => new[] { SqlInt(item.Item1), SqlInt(item.Item2), SqlString(item.Item3) }
            );

            AppendIdentityInsert(
                sql,
                "Kpis",
                new[] { "Id", "SousDomaineId", "Nom" },
                new[]
                {
                    (1, 1, "reclamation"),
                    (2, 2, "e_payement_pop"),
                    (3, 2, "e_payement_prp"),
                    (4, 3, "total_encaissement"),
                    (5, 4, "rechargement"),
                    (6, 5, "recouvrement"),
                    (7, 6, "parc_abonnes_gp"),
                    (8, 6, "parc_abonnes_b2b"),
                    (9, 6, "total_parc_abonnes"),
                    (10, 7, "total_parc_abonnes_technologie"),
                    (11, 8, "activation"),
                    (12, 9, "desactivation"),
                    (13, 10, "resiliation"),
                    (14, 11, "chiffre_affaires_mda"),
                    (15, 12, "realisation_technique_reseau"),
                    (16, 13, "situation_reseau"),
                    (17, 14, "trafic_data"),
                    (18, 15, "amelioration_qualite"),
                    (19, 16, "couverture_reseau"),
                    (20, 17, "action_notable_reseau"),
                    (21, 18, "disponibilite_reseau"),
                    (22, 19, "mttr"),
                    (23, 20, "creances_contentieuses"),
                    (24, 21, "frais_personnel"),
                    (25, 21, "effectif_gsp"),
                    (26, 21, "absenteisme"),
                    (27, 21, "mouvement_effectifs"),
                    (28, 21, "mouvement_effectifs_domaine"),
                    (29, 22, "effectifs_formes_gsp"),
                    (30, 22, "formations_domaines"),
                    (31, 22, "budget_formation"),
                    (32, 23, "compte_resultat"),
                    (33, 24, "investissement"),
                    (34, 25, "avancement_engagement"),
                    (35, 26, "realisation_technique_reseau"),
                    (36, 27, "amelioration_qualite"),
                    (37, 28, "mttr"),
                },
                item => new[] { SqlInt(item.Item1), SqlInt(item.Item2), SqlString(item.Item3) }
            );

            AppendIdentityInsert(
                sql,
                "SousKpis",
                new[] { "Id", "KpiId", "Designation", "Order" },
                new[]
                {
                    (1, 1, "Recues GP", 0),
                    (2, 1, "Recues B2B", 1),
                    (3, 1, "Traitees GP", 2),
                    (4, 1, "Traitees B2B", 3),
                    (5, 2, "Baridimob", 0),
                    (6, 2, "webportail", 1),
                    (7, 2, "GAB-Alg Poste", 2),
                    (8, 2, "WINPAY (BNA)", 3),
                    (9, 3, "Baridimob", 0),
                    (10, 3, "webportail", 1),
                    (11, 3, "GAB-Alg Poste", 2),
                    (12, 3, "WINPAY (BNA)", 3),
                    (13, 4, "GP", 0),
                    (14, 4, "B2B", 1),
                    (15, 4, "Total", 2),
                    (16, 5, "Rechargement PRP Mensuel en Mlrds DA HT", 0),
                    (17, 5, "CA Prélèvements DM en Mlrds DA HT", 1),
                    (18, 5, "Evol", 2),
                    (19, 6, "GP", 0),
                    (20, 6, "B2B", 1),
                    (21, 6, "Total", 2),
                    (22, 7, "Parc Abonnés GP", 0),
                    (23, 7, "Parc Abonnés B2B", 1),
                    (24, 7, "TOTAL", 2),
                    (25, 8, "Parc Abonnés GP", 0),
                    (26, 8, "Parc Abonnés B2B", 1),
                    (27, 8, "TOTAL", 2),
                    (28, 9, "GP", 0),
                    (29, 9, "B2B", 1),
                    (30, 9, "Total", 2),
                    (31, 10, "2G", 0),
                    (32, 10, "3G", 1),
                    (33, 10, "4G", 2),
                    (34, 10, "5G", 3),
                    (35, 10, "TOTAL", 4),
                    (36, 11, "GP", 0),
                    (37, 11, "B2B", 1),
                    (38, 11, "Total", 2),
                    (39, 12, "GP", 0),
                    (40, 12, "B2B", 1),
                    (41, 12, "Total", 2),
                    (42, 13, "GP", 0),
                    (43, 13, "B2B", 1),
                    (44, 13, "Total", 2),
                    (45, 14, "Grand Public", 0),
                    (46, 14, "B2B", 1),
                    (47, 14, "Interco & Roaming", 2),
                    (48, 15, "Acquisition des nouveaux sites", 0),
                    (49, 15, "Notes de calculs", 1),
                    (50, 15, "Acquisition des nouveaux sites SUCE", 2),
                    (51, 15, "Construction GC des nouveaux sites SUCE", 3),
                    (52, 15, "Construction GC de nouveaux sites", 4),
                    (53, 15, "Renforcement GC", 5),
                    (54, 16, "Reseau 2G", 0),
                    (55, 16, "Reseau 3G", 1),
                    (56, 16, "Reseau 4G", 2),
                    (57, 16, "Reseau 4G", 3),
                    (58, 16, "Reseaux 5G", 4),
                    (59, 17, "2G-3G Traffic Volume per day", 0),
                    (60, 17, "4G-5G Traffic Volume per day", 1),
                    (61, 17, "Total daily traffic volume", 2),
                    (62, 18, "Wilaya 1", 0),
                    (63, 19, "Wilaya 1", 0),
                    (64, 20, "Projet Nouveaux Sites", 0),
                    (65, 20, "Densification du LTE_30Mhz (1800_15+2100_15)", 1),
                    (66, 20, "Ajout de la couche LTE TDD 2300", 2),
                    (67, 20, "Ajout de la nouvelle technologie 5G 3500 + LTE TDD 2600", 3),
                    (68, 21, "Disponibilite des Services", 0),
                    (69, 21, "Disponibilite Coeur Reseau", 1),
                    (70, 21, "Disponibilite Acces Radio 2G", 2),
                    (71, 21, "Disponibilite Acces Radio 3G", 3),
                    (72, 21, "Disponibilite Acces Radio 4G", 4),
                    (73, 21, "Drop call 2G", 5),
                    (74, 21, "RAB Voice Drop 3G", 6),
                    (75, 21, "ERAB Drop 4G", 7),
                    (76, 21, "MTTR", 8),
                    (77, 21, "2G Congestion Rate", 9),
                    (78, 21, "Disponibilite Globale reseau", 10),
                    (79, 22, "DR Alger", 0),
                    (80, 22, "DR Oran", 1),
                    (81, 22, "DR Constantine", 2),
                    (82, 22, "DR Setif", 3),
                    (83, 22, "DR Ouargla", 4),
                    (84, 22, "DR Bechar", 5),
                    (85, 22, "DR Annaba", 6),
                    (86, 22, "DR Chlef", 7),
                    (87, 23, "N-2 (2024)", 0),
                    (88, 23, "N-1 (2025)", 1),
                    (89, 23, "Total", 2),
                    (90, 24, "Objectif", 0),
                    (91, 24, "Realisation", 1),
                    (92, 24, "Taux d'atteinte", 2),
                    (93, 24, "Salaire Moyen", 3),
                    (94, 25, "Cadres Sup", 0),
                    (95, 25, "Cadres", 1),
                    (96, 25, "Maitrise", 2),
                    (97, 25, "Execution", 3),
                    (98, 25, "Total", 4),
                    (99, 26, "Irregulieres", 0),
                    (100, 26, "Cadre Disciplinaire", 1),
                    (101, 26, "Cadre Medical", 2),
                    (102, 26, "Autorisees", 3),
                    (103, 26, "TOTAL", 4),
                    (104, 27, "Detachement", 0),
                    (105, 27, "Recrutement", 1),
                    (106, 27, "Reintegration", 2),
                    (107, 27, "Stagiaires", 3),
                    (108, 27, "Personnes a besoins specifiques", 4),
                    (109, 27, "TOTAL", 5),
                    (110, 27, "Abandon de poste", 6),
                    (111, 27, "Deces", 7),
                    (112, 27, "Demission", 8),
                    (113, 27, "Detachement", 9),
                    (114, 27, "Fin de contrat", 10),
                    (115, 27, "Licenciement", 11),
                    (116, 27, "Retraite", 12),
                    (117, 27, "Stagiaires", 13),
                    (118, 27, "Personnes a besoins specifiques", 14),
                    (119, 27, "TOTAL", 15),
                    (120, 28, "Recrutement - COMMERCIAL", 0),
                    (121, 28, "Recrutement - MANAGEMENT", 1),
                    (122, 28, "Recrutement - SUPPORT", 2),
                    (123, 28, "Recrutement - TECHNIQUE", 3),
                    (124, 28, "Recrutement - TOTAL", 4),
                    (125, 28, "Sortant - COMMERCIAL", 5),
                    (126, 28, "Sortant - MANAGEMENT", 6),
                    (127, 28, "Sortant - SUPPORT", 7),
                    (128, 28, "Sortant - TECHNIQUE", 8),
                    (129, 28, "Sortant - TOTAL", 9),
                    (130, 29, "Cadres & cadres Superieures", 0),
                    (131, 29, "Execution", 1),
                    (132, 29, "Maitrise", 2),
                    (133, 29, "Total Personnes Formees", 3),
                    (134, 30, "Commercial", 0),
                    (135, 30, "Technique", 1),
                    (136, 30, "Management", 2),
                    (137, 30, "Divers (Langue Anglaise)", 3),
                    (138, 30, "Total Formations effectuees", 4),
                    (139, 31, "Budget Annuel", 0),
                    (140, 31, "Objectif Mensuel", 1),
                    (141, 31, "Réalisation", 2),
                    (142, 31, "Reste à réaliser", 3),
                    (143, 31, "Taux de Réalisation", 4),
                    (144, 32, "Chiffre d'affaire GP", 0),
                    (145, 32, "Chiffre d'affair ME", 1),
                    (146, 32, "Chiffre d'affairs Interco -roming", 2),
                    (147, 32, "Total CA", 3),
                    (148, 32, "Consommation de l'exercice", 4),
                    (149, 32, "Service Exterieurs et autres consommations", 5),
                    (150, 32, "VALEUR AJOUTEE D'EXPLOITATION", 6),
                    (151, 32, "Charge du Personnel", 7),
                    (152, 32, "Impots, Taxes et versement assimile", 8),
                    (153, 32, "EBE", 9),
                    (154, 32, "Autres produits Operasionnels", 10),
                    (155, 32, "Autres charges Operationnelles", 11),
                    (156, 32, "Dotations aux amortissements", 12),
                    (157, 32, "Reprises sur pertes de valeur et provisions", 13),
                    (158, 32, "Resultat Operationnel", 14),
                    (159, 32, "Produits financiers", 15),
                    (160, 32, "Charges financieres", 16),
                    (161, 32, "RESULTAT FINANCIER", 17),
                    (162, 32, "RESULTAT ORDINAIRE AVANT IMPOTS", 18),
                    (163, 33, "PREVU", 0),
                    (164, 33, "ENGAGE", 1),
                    (165, 33, "TECHNIQUE PREVU", 2),
                    (166, 33, "TECHNIQUE ENGAGE", 3),
                    (167, 33, "Totale Prevu", 4),
                    (168, 33, "Totale Engage", 5),
                    (169, 33, "Taux", 6),
                    (170, 34, "Montant de l'investissement", 0),
                    (171, 34, "Dépense d'investissement engagées", 1),
                    (172, 34, "Droits de Douane Exonorés", 2),
                    (173, 34, "TVA Exonérée", 3),
                    (174, 34, "Taux et d'investissement", 4),
                    (175, 34, "Total des emplois créés", 5),
                    (176, 35, "sites acquis", 0),
                    (177, 35, "site en cours de construction", 1),
                    (178, 35, "sites construits", 2),
                    (179, 36, "Wilaya 1", 0),
                    (180, 37, "DR Alger", 0),
                    (181, 37, "DR Oran", 1),
                    (182, 37, "DR Constantine", 2),
                    (183, 37, "DR Setif", 3),
                    (184, 37, "DR Ouargla", 4),
                    (185, 37, "DR Bechar", 5),
                    (186, 37, "DR Annaba", 6),
                    (187, 37, "DR Chlef", 7),
                },
                item => new[] { SqlInt(item.Item1), SqlInt(item.Item2), SqlString(item.Item3), SqlInt(item.Item4) }
            );

            migrationBuilder.Sql(sql.ToString());
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

        private static void AppendIdentityInsert<T>(StringBuilder sql, string tableName, string[] columns, IEnumerable<T> rows, Func<T, string[]> valueSelector)
        {
            sql.AppendLine($"SET IDENTITY_INSERT [{tableName}] ON;");
            sql.AppendLine($"INSERT INTO [{tableName}] ([{string.Join("] , [", columns)}]) VALUES");
            sql.AppendLine(string.Join(",\n", rows.Select(row => $"({string.Join(", ", valueSelector(row))})")) + ";");
            sql.AppendLine($"SET IDENTITY_INSERT [{tableName}] OFF;");
            sql.AppendLine();
        }

        private static string SqlString(string value) => $"N'{EscapeSql(value)}'";

        private static string SqlInt(int value) => value.ToString(CultureInfo.InvariantCulture);

        private static string EscapeSql(string value) => value.Replace("'", "''");
    }
}