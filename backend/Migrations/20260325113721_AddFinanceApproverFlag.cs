using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalisationDesTableauxDeBordAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceApproverFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH(N'[dbo].[Users]', N'IsFinanceApprover') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users]
    ADD [IsFinanceApprover] bit NOT NULL CONSTRAINT [DF_Users_IsFinanceApprover] DEFAULT CAST(0 AS bit);
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH(N'[dbo].[Users]', N'IsFinanceApprover') IS NOT NULL
BEGIN
    DECLARE @constraintName nvarchar(128);

    SELECT @constraintName = dc.[name]
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[Users]')
      AND c.[name] = N'IsFinanceApprover';

    IF @constraintName IS NOT NULL
        EXEC(N'ALTER TABLE [dbo].[Users] DROP CONSTRAINT [' + @constraintName + N']');

    ALTER TABLE [dbo].[Users] DROP COLUMN [IsFinanceApprover];
END
");
        }
    }
}
