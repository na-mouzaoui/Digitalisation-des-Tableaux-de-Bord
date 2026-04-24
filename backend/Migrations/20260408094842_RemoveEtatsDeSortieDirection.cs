using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalisationDesTableauxDeBordAPI.Migrations
{
    /// <inheritdoc />
    public partial class RemoveEtatsDeSortieDirection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Direction",
                table: "EtatsDeSortie");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Direction",
                table: "EtatsDeSortie",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }
    }
}
