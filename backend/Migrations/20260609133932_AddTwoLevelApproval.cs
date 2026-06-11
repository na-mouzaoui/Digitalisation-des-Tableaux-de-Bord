using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddTwoLevelApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedByDirecteurAt",
                table: "Tableau",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByDirecteurUserId",
                table: "Tableau",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedByDivisionnaireAt",
                table: "Tableau",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByDivisionnaireUserId",
                table: "Tableau",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tableau_ApprovedByDirecteurUserId",
                table: "Tableau",
                column: "ApprovedByDirecteurUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Tableau_ApprovedByDivisionnaireUserId",
                table: "Tableau",
                column: "ApprovedByDivisionnaireUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tableau_Users_ApprovedByDirecteurUserId",
                table: "Tableau",
                column: "ApprovedByDirecteurUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Tableau_Users_ApprovedByDivisionnaireUserId",
                table: "Tableau",
                column: "ApprovedByDivisionnaireUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tableau_Users_ApprovedByDirecteurUserId",
                table: "Tableau");

            migrationBuilder.DropForeignKey(
                name: "FK_Tableau_Users_ApprovedByDivisionnaireUserId",
                table: "Tableau");

            migrationBuilder.DropIndex(
                name: "IX_Tableau_ApprovedByDirecteurUserId",
                table: "Tableau");

            migrationBuilder.DropIndex(
                name: "IX_Tableau_ApprovedByDivisionnaireUserId",
                table: "Tableau");

            migrationBuilder.DropColumn(
                name: "ApprovedByDirecteurAt",
                table: "Tableau");

            migrationBuilder.DropColumn(
                name: "ApprovedByDirecteurUserId",
                table: "Tableau");

            migrationBuilder.DropColumn(
                name: "ApprovedByDivisionnaireAt",
                table: "Tableau");

            migrationBuilder.DropColumn(
                name: "ApprovedByDivisionnaireUserId",
                table: "Tableau");
        }
    }
}
