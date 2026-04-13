using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class RenameFiscalTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[FiscalDeclarations]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[Declaration]', N'U') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_FiscalDeclarations_Users_ApprovedByUserId')
        ALTER TABLE [dbo].[FiscalDeclarations] DROP CONSTRAINT [FK_FiscalDeclarations_Users_ApprovedByUserId];

    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_FiscalDeclarations_Users_UserId')
        ALTER TABLE [dbo].[FiscalDeclarations] DROP CONSTRAINT [FK_FiscalDeclarations_Users_UserId];

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_FiscalDeclarations')
        ALTER TABLE [dbo].[FiscalDeclarations] DROP CONSTRAINT [PK_FiscalDeclarations];

    EXEC sp_rename N'[dbo].[FiscalDeclarations]', N'Declaration';
END

IF OBJECT_ID(N'[dbo].[FiscalRecaps]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[EtatsDeSortie]', N'U') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_FiscalRecaps_Users_UserId')
        ALTER TABLE [dbo].[FiscalRecaps] DROP CONSTRAINT [FK_FiscalRecaps_Users_UserId];

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_FiscalRecaps')
        ALTER TABLE [dbo].[FiscalRecaps] DROP CONSTRAINT [PK_FiscalRecaps];

    EXEC sp_rename N'[dbo].[FiscalRecaps]', N'EtatsDeSortie';
END

IF OBJECT_ID(N'[dbo].[Declaration]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_FiscalDeclarations_UserId_TabKey_Mois_Annee' AND [object_id] = OBJECT_ID(N'[dbo].[Declaration]'))
        EXEC sp_rename N'[dbo].[Declaration].[IX_FiscalDeclarations_UserId_TabKey_Mois_Annee]', N'IX_Declaration_UserId_TabKey_Mois_Annee', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_FiscalDeclarations_UserId' AND [object_id] = OBJECT_ID(N'[dbo].[Declaration]'))
        EXEC sp_rename N'[dbo].[Declaration].[IX_FiscalDeclarations_UserId]', N'IX_Declaration_UserId', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_FiscalDeclarations_IsApproved' AND [object_id] = OBJECT_ID(N'[dbo].[Declaration]'))
        EXEC sp_rename N'[dbo].[Declaration].[IX_FiscalDeclarations_IsApproved]', N'IX_Declaration_IsApproved', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_FiscalDeclarations_ApprovedByUserId' AND [object_id] = OBJECT_ID(N'[dbo].[Declaration]'))
        EXEC sp_rename N'[dbo].[Declaration].[IX_FiscalDeclarations_ApprovedByUserId]', N'IX_Declaration_ApprovedByUserId', N'INDEX';

    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_Declaration')
        ALTER TABLE [dbo].[Declaration] ADD CONSTRAINT [PK_Declaration] PRIMARY KEY ([Id]);

    IF COL_LENGTH(N'[dbo].[Declaration]', N'ApprovedByUserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Declaration_Users_ApprovedByUserId')
        ALTER TABLE [dbo].[Declaration] WITH CHECK
        ADD CONSTRAINT [FK_Declaration_Users_ApprovedByUserId]
            FOREIGN KEY([ApprovedByUserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION;

    IF COL_LENGTH(N'[dbo].[Declaration]', N'UserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Declaration_Users_UserId')
        ALTER TABLE [dbo].[Declaration] WITH CHECK
        ADD CONSTRAINT [FK_Declaration_Users_UserId]
            FOREIGN KEY([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE;
END

IF OBJECT_ID(N'[dbo].[EtatsDeSortie]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_FiscalRecaps_UserId' AND [object_id] = OBJECT_ID(N'[dbo].[EtatsDeSortie]'))
        EXEC sp_rename N'[dbo].[EtatsDeSortie].[IX_FiscalRecaps_UserId]', N'IX_EtatsDeSortie_UserId', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_FiscalRecaps_Key_Mois_Annee' AND [object_id] = OBJECT_ID(N'[dbo].[EtatsDeSortie]'))
        EXEC sp_rename N'[dbo].[EtatsDeSortie].[IX_FiscalRecaps_Key_Mois_Annee]', N'IX_EtatsDeSortie_Key_Mois_Annee', N'INDEX';

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
                name: "FK_Declaration_Users_ApprovedByUserId",
                table: "Declaration");

            migrationBuilder.DropForeignKey(
                name: "FK_Declaration_Users_UserId",
                table: "Declaration");

            migrationBuilder.DropForeignKey(
                name: "FK_EtatsDeSortie_Users_UserId",
                table: "EtatsDeSortie");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Declaration",
                table: "Declaration");

            migrationBuilder.DropPrimaryKey(
                name: "PK_EtatsDeSortie",
                table: "EtatsDeSortie");

            migrationBuilder.RenameTable(
                name: "Declaration",
                newName: "FiscalDeclarations");

            migrationBuilder.RenameTable(
                name: "EtatsDeSortie",
                newName: "FiscalRecaps");

            migrationBuilder.RenameIndex(
                name: "IX_Declaration_UserId_TabKey_Mois_Annee",
                table: "FiscalDeclarations",
                newName: "IX_FiscalDeclarations_UserId_TabKey_Mois_Annee");

            migrationBuilder.RenameIndex(
                name: "IX_Declaration_UserId",
                table: "FiscalDeclarations",
                newName: "IX_FiscalDeclarations_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Declaration_IsApproved",
                table: "FiscalDeclarations",
                newName: "IX_FiscalDeclarations_IsApproved");

            migrationBuilder.RenameIndex(
                name: "IX_Declaration_ApprovedByUserId",
                table: "FiscalDeclarations",
                newName: "IX_FiscalDeclarations_ApprovedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_EtatsDeSortie_UserId",
                table: "FiscalRecaps",
                newName: "IX_FiscalRecaps_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_EtatsDeSortie_Key_Mois_Annee",
                table: "FiscalRecaps",
                newName: "IX_FiscalRecaps_Key_Mois_Annee");

            migrationBuilder.AddPrimaryKey(
                name: "PK_FiscalDeclarations",
                table: "FiscalDeclarations",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_FiscalRecaps",
                table: "FiscalRecaps",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FiscalDeclarations_Users_ApprovedByUserId",
                table: "FiscalDeclarations",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_FiscalDeclarations_Users_UserId",
                table: "FiscalDeclarations",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FiscalRecaps_Users_UserId",
                table: "FiscalRecaps",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
