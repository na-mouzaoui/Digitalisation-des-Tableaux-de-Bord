using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class RenametableauTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[tableau]', N'U') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_tableau_Users_ApprovedByUserId')
        ALTER TABLE [dbo].[tableau] DROP CONSTRAINT [FK_tableau_Users_ApprovedByUserId];

    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_tableau_Users_UserId')
        ALTER TABLE [dbo].[tableau] DROP CONSTRAINT [FK_tableau_Users_UserId];

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_tableau')
        ALTER TABLE [dbo].[tableau] DROP CONSTRAINT [PK_tableau];

    EXEC sp_rename N'[dbo].[tableau]', N'tableau';
END

IF OBJECT_ID(N'[dbo].[tableauRecaps]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[EtatsDeSortie]', N'U') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_tableauRecaps_Users_UserId')
        ALTER TABLE [dbo].[tableauRecaps] DROP CONSTRAINT [FK_tableauRecaps_Users_UserId];

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_tableauRecaps')
        ALTER TABLE [dbo].[tableauRecaps] DROP CONSTRAINT [PK_tableauRecaps];

    EXEC sp_rename N'[dbo].[tableauRecaps]', N'EtatsDeSortie';
END

IF OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_tableau_UserId_TabKey_Mois_Annee' AND [object_id] = OBJECT_ID(N'[dbo].[tableau]'))
        EXEC sp_rename N'[dbo].[tableau].[IX_tableau_UserId_TabKey_Mois_Annee]', N'IX_tableau_UserId_TabKey_Mois_Annee', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_tableau_UserId' AND [object_id] = OBJECT_ID(N'[dbo].[tableau]'))
        EXEC sp_rename N'[dbo].[tableau].[IX_tableau_UserId]', N'IX_tableau_UserId', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_tableau_IsApproved' AND [object_id] = OBJECT_ID(N'[dbo].[tableau]'))
        EXEC sp_rename N'[dbo].[tableau].[IX_tableau_IsApproved]', N'IX_tableau_IsApproved', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_tableau_ApprovedByUserId' AND [object_id] = OBJECT_ID(N'[dbo].[tableau]'))
        EXEC sp_rename N'[dbo].[tableau].[IX_tableau_ApprovedByUserId]', N'IX_tableau_ApprovedByUserId', N'INDEX';

    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_tableau')
        ALTER TABLE [dbo].[tableau] ADD CONSTRAINT [PK_tableau] PRIMARY KEY ([Id]);

    IF COL_LENGTH(N'[dbo].[tableau]', N'ApprovedByUserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_tableau_Users_ApprovedByUserId')
        ALTER TABLE [dbo].[tableau] WITH CHECK
        ADD CONSTRAINT [FK_tableau_Users_ApprovedByUserId]
            FOREIGN KEY([ApprovedByUserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION;

    -- ✅ CORRECTION : CASCADE → NO ACTION pour éviter le cycle de cascade
    IF COL_LENGTH(N'[dbo].[tableau]', N'UserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_tableau_Users_UserId')
        ALTER TABLE [dbo].[tableau] WITH CHECK
        ADD CONSTRAINT [FK_tableau_Users_UserId]
            FOREIGN KEY([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION;
END

IF OBJECT_ID(N'[dbo].[EtatsDeSortie]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_tableauRecaps_UserId' AND [object_id] = OBJECT_ID(N'[dbo].[EtatsDeSortie]'))
        EXEC sp_rename N'[dbo].[EtatsDeSortie].[IX_tableauRecaps_UserId]', N'IX_EtatsDeSortie_UserId', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_tableauRecaps_Key_Mois_Annee' AND [object_id] = OBJECT_ID(N'[dbo].[EtatsDeSortie]'))
        EXEC sp_rename N'[dbo].[EtatsDeSortie].[IX_tableauRecaps_Key_Mois_Annee]', N'IX_EtatsDeSortie_Key_Mois_Annee', N'INDEX';

    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_EtatsDeSortie')
        ALTER TABLE [dbo].[EtatsDeSortie] ADD CONSTRAINT [PK_EtatsDeSortie] PRIMARY KEY ([Id]);

    IF COL_LENGTH(N'[dbo].[EtatsDeSortie]', N'UserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_EtatsDeSortie_Users_UserId')
        ALTER TABLE [dbo].[EtatsDeSortie] WITH CHECK
        ADD CONSTRAINT [FK_EtatsDeSortie_Users_UserId]
            FOREIGN KEY([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE;
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tableau_Users_ApprovedByUserId",
                table: "tableau");

            migrationBuilder.DropForeignKey(
                name: "FK_tableau_Users_UserId",
                table: "tableau");

            migrationBuilder.DropForeignKey(
                name: "FK_EtatsDeSortie_Users_UserId",
                table: "EtatsDeSortie");

            migrationBuilder.DropPrimaryKey(
                name: "PK_tableau",
                table: "tableau");

            migrationBuilder.DropPrimaryKey(
                name: "PK_EtatsDeSortie",
                table: "EtatsDeSortie");

            migrationBuilder.RenameTable(
                name: "tableau",
                newName: "tableau");

            migrationBuilder.RenameTable(
                name: "EtatsDeSortie",
                newName: "tableauRecaps");

            migrationBuilder.RenameIndex(
                name: "IX_tableau_UserId_TabKey_Mois_Annee",
                table: "tableau",
                newName: "IX_tableau_UserId_TabKey_Mois_Annee");

            migrationBuilder.RenameIndex(
                name: "IX_tableau_UserId",
                table: "tableau",
                newName: "IX_tableau_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_tableau_IsApproved",
                table: "tableau",
                newName: "IX_tableau_IsApproved");

            migrationBuilder.RenameIndex(
                name: "IX_tableau_ApprovedByUserId",
                table: "tableau",
                newName: "IX_tableau_ApprovedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_EtatsDeSortie_UserId",
                table: "tableauRecaps",
                newName: "IX_tableauRecaps_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_EtatsDeSortie_Key_Mois_Annee",
                table: "tableauRecaps",
                newName: "IX_tableauRecaps_Key_Mois_Annee");

            migrationBuilder.AddPrimaryKey(
                name: "PK_tableau",
                table: "tableau",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_tableauRecaps",
                table: "tableauRecaps",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_tableau_Users_ApprovedByUserId",
                table: "tableau",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // ✅ CORRECTION aussi dans Down()
            migrationBuilder.AddForeignKey(
                name: "FK_tableau_Users_UserId",
                table: "tableau",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.AddForeignKey(
                name: "FK_tableauRecaps_Users_UserId",
                table: "tableauRecaps",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}