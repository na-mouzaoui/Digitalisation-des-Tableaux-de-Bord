using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddUserKpiAccessTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserKpiAccesses",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    KpiId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserKpiAccesses", x => new { x.UserId, x.KpiId });
                    table.ForeignKey(
                        name: "FK_UserKpiAccesses_Kpis_KpiId",
                        column: x => x.KpiId,
                        principalTable: "Kpis",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserKpiAccesses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserKpiAccesses_KpiId",
                table: "UserKpiAccesses",
                column: "KpiId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserKpiAccesses");
        }
    }
}
