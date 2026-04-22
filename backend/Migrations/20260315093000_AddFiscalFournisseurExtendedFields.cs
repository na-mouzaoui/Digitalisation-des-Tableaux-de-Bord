using CheckFillingAPI.Data;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260315093000_AddTableuFournisseurExtendedFields")]
    public partial class AddTableuFournisseurExtendedFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Adresse",
                table: "TableuFournisseurs",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AuthNIF",
                table: "TableuFournisseurs",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AuthRC",
                table: "TableuFournisseurs",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Adresse",
                table: "TableuFournisseurs");

            migrationBuilder.DropColumn(
                name: "AuthNIF",
                table: "TableuFournisseurs");

            migrationBuilder.DropColumn(
                name: "AuthRC",
                table: "TableuFournisseurs");
        }
    }
}
