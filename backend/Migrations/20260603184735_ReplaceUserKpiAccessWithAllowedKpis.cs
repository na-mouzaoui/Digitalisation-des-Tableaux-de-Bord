using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceUserKpiAccessWithAllowedKpis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AllowedKpis",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            // Migrate existing UserKpiAccesses data into AllowedKpis column
            migrationBuilder.Sql(@"
                UPDATE u
                SET u.AllowedKpis = (
                    SELECT STRING_AGG(CAST(ukpi.KpiId AS VARCHAR), ',') WITHIN GROUP (ORDER BY ukpi.KpiId)
                    FROM UserKpiAccesses ukpi
                    WHERE ukpi.UserId = u.Id
                )
                FROM Users u
                WHERE EXISTS (SELECT 1 FROM UserKpiAccesses ukpi WHERE ukpi.UserId = u.Id)
            ");

            migrationBuilder.DropTable(
                name: "UserKpiAccesses");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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

            // Migrate data back from AllowedKpis to UserKpiAccesses
            migrationBuilder.Sql(@"
                INSERT INTO UserKpiAccesses (UserId, KpiId)
                SELECT u.Id, CAST(value AS INT)
                FROM Users u
                CROSS APPLY STRING_SPLIT(u.AllowedKpis, ',')
                WHERE u.AllowedKpis IS NOT NULL AND u.AllowedKpis != ''
            ");

            migrationBuilder.DropColumn(
                name: "AllowedKpis",
                table: "Users");
        }
    }
}
