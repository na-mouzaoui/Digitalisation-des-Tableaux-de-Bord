using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAutresProduitsSousKpi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Shift existing rows (Order >= 4) to make room for the new line
UPDATE [SousKpis] SET [Order] = [Order] + 1000 WHERE [KpiId] = 31 AND [Order] >= 4;

-- Insert Autres produits between Total CA (order 3) and Consommation de l'exercice (was order 4, now 5)
INSERT INTO [SousKpis] ([KpiId], [Designation], [Order]) VALUES (31, N'Autres produits', 4);

-- Restore shifted rows to their new positions (original order + 1)
UPDATE [SousKpis] SET [Order] = [Order] - 999 WHERE [KpiId] = 31 AND [Order] >= 1004;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Shift rows after Autres produits to temporary high values
UPDATE [SousKpis] SET [Order] = [Order] + 1000 WHERE [KpiId] = 31 AND [Order] >= 5;

-- Remove Autres produits
DELETE FROM [SousKpis] WHERE [KpiId] = 31 AND [Designation] = N'Autres produits' AND [Order] = 4;

-- Restore shifted rows to original positions (original order - 1)
UPDATE [SousKpis] SET [Order] = [Order] - 1001 WHERE [KpiId] = 31 AND [Order] >= 1005;
");
        }
    }
}
