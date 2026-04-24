using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalisationDesTableauxDeBordAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAdmintableauSettingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdmintableauSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    IsTable6Enabled = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdmintableauSettings", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "AdmintableauSettings",
                columns: new[] { "Id", "IsTable6Enabled", "UpdatedAt" },
                values: new object[] { 1, true, new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdmintableauSettings");
        }
    }
}
