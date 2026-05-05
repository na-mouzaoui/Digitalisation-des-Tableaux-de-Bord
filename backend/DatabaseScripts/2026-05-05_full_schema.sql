CREATE TABLE [AdminSettings] (
    [Id] int NOT NULL IDENTITY,
    [DisabledTabKeysJson] nvarchar(max) NOT NULL DEFAULT N'[]',
    [UpdatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_AdminSettings] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [DR] (
    [id] int NOT NULL IDENTITY,
    [nom] nvarchar(150) NOT NULL,
    [wilayas] nvarchar(255) NOT NULL,
    CONSTRAINT [PK_DR] PRIMARY KEY ([id])
);
GO


CREATE TABLE [Users] (
    [Id] int NOT NULL IDENTITY,
    [Email] nvarchar(450) NOT NULL,
    [PasswordHash] nvarchar(max) NOT NULL,
    [FirstName] nvarchar(max) NOT NULL,
    [LastName] nvarchar(max) NOT NULL,
    [Direction] nvarchar(max) NOT NULL,
    [PhoneNumber] nvarchar(max) NOT NULL,
    [Role] nvarchar(max) NOT NULL,
    [Region] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [Wilaya] (
    [id] int NOT NULL IDENTITY,
    [code] nvarchar(20) NOT NULL,
    [nom] nvarchar(150) NOT NULL,
    CONSTRAINT [PK_Wilaya] PRIMARY KEY ([id])
);
GO


CREATE TABLE [AuditLogs] (
    [Id] int NOT NULL IDENTITY,
    [UserId] int NOT NULL,
    [Action] nvarchar(450) NOT NULL,
    [EntityType] nvarchar(max) NOT NULL,
    [EntityId] int NULL,
    [Details] nvarchar(max) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AuditLogs_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [Tableau] (
    [Id] int NOT NULL IDENTITY,
    [UserId] int NOT NULL,
    [TabKey] nvarchar(50) NOT NULL,
    [Mois] nvarchar(10) NOT NULL,
    [Annee] nvarchar(10) NOT NULL,
    [Direction] nvarchar(200) NOT NULL,
    [DataJson] nvarchar(max) NOT NULL,
    [IsApproved] bit NOT NULL DEFAULT CAST(0 AS bit),
    [ApprovedByUserId] int NULL,
    [ApprovedAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Tableau] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Tableau_Users_ApprovedByUserId] FOREIGN KEY ([ApprovedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Tableau_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
);
GO


IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'DisabledTabKeysJson', N'UpdatedAt') AND [object_id] = OBJECT_ID(N'[AdminSettings]'))
    SET IDENTITY_INSERT [AdminSettings] ON;
INSERT INTO [AdminSettings] ([Id], [DisabledTabKeysJson], [UpdatedAt])
VALUES (1, N'[]', '2025-01-01T00:00:00.0000000Z');
IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'DisabledTabKeysJson', N'UpdatedAt') AND [object_id] = OBJECT_ID(N'[AdminSettings]'))
    SET IDENTITY_INSERT [AdminSettings] OFF;
GO


IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'CreatedAt', N'Direction', N'Email', N'FirstName', N'LastName', N'PasswordHash', N'PhoneNumber', N'Region', N'Role') AND [object_id] = OBJECT_ID(N'[Users]'))
    SET IDENTITY_INSERT [Users] ON;
INSERT INTO [Users] ([Id], [CreatedAt], [Direction], [Email], [FirstName], [LastName], [PasswordHash], [PhoneNumber], [Region], [Role])
VALUES (1, '2025-01-01T00:00:00.0000000Z', N'Test', N'test@gmail.com', N'Test', N'User', N'$2a$11$3f1y0aSd2iVFhKoWi60oVuwBiNQb913o5x94e0pYXB9eaqvHXW1By', N'0661000000', NULL, N'admin'),
(2, '2025-01-01T00:00:00.0000000Z', N'Administration', N'admin@test.com', N'Admin', N'Test', N'$2a$11$3f1y0aSd2iVFhKoWi60oVuwBiNQb913o5x94e0pYXB9eaqvHXW1By', N'0661999999', NULL, N'admin'),
(3, '2025-01-01T00:00:00.0000000Z', N'Administration', N'admin@gmail.com', N'Admin', N'Gmail', N'$2a$11$3f1y0aSd2iVFhKoWi60oVuwBiNQb913o5x94e0pYXB9eaqvHXW1By', N'0661999998', NULL, N'admin');
IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'CreatedAt', N'Direction', N'Email', N'FirstName', N'LastName', N'PasswordHash', N'PhoneNumber', N'Region', N'Role') AND [object_id] = OBJECT_ID(N'[Users]'))
    SET IDENTITY_INSERT [Users] OFF;
GO


CREATE INDEX [IX_AuditLogs_Action] ON [AuditLogs] ([Action]);
GO


CREATE INDEX [IX_AuditLogs_CreatedAt] ON [AuditLogs] ([CreatedAt]);
GO


CREATE INDEX [IX_AuditLogs_UserId] ON [AuditLogs] ([UserId]);
GO


CREATE INDEX [IX_Tableau_ApprovedByUserId] ON [Tableau] ([ApprovedByUserId]);
GO


CREATE INDEX [IX_Tableau_IsApproved] ON [Tableau] ([IsApproved]);
GO


CREATE INDEX [IX_Tableau_UserId] ON [Tableau] ([UserId]);
GO


CREATE INDEX [IX_Tableau_UserId_TabKey_Mois_Annee] ON [Tableau] ([UserId], [TabKey], [Mois], [Annee]);
GO


CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);
GO


