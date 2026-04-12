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
            migrationBuilder.DropForeignKey(
                name: "FK_FiscalDeclarations_Users_ApprovedByUserId",
                table: "FiscalDeclarations");

            migrationBuilder.DropForeignKey(
                name: "FK_FiscalDeclarations_Users_UserId",
                table: "FiscalDeclarations");

            migrationBuilder.DropForeignKey(
                name: "FK_FiscalRecaps_Users_UserId",
                table: "FiscalRecaps");

            migrationBuilder.DropPrimaryKey(
                name: "PK_FiscalDeclarations",
                table: "FiscalDeclarations");

            migrationBuilder.DropPrimaryKey(
                name: "PK_FiscalRecaps",
                table: "FiscalRecaps");

            migrationBuilder.RenameTable(
                name: "FiscalDeclarations",
                newName: "Declaration");

            migrationBuilder.RenameTable(
                name: "FiscalRecaps",
                newName: "EtatsDeSortie");

            migrationBuilder.RenameIndex(
                name: "IX_FiscalDeclarations_UserId_TabKey_Mois_Annee",
                table: "Declaration",
                newName: "IX_Declaration_UserId_TabKey_Mois_Annee");

            migrationBuilder.RenameIndex(
                name: "IX_FiscalDeclarations_UserId",
                table: "Declaration",
                newName: "IX_Declaration_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_FiscalDeclarations_IsApproved",
                table: "Declaration",
                newName: "IX_Declaration_IsApproved");

            migrationBuilder.RenameIndex(
                name: "IX_FiscalDeclarations_ApprovedByUserId",
                table: "Declaration",
                newName: "IX_Declaration_ApprovedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_FiscalRecaps_UserId",
                table: "EtatsDeSortie",
                newName: "IX_EtatsDeSortie_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_FiscalRecaps_Key_Mois_Annee",
                table: "EtatsDeSortie",
                newName: "IX_EtatsDeSortie_Key_Mois_Annee");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Declaration",
                table: "Declaration",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_EtatsDeSortie",
                table: "EtatsDeSortie",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Declaration_Users_ApprovedByUserId",
                table: "Declaration",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Declaration_Users_UserId",
                table: "Declaration",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_EtatsDeSortie_Users_UserId",
                table: "EtatsDeSortie",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
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
