using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class RenameTableuTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Tableu_Users_ApprovedByUserId')
        ALTER TABLE [dbo].[Tableu] DROP CONSTRAINT [FK_Tableu_Users_ApprovedByUserId];

    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Tableu_Users_UserId')
        ALTER TABLE [dbo].[Tableu] DROP CONSTRAINT [FK_Tableu_Users_UserId];

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_Tableu')
        ALTER TABLE [dbo].[Tableu] DROP CONSTRAINT [PK_Tableu];

    EXEC sp_rename N'[dbo].[Tableu]', N'Tableu';
END

IF OBJECT_ID(N'[dbo].[TableuRecaps]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[EtatsDeSortie]', N'U') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_TableuRecaps_Users_UserId')
        ALTER TABLE [dbo].[TableuRecaps] DROP CONSTRAINT [FK_TableuRecaps_Users_UserId];

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_TableuRecaps')
        ALTER TABLE [dbo].[TableuRecaps] DROP CONSTRAINT [PK_TableuRecaps];

    EXEC sp_rename N'[dbo].[TableuRecaps]', N'EtatsDeSortie';
END

IF OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Tableu_UserId_TabKey_Mois_Annee' AND [object_id] = OBJECT_ID(N'[dbo].[Tableu]'))
        EXEC sp_rename N'[dbo].[Tableu].[IX_Tableu_UserId_TabKey_Mois_Annee]', N'IX_Tableu_UserId_TabKey_Mois_Annee', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Tableu_UserId' AND [object_id] = OBJECT_ID(N'[dbo].[Tableu]'))
        EXEC sp_rename N'[dbo].[Tableu].[IX_Tableu_UserId]', N'IX_Tableu_UserId', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Tableu_IsApproved' AND [object_id] = OBJECT_ID(N'[dbo].[Tableu]'))
        EXEC sp_rename N'[dbo].[Tableu].[IX_Tableu_IsApproved]', N'IX_Tableu_IsApproved', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Tableu_ApprovedByUserId' AND [object_id] = OBJECT_ID(N'[dbo].[Tableu]'))
        EXEC sp_rename N'[dbo].[Tableu].[IX_Tableu_ApprovedByUserId]', N'IX_Tableu_ApprovedByUserId', N'INDEX';

    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE [name] = N'PK_Tableu')
        ALTER TABLE [dbo].[Tableu] ADD CONSTRAINT [PK_Tableu] PRIMARY KEY ([Id]);

    IF COL_LENGTH(N'[dbo].[Tableu]', N'ApprovedByUserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Tableu_Users_ApprovedByUserId')
        ALTER TABLE [dbo].[Tableu] WITH CHECK
        ADD CONSTRAINT [FK_Tableu_Users_ApprovedByUserId]
            FOREIGN KEY([ApprovedByUserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION;

    IF COL_LENGTH(N'[dbo].[Tableu]', N'UserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_Tableu_Users_UserId')
        ALTER TABLE [dbo].[Tableu] WITH CHECK
        ADD CONSTRAINT [FK_Tableu_Users_UserId]
            FOREIGN KEY([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE;
END

IF OBJECT_ID(N'[dbo].[EtatsDeSortie]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_TableuRecaps_UserId' AND [object_id] = OBJECT_ID(N'[dbo].[EtatsDeSortie]'))
        EXEC sp_rename N'[dbo].[EtatsDeSortie].[IX_TableuRecaps_UserId]', N'IX_EtatsDeSortie_UserId', N'INDEX';

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_TableuRecaps_Key_Mois_Annee' AND [object_id] = OBJECT_ID(N'[dbo].[EtatsDeSortie]'))
        EXEC sp_rename N'[dbo].[EtatsDeSortie].[IX_TableuRecaps_Key_Mois_Annee]', N'IX_EtatsDeSortie_Key_Mois_Annee', N'INDEX';

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
                name: "FK_Tableu_Users_ApprovedByUserId",
                table: "Tableu");

            migrationBuilder.DropForeignKey(
                name: "FK_Tableu_Users_UserId",
                table: "Tableu");

            migrationBuilder.DropForeignKey(
                name: "FK_EtatsDeSortie_Users_UserId",
                table: "EtatsDeSortie");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Tableu",
                table: "Tableu");

            migrationBuilder.DropPrimaryKey(
                name: "PK_EtatsDeSortie",
                table: "EtatsDeSortie");

            migrationBuilder.RenameTable(
                name: "Tableu",
                newName: "Tableu");

            migrationBuilder.RenameTable(
                name: "EtatsDeSortie",
                newName: "TableuRecaps");

            migrationBuilder.RenameIndex(
                name: "IX_Tableu_UserId_TabKey_Mois_Annee",
                table: "Tableu",
                newName: "IX_Tableu_UserId_TabKey_Mois_Annee");

            migrationBuilder.RenameIndex(
                name: "IX_Tableu_UserId",
                table: "Tableu",
                newName: "IX_Tableu_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Tableu_IsApproved",
                table: "Tableu",
                newName: "IX_Tableu_IsApproved");

            migrationBuilder.RenameIndex(
                name: "IX_Tableu_ApprovedByUserId",
                table: "Tableu",
                newName: "IX_Tableu_ApprovedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_EtatsDeSortie_UserId",
                table: "TableuRecaps",
                newName: "IX_TableuRecaps_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_EtatsDeSortie_Key_Mois_Annee",
                table: "TableuRecaps",
                newName: "IX_TableuRecaps_Key_Mois_Annee");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Tableu",
                table: "Tableu",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_TableuRecaps",
                table: "TableuRecaps",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Tableu_Users_ApprovedByUserId",
                table: "Tableu",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Tableu_Users_UserId",
                table: "Tableu",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TableuRecaps_Users_UserId",
                table: "TableuRecaps",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
