using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAllowedDomainesAndSousDomaines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AllowedDomaines",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AllowedSousDomaines",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "AllowedDomaines", "AllowedSousDomaines" },
                values: new object[] { "", "" });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "AllowedDomaines", "AllowedSousDomaines" },
                values: new object[] { "", "" });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "AllowedDomaines", "AllowedSousDomaines" },
                values: new object[] { "", "" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowedDomaines",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AllowedSousDomaines",
                table: "Users");
        }
    }
}
