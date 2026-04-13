using CheckFillingAPI.Data;
using CheckFillingAPI.RealTime;
using CheckFillingAPI.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Net;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to listen on all network interfaces
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(5001); // Écoute sur 0.0.0.0:5001
});

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});
builder.Services.AddEndpointsApiExplorer();
// Swagger désactivé temporairement pour .NET 10
// builder.Services.AddSwaggerGen();

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("DefaultConnection must be configured in appsettings or environment variables");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

// CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost", "http://127.0.0.1" };

bool IsPrivateIpv4(IPAddress ip)
{
    var bytes = ip.GetAddressBytes();
    return bytes.Length == 4
        && (
            bytes[0] == 10
            || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
            || (bytes[0] == 192 && bytes[1] == 168)
        );
}

bool IsConfiguredOriginAllowed(Uri requestOrigin)
{
    foreach (var configuredOrigin in allowedOrigins)
    {
        if (!Uri.TryCreate(configuredOrigin, UriKind.Absolute, out var configuredUri))
        {
            continue;
        }

        var sameScheme = string.Equals(configuredUri.Scheme, requestOrigin.Scheme, StringComparison.OrdinalIgnoreCase);
        var sameHost = string.Equals(configuredUri.Host, requestOrigin.Host, StringComparison.OrdinalIgnoreCase);
        if (!sameScheme || !sameHost)
        {
            continue;
        }

        // If configured origin has no explicit port (default 80/443), allow any port for that host.
        if (configuredUri.IsDefaultPort || configuredUri.Port == requestOrigin.Port)
        {
            return true;
        }
    }

    return false;
}

bool IsOriginAllowed(string? origin)
{
    if (string.IsNullOrWhiteSpace(origin)) return false;
    if (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri)) return false;
    if (!string.Equals(originUri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(originUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
    {
        return false;
    }

    if (IsConfiguredOriginAllowed(originUri))
    {
        return true;
    }

    // In development, allow loopback and private LAN origins to avoid CORS issues on alternate local hosts.
    if (builder.Environment.IsDevelopment())
    {
        if (originUri.IsLoopback)
        {
            return true;
        }

        if (IPAddress.TryParse(originUri.Host, out var ipAddress) && IsPrivateIpv4(ipAddress))
        {
            return true;
        }
    }

    return false;
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(IsOriginAllowed)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
var key = Encoding.ASCII.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };

    // Allow JWT to be read from the HttpOnly cookie "jwt"
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            // Support SignalR (token via query string) and standard API calls (token via cookie)
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
                return Task.CompletedTask;
            }

            if (context.Request.Cookies.TryGetValue("jwt", out var token))
            {
                context.Token = token;
            }
            return Task.CompletedTask;
        }
    };
});

// Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAuditService, AuditService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // Swagger désactivé temporairement
    // app.UseSwagger();
    // app.UseSwaggerUI();
}

// Serve static files for uploaded PDFs
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Add CORS headers to static files
        var origin = ctx.Context.Request.Headers["Origin"].ToString();
        if (IsOriginAllowed(origin))
        {
            ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", origin);
            ctx.Context.Response.Headers.Append("Access-Control-Allow-Credentials", "true");
            ctx.Context.Response.Headers.Append("Vary", "Origin");
        }
    }
});

app.UseRouting();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<CheckUpdatesHub>("/hubs/check-updates").RequireCors("AllowFrontend");

// Initialize database - Activé pour créer automatiquement la base de données
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // Apply pending migrations or create database if missing
    db.Database.Migrate();

    // Safety net: if migration history is out of sync, ensure fiscal settings table exists.
    db.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'[dbo].[AdminFiscalSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AdminFiscalSettings] (
        [Id] INT NOT NULL,
        [IsTable6Enabled] BIT NOT NULL CONSTRAINT [DF_AdminFiscalSettings_IsTable6Enabled] DEFAULT(1),
        [UpdatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [PK_AdminFiscalSettings] PRIMARY KEY ([Id])
    );

    INSERT INTO [dbo].[AdminFiscalSettings] ([Id], [IsTable6Enabled], [UpdatedAt])
    VALUES (1, 1, GETUTCDATE());
END
ELSE IF NOT EXISTS (SELECT 1 FROM [dbo].[AdminFiscalSettings] WHERE [Id] = 1)
BEGIN
    INSERT INTO [dbo].[AdminFiscalSettings] ([Id], [IsTable6Enabled], [UpdatedAt])
    VALUES (1, 1, GETUTCDATE());
END

