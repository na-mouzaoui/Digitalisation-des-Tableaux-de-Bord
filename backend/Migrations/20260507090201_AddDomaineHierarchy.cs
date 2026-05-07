using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddDomaineHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CategorieId",
                table: "Kpis",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Domaines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Designation = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Domaines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SousDomaines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DomaineId = table.Column<int>(type: "int", nullable: false),
                    Designation = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SousDomaines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SousDomaines_Domaines_DomaineId",
                        column: x => x.DomaineId,
                        principalTable: "Domaines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

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
                name: "IX_Kpis_CategorieId",
                table: "Kpis",
                column: "CategorieId");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_SousDomaineId",
                table: "Categories",
                column: "SousDomaineId");

            migrationBuilder.CreateIndex(
                name: "IX_SousDomaines_DomaineId",
                table: "SousDomaines",
                column: "DomaineId");

            migrationBuilder.AddForeignKey(
                name: "FK_Kpis_Categories_CategorieId",
                table: "Kpis",
                column: "CategorieId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Kpis_Categories_CategorieId",
                table: "Kpis");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "SousDomaines");

            migrationBuilder.DropTable(
                name: "Domaines");

            migrationBuilder.DropIndex(
                name: "IX_Kpis_CategorieId",
                table: "Kpis");

            migrationBuilder.DropColumn(
                name: "CategorieId",
                table: "Kpis");
        }
    }
}
