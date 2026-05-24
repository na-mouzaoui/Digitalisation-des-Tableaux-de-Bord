using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceCategorieWithSousDomaineOnKpi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Kpis_Categories_CategorieId",
                table: "Kpis");

            migrationBuilder.RenameColumn(
                name: "CategorieId",
                table: "Kpis",
                newName: "SousDomaineId");

            migrationBuilder.RenameIndex(
                name: "IX_Kpis_CategorieId_Nom",
                table: "Kpis",
                newName: "IX_Kpis_SousDomaineId_Nom");

            migrationBuilder.Sql(@"
UPDATE k
SET k.SousDomaineId = c.SousDomaineId
FROM Kpis AS k
INNER JOIN Categories AS c ON c.Id = k.SousDomaineId;
");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.AddForeignKey(
                name: "FK_Kpis_SousDomaines_SousDomaineId",
                table: "Kpis",
                column: "SousDomaineId",
                principalTable: "SousDomaines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Kpis_SousDomaines_SousDomaineId",
                table: "Kpis");

            migrationBuilder.RenameColumn(
                name: "SousDomaineId",
                table: "Kpis",
                newName: "CategorieId");

            migrationBuilder.RenameIndex(
                name: "IX_Kpis_SousDomaineId_Nom",
                table: "Kpis",
                newName: "IX_Kpis_CategorieId_Nom");

            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SousDomaineId = table.Column<int>(type: "int", nullable: false),
                    Designation = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Categories_SousDomaines_SousDomaineId",
                        column: x => x.SousDomaineId,
                        principalTable: "SousDomaines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_SousDomaineId",
                table: "Categories",
                column: "SousDomaineId");

            migrationBuilder.Sql(@"
INSERT INTO Categories (SousDomaineId, Designation)
SELECT Id, Designation
FROM SousDomaines;
");

            migrationBuilder.Sql(@"
UPDATE k
SET k.CategorieId = c.Id
FROM Kpis AS k
INNER JOIN Categories AS c ON c.SousDomaineId = k.CategorieId;
");

            migrationBuilder.AddForeignKey(
                name: "FK_Kpis_Categories_CategorieId",
                table: "Kpis",
                column: "CategorieId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
