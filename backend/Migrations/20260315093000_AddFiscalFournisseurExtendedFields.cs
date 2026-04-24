using DigitalisationDesTableauxDeBordAPI.Data;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace DigitalisationDesTableauxDeBordAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260315093000_AddtableauFournisseurExtendedFields")]
    public partial class AddtableauFournisseurExtendedFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Adresse",
                table: "tableauFournisseurs",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AuthNIF",
                table: "tableauFournisseurs",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AuthRC",
                table: "tableauFournisseurs",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Adresse",
                table: "tableauFournisseurs");

            migrationBuilder.DropColumn(
                name: "AuthNIF",
                table: "tableauFournisseurs");

            migrationBuilder.DropColumn(
                name: "AuthRC",
                table: "tableauFournisseurs");
        }
    }
}
