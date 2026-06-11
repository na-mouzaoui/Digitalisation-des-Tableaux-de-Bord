using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUnusedColumnsFromValeurs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Valeurs_IsApproved",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "Annee",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "ApprovedByDirecteurAt",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "ApprovedByDivisionnaireAt",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "Direction",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "IsApproved",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "Mois",
                table: "Valeurs");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Annee",
                table: "Valeurs",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "Valeurs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedByDirecteurAt",
                table: "Valeurs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedByDivisionnaireAt",
                table: "Valeurs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Direction",
                table: "Valeurs",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsApproved",
                table: "Valeurs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Mois",
                table: "Valeurs",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_IsApproved",
                table: "Valeurs",
                column: "IsApproved");
        }
    }
}
