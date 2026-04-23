using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddtableauApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH(N'[dbo].[Users]', N'IsRegionalApprover') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users]
    ADD [IsRegionalApprover] bit NOT NULL CONSTRAINT [DF_Users_IsRegionalApprover] DEFAULT CAST(0 AS bit);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[tableau]', N'ApprovedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[tableau] ADD [ApprovedAt] datetime2 NULL;
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[tableau]', N'ApprovedByUserId') IS NULL
BEGIN
    ALTER TABLE [dbo].[tableau] ADD [ApprovedByUserId] int NULL;
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[tableau]', N'IsApproved') IS NULL
BEGIN
    ALTER TABLE [dbo].[tableau]
    ADD [IsApproved] bit NOT NULL CONSTRAINT [DF_tableau_IsApproved] DEFAULT CAST(0 AS bit);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_tableau_ApprovedByUserId'
      AND [object_id] = OBJECT_ID(N'[dbo].[tableau]')
)
AND OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
AND COL_LENGTH(N'[dbo].[tableau]', N'ApprovedByUserId') IS NOT NULL
BEGIN
    CREATE INDEX [IX_tableau_ApprovedByUserId] ON [dbo].[tableau] ([ApprovedByUserId]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_tableau_IsApproved'
      AND [object_id] = OBJECT_ID(N'[dbo].[tableau]')
)
AND OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
AND COL_LENGTH(N'[dbo].[tableau]', N'IsApproved') IS NOT NULL
BEGIN
    CREATE INDEX [IX_tableau_IsApproved] ON [dbo].[tableau] ([IsApproved]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_tableau_Users_ApprovedByUserId'
)
AND OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
AND OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
AND COL_LENGTH(N'[dbo].[tableau]', N'ApprovedByUserId') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[tableau] WITH CHECK
    ADD CONSTRAINT [FK_tableau_Users_ApprovedByUserId]
        FOREIGN KEY([ApprovedByUserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION;
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_tableau_Users_ApprovedByUserId'
)
BEGIN
    ALTER TABLE [dbo].[tableau] DROP CONSTRAINT [FK_tableau_Users_ApprovedByUserId];
END
");

            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_tableau_ApprovedByUserId'
      AND [object_id] = OBJECT_ID(N'[dbo].[tableau]')
)
BEGIN
    DROP INDEX [IX_tableau_ApprovedByUserId] ON [dbo].[tableau];
END
");

            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_tableau_IsApproved'
      AND [object_id] = OBJECT_ID(N'[dbo].[tableau]')
)
BEGIN
    DROP INDEX [IX_tableau_IsApproved] ON [dbo].[tableau];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH(N'[dbo].[Users]', N'IsRegionalApprover') IS NOT NULL
BEGIN
    DECLARE @dfUsersIsRegionalApprover nvarchar(128);

    SELECT @dfUsersIsRegionalApprover = dc.[name]
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[Users]')
      AND c.[name] = N'IsRegionalApprover';

    IF @dfUsersIsRegionalApprover IS NOT NULL
        EXEC(N'ALTER TABLE [dbo].[Users] DROP CONSTRAINT [' + @dfUsersIsRegionalApprover + N']');

    ALTER TABLE [dbo].[Users] DROP COLUMN [IsRegionalApprover];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[tableau]', N'ApprovedAt') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[tableau] DROP COLUMN [ApprovedAt];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[tableau]', N'ApprovedByUserId') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[tableau] DROP COLUMN [ApprovedByUserId];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[tableau]', N'U') IS NOT NULL
    AND COL_LENGTH(N'[dbo].[tableau]', N'IsApproved') IS NOT NULL
BEGIN
    DECLARE @dftableauIsApproved nvarchar(128);

    SELECT @dftableauIsApproved = dc.[name]
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[tableau]')
      AND c.[name] = N'IsApproved';

    IF @dftableauIsApproved IS NOT NULL
        EXEC(N'ALTER TABLE [dbo].[tableau] DROP CONSTRAINT [' + @dftableauIsApproved + N']');

    ALTER TABLE [dbo].[tableau] DROP COLUMN [IsApproved];
END
");
        }
    }
}
