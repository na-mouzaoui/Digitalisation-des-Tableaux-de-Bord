using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTableauTableAndUseValeursOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Tableau");

            migrationBuilder.DropIndex(
                name: "IX_Valeurs_Id_SousKpi_Id_Periode",
                table: "Valeurs");

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

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByDirecteurUserId",
                table: "Valeurs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedByDivisionnaireAt",
                table: "Valeurs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByDivisionnaireUserId",
                table: "Valeurs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByUserId",
                table: "Valeurs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Valeurs",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

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

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Valeurs",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "Valeurs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Supprimer les anciennes lignes Valeurs orphelines (sans UserId/Direction)
            // qui ont été créées via l'ancien système basé sur Tableau+DataJson
            migrationBuilder.Sql("DELETE FROM [dbo].[Valeurs]");

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_ApprovedByDirecteurUserId",
                table: "Valeurs",
                column: "ApprovedByDirecteurUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_ApprovedByDivisionnaireUserId",
                table: "Valeurs",
                column: "ApprovedByDivisionnaireUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_ApprovedByUserId",
                table: "Valeurs",
                column: "ApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_Id_SousKpi",
                table: "Valeurs",
                column: "Id_SousKpi");

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_IsApproved",
                table: "Valeurs",
                column: "IsApproved");

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_UserId",
                table: "Valeurs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_UserId_Id_Periode_Id_SousKpi",
                table: "Valeurs",
                columns: new[] { "UserId", "Id_Periode", "Id_SousKpi" });

            migrationBuilder.AddForeignKey(
                name: "FK_Valeurs_Users_ApprovedByDirecteurUserId",
                table: "Valeurs",
                column: "ApprovedByDirecteurUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Valeurs_Users_ApprovedByDivisionnaireUserId",
                table: "Valeurs",
                column: "ApprovedByDivisionnaireUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Valeurs_Users_ApprovedByUserId",
                table: "Valeurs",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Valeurs_Users_UserId",
                table: "Valeurs",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Valeurs_Users_ApprovedByDirecteurUserId",
                table: "Valeurs");

            migrationBuilder.DropForeignKey(
                name: "FK_Valeurs_Users_ApprovedByDivisionnaireUserId",
                table: "Valeurs");

            migrationBuilder.DropForeignKey(
                name: "FK_Valeurs_Users_ApprovedByUserId",
                table: "Valeurs");

            migrationBuilder.DropForeignKey(
                name: "FK_Valeurs_Users_UserId",
                table: "Valeurs");

            migrationBuilder.DropIndex(
                name: "IX_Valeurs_ApprovedByDirecteurUserId",
                table: "Valeurs");

            migrationBuilder.DropIndex(
                name: "IX_Valeurs_ApprovedByDivisionnaireUserId",
                table: "Valeurs");

            migrationBuilder.DropIndex(
                name: "IX_Valeurs_ApprovedByUserId",
                table: "Valeurs");

            migrationBuilder.DropIndex(
                name: "IX_Valeurs_Id_SousKpi",
                table: "Valeurs");

            migrationBuilder.DropIndex(
                name: "IX_Valeurs_IsApproved",
                table: "Valeurs");

            migrationBuilder.DropIndex(
                name: "IX_Valeurs_UserId",
                table: "Valeurs");

            migrationBuilder.DropIndex(
                name: "IX_Valeurs_UserId_Id_Periode_Id_SousKpi",
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
                name: "ApprovedByDirecteurUserId",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "ApprovedByDivisionnaireAt",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "ApprovedByDivisionnaireUserId",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
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

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Valeurs");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Valeurs");

            migrationBuilder.CreateTable(
                name: "Tableau",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ApprovedByDirecteurUserId = table.Column<int>(type: "int", nullable: true),
                    ApprovedByDivisionnaireUserId = table.Column<int>(type: "int", nullable: true),
                    ApprovedByUserId = table.Column<int>(type: "int", nullable: true),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Annee = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovedByDirecteurAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovedByDivisionnaireAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DataJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsApproved = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Mois = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    TabKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tableau", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Tableau_Users_ApprovedByDirecteurUserId",
                        column: x => x.ApprovedByDirecteurUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tableau_Users_ApprovedByDivisionnaireUserId",
                        column: x => x.ApprovedByDivisionnaireUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tableau_Users_ApprovedByUserId",
                        column: x => x.ApprovedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tableau_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Valeurs_Id_SousKpi_Id_Periode",
                table: "Valeurs",
                columns: new[] { "Id_SousKpi", "Id_Periode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tableau_ApprovedByDirecteurUserId",
                table: "Tableau",
                column: "ApprovedByDirecteurUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Tableau_ApprovedByDivisionnaireUserId",
                table: "Tableau",
                column: "ApprovedByDivisionnaireUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Tableau_ApprovedByUserId",
                table: "Tableau",
                column: "ApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Tableau_IsApproved",
                table: "Tableau",
                column: "IsApproved");

            migrationBuilder.CreateIndex(
                name: "IX_Tableau_UserId",
                table: "Tableau",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Tableau_UserId_TabKey_Mois_Annee",
                table: "Tableau",
                columns: new[] { "UserId", "TabKey", "Mois", "Annee" });
        }
    }
}
