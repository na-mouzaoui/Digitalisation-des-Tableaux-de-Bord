using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalisationDesTableauxDeBordAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddtableauFournisseursTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tableauFournisseurs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RaisonSociale = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    RC = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NIF = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tableauFournisseurs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tableauFournisseurs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tableauFournisseurs_UserId",
                table: "tableauFournisseurs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tableauFournisseurs");
        }
    }
}
