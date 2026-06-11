using Microsoft.EntityFrameworkCore.Migrations;
using System.Text;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class SeedMissingSousKpis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var sql = new StringBuilder();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 35)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (643, 35, N'Acquisition des nouveaux sites', 0),");
            sql.AppendLine("    (644, 35, N'Notes de calculs', 1),");
            sql.AppendLine("    (645, 35, N'Construction GC des nouveaux sites', 2),");
            sql.AppendLine("    (646, 35, N'Renforcement GC', 3);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 36)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (647, 36, N'Maintenance curative des sites', 0),");
            sql.AppendLine("    (648, 36, N'Maintenance preventive des sites', 1),");
            sql.AppendLine("    (649, 36, N'Equipements electriques', 2),");
            sql.AppendLine("    (650, 36, N'Gestion du parc groupes electrogenes', 3);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 37)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (651, 37, N'Nouveaux Sites ON AIR', 0),");
            sql.AppendLine("    (652, 37, N'Densification LTE', 1),");
            sql.AppendLine("    (653, 37, N'Modernisation Radio', 2),");
            sql.AppendLine("    (654, 37, N'Nouveaux sites SUCE', 3);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 38)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (655, 38, N'MTTR Objectif', 0),");
            sql.AppendLine("    (656, 38, N'MTTR Realise', 1),");
            sql.AppendLine("    (657, 38, N'Debit Objectif', 2),");
            sql.AppendLine("    (658, 38, N'Debit Realise', 3);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 39)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (659, 39, N'Envoi LMD', 0),");
            sql.AppendLine("    (660, 39, N'Montant Recouvre', 1),");
            sql.AppendLine("    (661, 39, N'Taux Recouvrement', 2);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 40)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (662, 40, N'Effectif Total', 0),");
            sql.AppendLine("    (663, 40, N'Personnel Technique', 1),");
            sql.AppendLine("    (664, 40, N'Personnel Commercial', 2),");
            sql.AppendLine("    (665, 40, N'Personnel Support', 3),");
            sql.AppendLine("    (666, 40, N'Taux d''Absenteisme', 4);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 41)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (667, 41, N'Nombre Effectifs Formes', 0),");
            sql.AppendLine("    (668, 41, N'Nombre Formations Realisees', 1);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 42)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (669, 42, N'Nombre Terrains Acquis', 0),");
            sql.AppendLine("    (670, 42, N'Surface Acquise (m2)', 1),");
            sql.AppendLine("    (671, 42, N'Montant Investi', 2);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 46)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (672, 46, N'Taux d''acces RRC', 0),");
            sql.AppendLine("    (673, 46, N'Taux Succes E-RAB', 1),");
            sql.AppendLine("    (674, 46, N'Taux Drop E-RAB', 2),");
            sql.AppendLine("    (675, 46, N'Debit Moyen DL (Mbps)', 3),");
            sql.AppendLine("    (676, 46, N'Disponibilite 4G', 4);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");
            sql.AppendLine();

            sql.AppendLine("IF NOT EXISTS (SELECT 1 FROM [SousKpis] WHERE [KpiId] = 47)");
            sql.AppendLine("BEGIN");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] ON;");
            sql.AppendLine("    INSERT INTO [SousKpis] ([Id], [KpiId], [Designation], [Order]) VALUES");
            sql.AppendLine("    (677, 47, N'Taux Succes NR (5G)', 0),");
            sql.AppendLine("    (678, 47, N'Taux Drop NR (5G)', 1),");
            sql.AppendLine("    (679, 47, N'Debit Moyen DL 5G (Mbps)', 2),");
            sql.AppendLine("    (680, 47, N'Disponibilite 5G', 3);");
            sql.AppendLine("    SET IDENTITY_INSERT [SousKpis] OFF;");
            sql.AppendLine("END");

            migrationBuilder.Sql(sql.ToString());
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM [SousKpis] WHERE [KpiId] IN (35, 36, 37, 38, 39, 40, 41, 42, 46, 47) AND [Id] >= 643;
");
        }
    }
}
