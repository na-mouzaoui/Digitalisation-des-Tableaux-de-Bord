using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    public partial class RenameRealisationTechniqueReseauKpi : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE [Kpis] SET [Nom] = N'suivi_infrastructures_reseau' WHERE [Id] = 13;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE [Kpis] SET [Nom] = N'realisation_technique_reseau' WHERE [Id] = 13;
");
        }
    }
}
