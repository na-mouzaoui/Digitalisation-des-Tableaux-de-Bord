using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalisationDesTableauxDeBordAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddtableauTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tableau",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TabKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Mois = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Annee = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DataJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tableau", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tableau_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tableau_UserId",
                table: "tableau",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_tableau_UserId_TabKey_Mois_Annee",
                table: "tableau",
                columns: new[] { "UserId", "TabKey", "Mois", "Annee" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "tableau");
        }
    }
}
