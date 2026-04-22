using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CheckFillingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddTableuApprovalWorkflow : Migration
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
IF OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[Tableu]', N'ApprovedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[Tableu] ADD [ApprovedAt] datetime2 NULL;
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[Tableu]', N'ApprovedByUserId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Tableu] ADD [ApprovedByUserId] int NULL;
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[Tableu]', N'IsApproved') IS NULL
BEGIN
    ALTER TABLE [dbo].[Tableu]
    ADD [IsApproved] bit NOT NULL CONSTRAINT [DF_Tableu_IsApproved] DEFAULT CAST(0 AS bit);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_Tableu_ApprovedByUserId'
      AND [object_id] = OBJECT_ID(N'[dbo].[Tableu]')
)
AND OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
AND COL_LENGTH(N'[dbo].[Tableu]', N'ApprovedByUserId') IS NOT NULL
BEGIN
    CREATE INDEX [IX_Tableu_ApprovedByUserId] ON [dbo].[Tableu] ([ApprovedByUserId]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_Tableu_IsApproved'
      AND [object_id] = OBJECT_ID(N'[dbo].[Tableu]')
)
AND OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
AND COL_LENGTH(N'[dbo].[Tableu]', N'IsApproved') IS NOT NULL
BEGIN
    CREATE INDEX [IX_Tableu_IsApproved] ON [dbo].[Tableu] ([IsApproved]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_Tableu_Users_ApprovedByUserId'
)
AND OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
AND OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
AND COL_LENGTH(N'[dbo].[Tableu]', N'ApprovedByUserId') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Tableu] WITH CHECK
    ADD CONSTRAINT [FK_Tableu_Users_ApprovedByUserId]
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
    WHERE [name] = N'FK_Tableu_Users_ApprovedByUserId'
)
BEGIN
    ALTER TABLE [dbo].[Tableu] DROP CONSTRAINT [FK_Tableu_Users_ApprovedByUserId];
END
");

            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_Tableu_ApprovedByUserId'
      AND [object_id] = OBJECT_ID(N'[dbo].[Tableu]')
)
BEGIN
    DROP INDEX [IX_Tableu_ApprovedByUserId] ON [dbo].[Tableu];
END
");

            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_Tableu_IsApproved'
      AND [object_id] = OBJECT_ID(N'[dbo].[Tableu]')
)
BEGIN
    DROP INDEX [IX_Tableu_IsApproved] ON [dbo].[Tableu];
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
IF OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[Tableu]', N'ApprovedAt') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Tableu] DROP COLUMN [ApprovedAt];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
   AND COL_LENGTH(N'[dbo].[Tableu]', N'ApprovedByUserId') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Tableu] DROP COLUMN [ApprovedByUserId];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Tableu]', N'U') IS NOT NULL
    AND COL_LENGTH(N'[dbo].[Tableu]', N'IsApproved') IS NOT NULL
BEGIN
    DECLARE @dfTableuIsApproved nvarchar(128);

    SELECT @dfTableuIsApproved = dc.[name]
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[Tableu]')
      AND c.[name] = N'IsApproved';

    IF @dfTableuIsApproved IS NOT NULL
        EXEC(N'ALTER TABLE [dbo].[Tableu] DROP CONSTRAINT [' + @dfTableuIsApproved + N']');

    ALTER TABLE [dbo].[Tableu] DROP COLUMN [IsApproved];
END
");
        }
    }
}
