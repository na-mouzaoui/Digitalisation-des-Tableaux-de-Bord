using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddtableauRecapsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tableauRecaps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Mois = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Annee = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RowsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FormulasJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsGenerated = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tableauRecaps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tableauRecaps_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tableauRecaps_Key_Mois_Annee",
                table: "tableauRecaps",
                columns: new[] { "Key", "Mois", "Annee" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tableauRecaps_UserId",
                table: "tableauRecaps",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tableauRecaps");
        }
    }
}
