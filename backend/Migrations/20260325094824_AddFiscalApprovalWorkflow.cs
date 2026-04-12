using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddFiscalApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsRegionalApprover",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "FiscalDeclarations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByUserId",
                table: "FiscalDeclarations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsApproved",
                table: "FiscalDeclarations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_FiscalDeclarations_ApprovedByUserId",
                table: "FiscalDeclarations",
                column: "ApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FiscalDeclarations_IsApproved",
                table: "FiscalDeclarations",
                column: "IsApproved");

            migrationBuilder.AddForeignKey(
                name: "FK_FiscalDeclarations_Users_ApprovedByUserId",
                table: "FiscalDeclarations",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FiscalDeclarations_Users_ApprovedByUserId",
                table: "FiscalDeclarations");

            migrationBuilder.DropIndex(
                name: "IX_FiscalDeclarations_ApprovedByUserId",
                table: "FiscalDeclarations");

            migrationBuilder.DropIndex(
                name: "IX_FiscalDeclarations_IsApproved",
                table: "FiscalDeclarations");

            migrationBuilder.DropColumn(
                name: "IsRegionalApprover",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "FiscalDeclarations");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "FiscalDeclarations");

            migrationBuilder.DropColumn(
                name: "IsApproved",
                table: "FiscalDeclarations");
        }
    }
}
