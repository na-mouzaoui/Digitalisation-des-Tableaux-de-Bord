using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace DigitalisationDesTableauxDeBordAPI.Migrations
{
    /// <inheritdoc />
    public partial class _20260505_InitialFullSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tableau_Users_ApprovedByUserId",
                table: "tableau");

            migrationBuilder.DropForeignKey(
                name: "FK_tableau_Users_UserId",
                table: "tableau");

            migrationBuilder.DropTable(
                name: "Checks");

            migrationBuilder.DropTable(
                name: "EtatsDeSortie");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropTable(
                name: "tableauFournisseurs");

            migrationBuilder.DropTable(
                name: "UserBankCalibrations");

            migrationBuilder.DropTable(
                name: "Checkbooks");

            migrationBuilder.DropTable(
                name: "Banks");

            migrationBuilder.DropPrimaryKey(
                name: "PK_tableau",
                table: "tableau");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Regions",
                table: "Regions");

            migrationBuilder.DropIndex(
                name: "IX_Regions_Name",
                table: "Regions");

            migrationBuilder.DeleteData(
                table: "Regions",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "Regions",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "Regions",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "Regions",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DropColumn(
                name: "AccessModules",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsFinanceApprover",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsRegionalApprover",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Regions");

            migrationBuilder.RenameTable(
                name: "tableau",
                newName: "Tableau");

            migrationBuilder.RenameTable(
                name: "Regions",
                newName: "DR");

            migrationBuilder.RenameIndex(
                name: "IX_tableau_UserId_TabKey_Mois_Annee",
                table: "Tableau",
                newName: "IX_Tableau_UserId_TabKey_Mois_Annee");

            migrationBuilder.RenameIndex(
                name: "IX_tableau_UserId",
                table: "Tableau",
                newName: "IX_Tableau_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_tableau_IsApproved",
                table: "Tableau",
                newName: "IX_Tableau_IsApproved");

            migrationBuilder.RenameIndex(
                name: "IX_tableau_ApprovedByUserId",
                table: "Tableau",
                newName: "IX_Tableau_ApprovedByUserId");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "DR",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "VillesJson",
                table: "DR",
                newName: "wilayas");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "DR",
                newName: "nom");

            migrationBuilder.AlterColumn<string>(
                name: "wilayas",
                table: "DR",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "nom",
                table: "DR",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Tableau",
                table: "Tableau",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_DR",
                table: "DR",
                column: "id");

            migrationBuilder.CreateTable(
                name: "AdminSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DisabledTabKeysJson = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "[]"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Wilaya",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    nom = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Wilaya", x => x.id);
                });

            migrationBuilder.InsertData(
                table: "AdminSettings",
                columns: new[] { "Id", "DisabledTabKeysJson", "UpdatedAt" },
                values: new object[] { 1, "[]", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.AddForeignKey(
                name: "FK_Tableau_Users_ApprovedByUserId",
                table: "Tableau",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Tableau_Users_UserId",
                table: "Tableau",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tableau_Users_ApprovedByUserId",
                table: "Tableau");

            migrationBuilder.DropForeignKey(
                name: "FK_Tableau_Users_UserId",
                table: "Tableau");

            migrationBuilder.DropTable(
                name: "AdminSettings");

            migrationBuilder.DropTable(
                name: "Wilaya");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Tableau",
                table: "Tableau");

            migrationBuilder.DropPrimaryKey(
                name: "PK_DR",
                table: "DR");

            migrationBuilder.RenameTable(
                name: "Tableau",
                newName: "tableau");

            migrationBuilder.RenameTable(
                name: "DR",
                newName: "Regions");

            migrationBuilder.RenameIndex(
                name: "IX_Tableau_UserId_TabKey_Mois_Annee",
                table: "tableau",
                newName: "IX_tableau_UserId_TabKey_Mois_Annee");

            migrationBuilder.RenameIndex(
                name: "IX_Tableau_UserId",
                table: "tableau",
                newName: "IX_tableau_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Tableau_IsApproved",
                table: "tableau",
                newName: "IX_tableau_IsApproved");

            migrationBuilder.RenameIndex(
                name: "IX_Tableau_ApprovedByUserId",
                table: "tableau",
                newName: "IX_tableau_ApprovedByUserId");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "Regions",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "wilayas",
                table: "Regions",
                newName: "VillesJson");

            migrationBuilder.RenameColumn(
                name: "nom",
                table: "Regions",
                newName: "Name");

            migrationBuilder.AddColumn<string>(
                name: "AccessModules",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsFinanceApprover",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRegionalApprover",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "VillesJson",
                table: "Regions",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Regions",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(150)",
                oldMaxLength: 150);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Regions",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddPrimaryKey(
                name: "PK_tableau",
                table: "tableau",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Regions",
                table: "Regions",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "Banks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PdfUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PositionsJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Banks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EtatsDeSortie",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Annee = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FormulasJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsGenerated = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    Key = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Mois = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    RowsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EtatsDeSortie", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EtatsDeSortie_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CompanyType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tableauFournisseurs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Adresse = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AuthNIF = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    AuthRC = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NIF = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RC = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RaisonSociale = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tableauFournisseurs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tableauFournisseurs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Checkbooks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BankId = table.Column<int>(type: "int", nullable: false),
                    AgencyCode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AgencyName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndNumber = table.Column<int>(type: "int", nullable: false),
                    Serie = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    StartNumber = table.Column<int>(type: "int", nullable: false),
                    UsedCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Checkbooks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Checkbooks_Banks_BankId",
                        column: x => x.BankId,
                        principalTable: "Banks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserBankCalibrations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BankId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PositionsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserBankCalibrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserBankCalibrations_Banks_BankId",
                        column: x => x.BankId,
                        principalTable: "Banks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserBankCalibrations_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Checks",
                columns: table => new
                {
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CheckbookId = table.Column<int>(type: "int", nullable: true),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    City = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Motif = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Payee = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "emit"),
                    Ville = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Checks", x => x.Reference);
                    table.ForeignKey(
                        name: "FK_Checks_Checkbooks_CheckbookId",
                        column: x => x.CheckbookId,
                        principalTable: "Checkbooks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Checks_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Banks",
                columns: new[] { "Id", "Code", "CreatedAt", "Name", "PdfUrl", "PositionsJson" },
                values: new object[,]
                {
                    { 1, "BNA", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "BNA - Banque Nationale d'Alg?rie", null, "{\"City\":{\"X\":50,\"Y\":100,\"Width\":150,\"FontSize\":14,\"Rotation\":0},\"Date\":{\"X\":400,\"Y\":100,\"Width\":150,\"FontSize\":14,\"Rotation\":0},\"Payee\":{\"X\":120,\"Y\":180,\"Width\":400,\"FontSize\":14,\"Rotation\":0},\"AmountInWords\":{\"X\":120,\"Y\":240,\"Width\":500,\"FontSize\":12,\"Rotation\":0},\"AmountInWordsLine2\":null,\"Amount\":{\"X\":450,\"Y\":300,\"Width\":150,\"FontSize\":18,\"Rotation\":0},\"CheckLayout\":null}" },
                    { 2, "CPA", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "CPA - Cr?dit Populaire d'Alg?rie", null, "{\"City\":{\"X\":50,\"Y\":100,\"Width\":150,\"FontSize\":14,\"Rotation\":0},\"Date\":{\"X\":400,\"Y\":100,\"Width\":150,\"FontSize\":14,\"Rotation\":0},\"Payee\":{\"X\":120,\"Y\":180,\"Width\":400,\"FontSize\":14,\"Rotation\":0},\"AmountInWords\":{\"X\":120,\"Y\":240,\"Width\":500,\"FontSize\":12,\"Rotation\":0},\"AmountInWordsLine2\":null,\"Amount\":{\"X\":450,\"Y\":300,\"Width\":150,\"FontSize\":18,\"Rotation\":0},\"CheckLayout\":null}" },
                    { 3, "BEA", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "BEA - Banque Ext?rieure d'Alg?rie", null, "{\"City\":{\"X\":50,\"Y\":100,\"Width\":150,\"FontSize\":14,\"Rotation\":0},\"Date\":{\"X\":400,\"Y\":100,\"Width\":150,\"FontSize\":14,\"Rotation\":0},\"Payee\":{\"X\":120,\"Y\":180,\"Width\":400,\"FontSize\":14,\"Rotation\":0},\"AmountInWords\":{\"X\":120,\"Y\":240,\"Width\":500,\"FontSize\":12,\"Rotation\":0},\"AmountInWordsLine2\":null,\"Amount\":{\"X\":450,\"Y\":300,\"Width\":150,\"FontSize\":18,\"Rotation\":0},\"CheckLayout\":null}" }
                });

            migrationBuilder.InsertData(
                table: "Regions",
                columns: new[] { "Id", "CreatedAt", "Name", "VillesJson" },
                values: new object[,]
                {
                    { 1, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "nord", "[\"Alger\", \"Tipaza\", \"Boumerdes\", \"Blida\", \"Ain Defla\"]" },
                    { 2, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "sud", "[\"Ouargla\", \"Ghardaia\", \"Tamanrasset\", \"Adrar\", \"Illizi\"]" },
                    { 3, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "est", "[\"Constantine\", \"Annaba\", \"S?tif\", \"Batna\", \"Guelma\"]" },
                    { 4, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "ouest", "[\"Oran\", \"Tlemcen\", \"Sidi Bel Abb?s\", \"Mostaganem\", \"Mascara\"]" }
                });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 1,
                column: "AccessModules",
                value: "cheque,tableau");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 2,
                column: "AccessModules",
                value: "cheque,tableau");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 3,
                column: "AccessModules",
                value: "cheque,tableau");

            migrationBuilder.CreateIndex(
                name: "IX_Regions_Name",
                table: "Regions",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Banks_Code",
                table: "Banks",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Checkbooks_BankId_Serie_StartNumber",
                table: "Checkbooks",
                columns: new[] { "BankId", "Serie", "StartNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Checks_CheckbookId",
                table: "Checks",
                column: "CheckbookId");

            migrationBuilder.CreateIndex(
                name: "IX_Checks_UserId",
                table: "Checks",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_EtatsDeSortie_Key_Mois_Annee",
                table: "EtatsDeSortie",
                columns: new[] { "Key", "Mois", "Annee" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EtatsDeSortie_UserId",
                table: "EtatsDeSortie",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_Name",
                table: "Suppliers",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_tableauFournisseurs_UserId",
                table: "tableauFournisseurs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserBankCalibrations_BankId",
                table: "UserBankCalibrations",
                column: "BankId");

            migrationBuilder.CreateIndex(
                name: "IX_UserBankCalibrations_UserId_BankId",
                table: "UserBankCalibrations",
                columns: new[] { "UserId", "BankId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_tableau_Users_ApprovedByUserId",
                table: "tableau",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_tableau_Users_UserId",
                table: "tableau",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