-- Safety net: keep fiscal declaration table aligned with EF mapping (Declaration).
IF OBJECT_ID(N'[dbo].[Declaration]', N'U') IS NULL
BEGIN
    IF OBJECT_ID(N'[dbo].[FiscalDeclarations]', N'U') IS NOT NULL
    BEGIN
        EXEC sp_rename N'[dbo].[FiscalDeclarations]', N'Declaration';
    END
    ELSE
    BEGIN
        CREATE TABLE [dbo].[Declaration] (
            [Id] INT IDENTITY(1,1) NOT NULL,
            [UserId] INT NOT NULL,
            [TabKey] NVARCHAR(50) NOT NULL,
            [Mois] NVARCHAR(10) NULL,
            [Annee] NVARCHAR(10) NULL,
            [Direction] NVARCHAR(200) NULL,
            [DataJson] NVARCHAR(MAX) NOT NULL,
            [IsApproved] BIT NOT NULL CONSTRAINT [DF_Declaration_IsApproved] DEFAULT(0),
            [ApprovedByUserId] INT NULL,
            [ApprovedAt] DATETIME2 NULL,
            [CreatedAt] DATETIME2 NOT NULL,
            [UpdatedAt] DATETIME2 NOT NULL,
            CONSTRAINT [PK_Declaration] PRIMARY KEY ([Id])
        );

        ALTER TABLE [dbo].[Declaration] WITH CHECK
        ADD CONSTRAINT [FK_Declaration_Users_UserId]
            FOREIGN KEY([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE;

        ALTER TABLE [dbo].[Declaration] WITH CHECK
        ADD CONSTRAINT [FK_Declaration_Users_ApprovedByUserId]
            FOREIGN KEY([ApprovedByUserId]) REFERENCES [dbo].[Users]([Id]);
    END
END

IF OBJECT_ID(N'[dbo].[Declaration]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Declaration_UserId' AND [object_id] = OBJECT_ID(N'[dbo].[Declaration]'))
        CREATE INDEX [IX_Declaration_UserId] ON [dbo].[Declaration]([UserId]);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Declaration_UserId_TabKey_Mois_Annee' AND [object_id] = OBJECT_ID(N'[dbo].[Declaration]'))
        CREATE INDEX [IX_Declaration_UserId_TabKey_Mois_Annee] ON [dbo].[Declaration]([UserId], [TabKey], [Mois], [Annee]);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Declaration_IsApproved' AND [object_id] = OBJECT_ID(N'[dbo].[Declaration]'))
        CREATE INDEX [IX_Declaration_IsApproved] ON [dbo].[Declaration]([IsApproved]);

    IF COL_LENGTH(N'[dbo].[Declaration]', N'ApprovedByUserId') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Declaration_ApprovedByUserId' AND [object_id] = OBJECT_ID(N'[dbo].[Declaration]'))
        CREATE INDEX [IX_Declaration_ApprovedByUserId] ON [dbo].[Declaration]([ApprovedByUserId]);
END

-- Safety net: keep recap table aligned with EF mapping (EtatsDeSortie).
IF OBJECT_ID(N'[dbo].[EtatsDeSortie]', N'U') IS NULL
BEGIN
    IF OBJECT_ID(N'[dbo].[FiscalRecaps]', N'U') IS NOT NULL
    BEGIN
        EXEC sp_rename N'[dbo].[FiscalRecaps]', N'EtatsDeSortie';
    END
END

IF OBJECT_ID(N'[dbo].[EtatsDeSortie]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_EtatsDeSortie_UserId' AND [object_id] = OBJECT_ID(N'[dbo].[EtatsDeSortie]'))
       AND COL_LENGTH(N'[dbo].[EtatsDeSortie]', N'UserId') IS NOT NULL
        CREATE INDEX [IX_EtatsDeSortie_UserId] ON [dbo].[EtatsDeSortie]([UserId]);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_EtatsDeSortie_Key_Mois_Annee' AND [object_id] = OBJECT_ID(N'[dbo].[EtatsDeSortie]'))
       AND COL_LENGTH(N'[dbo].[EtatsDeSortie]', N'Key') IS NOT NULL
       AND COL_LENGTH(N'[dbo].[EtatsDeSortie]', N'Mois') IS NOT NULL
       AND COL_LENGTH(N'[dbo].[EtatsDeSortie]', N'Annee') IS NOT NULL
        CREATE UNIQUE INDEX [IX_EtatsDeSortie_Key_Mois_Annee] ON [dbo].[EtatsDeSortie]([Key], [Mois], [Annee]);
END
");
}

app.Run();
