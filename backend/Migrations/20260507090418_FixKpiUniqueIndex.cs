using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class FixKpiUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Kpis_CategorieId",
                table: "Kpis");

            migrationBuilder.DropIndex(
                name: "IX_Kpis_Nom",
                table: "Kpis");

            migrationBuilder.CreateIndex(
                name: "IX_Kpis_CategorieId_Nom",
                table: "Kpis",
                columns: new[] { "CategorieId", "Nom" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Kpis_CategorieId_Nom",
                table: "Kpis");

            migrationBuilder.CreateIndex(
                name: "IX_Kpis_CategorieId",
                table: "Kpis",
                column: "CategorieId");

            migrationBuilder.CreateIndex(
                name: "IX_Kpis_Nom",
                table: "Kpis",
                column: "Nom",
                unique: true);
        }
    }
}
