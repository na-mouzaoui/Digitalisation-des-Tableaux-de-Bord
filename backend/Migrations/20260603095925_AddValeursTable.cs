using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    public partial class AddValeursTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Valeurs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Valeurs] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Id_SousKpi] INT NOT NULL,
        [Id_Periode] INT NOT NULL,
        [M] DECIMAL(18,2) NULL,
        [M_1] DECIMAL(18,2) NULL,
        [Evol] DECIMAL(18,2) NULL,
        [Part_Pct] DECIMAL(18,2) NULL,
        [Ecart] DECIMAL(18,2) NULL,
        [Objectif_2026] DECIMAL(18,2) NULL,
        [Situation_Actuelle] NVARCHAR(255) NULL,
        [M_Objectif] DECIMAL(18,2) NULL,
        [M_Realise] DECIMAL(18,2) NULL,
        [M_Taux] DECIMAL(18,2) NULL,
        [M_1_Objectif] DECIMAL(18,2) NULL,
        [M_1_Realise] DECIMAL(18,2) NULL,
        [M_1_Taux] DECIMAL(18,2) NULL,
        [M_Wilaya] NVARCHAR(255) NULL,
        [Taux_M] DECIMAL(18,2) NULL,
        [Taux_M_1] DECIMAL(18,2) NULL,
        [M_1_Montant_Recouvre] DECIMAL(18,2) NULL,
        [M_Montant_Mis_Recouvrement] DECIMAL(18,2) NULL,
        [M_Montant_Recouvre] DECIMAL(18,2) NULL,
        [M_Taux_Recouvrement] DECIMAL(18,2) NULL,
        [M_Objectif_Recouvrement] DECIMAL(18,2) NULL,
        [M_1_Recrute] DECIMAL(18,2) NULL,
        [M_Recrute] DECIMAL(18,2) NULL,
        [MTTR_Objectif] DECIMAL(18,2) NULL,
        [MTTR_Realise] DECIMAL(18,2) NULL,
        [MTTR_Ecart] DECIMAL(18,2) NULL,
        [Debit_Objectif] DECIMAL(18,2) NULL,
        [Debit_Realise] DECIMAL(18,2) NULL,
        [Debit_Ecart] DECIMAL(18,2) NULL,
        [M_1_Cadres_Sup] DECIMAL(18,2) NULL,
        [M_1_Cadres] DECIMAL(18,2) NULL,
        [M_1_Maitrise] DECIMAL(18,2) NULL,
        [M_1_Execution] DECIMAL(18,2) NULL,
        [M_Cadres_Sup] DECIMAL(18,2) NULL,
        [M_Cadres] DECIMAL(18,2) NULL,
        [M_Maitrise] DECIMAL(18,2) NULL,
        [M_Execution] DECIMAL(18,2) NULL,
        [M_1_CDI] DECIMAL(18,2) NULL,
        [M_1_CDD] DECIMAL(18,2) NULL,
        [M_1_CTA] DECIMAL(18,2) NULL,
        [M_CDI] DECIMAL(18,2) NULL,
        [M_CDD] DECIMAL(18,2) NULL,
        [M_CTA] DECIMAL(18,2) NULL,
        CONSTRAINT [FK_Valeurs_SousKpis_Id_SousKpi] FOREIGN KEY ([Id_SousKpi]) REFERENCES [dbo].[SousKpis]([Id]) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX [IX_Valeurs_Id_SousKpi_Id_Periode] ON [dbo].[Valeurs] ([Id_SousKpi], [Id_Periode]);
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Valeurs]', N'U') IS NOT NULL
    DROP TABLE [dbo].[Valeurs]");
        }
    }
}
