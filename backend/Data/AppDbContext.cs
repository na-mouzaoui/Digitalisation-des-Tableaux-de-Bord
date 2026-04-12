using Microsoft.EntityFrameworkCore;
using CheckFillingAPI.Models;

namespace CheckFillingAPI.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Check> Checks { get; set; }
    public DbSet<Bank> Banks { get; set; }
    public DbSet<Region> Regions { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<Supplier> Suppliers { get; set; }
    public DbSet<Checkbook> Checkbooks { get; set; }
    public DbSet<UserBankCalibration> UserBankCalibrations { get; set; }
    public DbSet<Declaration> Declarations { get; set; }
    public DbSet<FiscalFournisseur> FiscalFournisseurs { get; set; }
    public DbSet<EtatsDeSortie> EtatsDeSortie { get; set; }
    public DbSet<AdminFiscalSetting> AdminFiscalSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Email).IsRequired();
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.IsRegionalApprover).HasDefaultValue(false);
            entity.Property(e => e.IsFinanceApprover).HasDefaultValue(false);
        });

        // Check configuration
        modelBuilder.Entity<Check>(entity =>
        {
            entity.HasKey(e => e.Reference);
            entity.Property(e => e.Reference).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Status).HasDefaultValue("emit");
            entity.HasOne(e => e.User)
                  .WithMany(u => u.Checks)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Checkbook)
                  .WithMany()
                  .HasForeignKey(e => e.CheckbookId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => e.CheckbookId);
        });

        // Bank configuration
        modelBuilder.Entity<Bank>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Code).IsUnique();
            entity.Property(e => e.Code).IsRequired();
            entity.Property(e => e.Name).IsRequired();
        });

        // Region configuration
        modelBuilder.Entity<Region>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Name).IsRequired();
        });

        // AuditLog configuration
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                  .WithMany(u => u.AuditLogs)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.Action);
        });

        // Checkbook configuration
        modelBuilder.Entity<Checkbook>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Bank)
                  .WithMany()
                  .HasForeignKey(e => e.BankId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.Property(e => e.Serie).HasMaxLength(2).IsRequired();
            entity.HasIndex(e => new { e.BankId, e.Serie, e.StartNumber }).IsUnique();
        });

        // Supplier configuration
        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.CompanyType).IsRequired();
            entity.HasIndex(e => e.Name);
        });

        // UserBankCalibration configuration
        modelBuilder.Entity<UserBankCalibration>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Bank)
                  .WithMany()
                  .HasForeignKey(e => e.BankId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.UserId, e.BankId }).IsUnique();
            entity.Property(e => e.PositionsJson).IsRequired();
        });

        // FiscalFournisseur configuration
        modelBuilder.Entity<FiscalFournisseur>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.Property(e => e.RaisonSociale).IsRequired().HasMaxLength(300);
            entity.Property(e => e.Adresse).HasMaxLength(500);
            entity.Property(e => e.AuthNIF).HasMaxLength(150);
            entity.Property(e => e.RC).HasMaxLength(100);
            entity.Property(e => e.AuthRC).HasMaxLength(150);
            entity.Property(e => e.NIF).HasMaxLength(100);
            entity.HasIndex(e => e.UserId);
        });

        // Declaration configuration
        modelBuilder.Entity<Declaration>(entity =>
        {
            entity.ToTable("Declaration");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ApprovedByUser)
                .WithMany()
                .HasForeignKey(e => e.ApprovedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.UserId, e.TabKey, e.Mois, e.Annee });
            entity.HasIndex(e => e.IsApproved);
            entity.Property(e => e.DataJson).IsRequired();
            entity.Property(e => e.TabKey).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Direction).HasMaxLength(200);
            entity.Property(e => e.Mois).HasMaxLength(10);
            entity.Property(e => e.Annee).HasMaxLength(10);
            entity.Property(e => e.IsApproved).HasDefaultValue(false);
        });

        // EtatsDeSortie configuration
        modelBuilder.Entity<EtatsDeSortie>(entity =>
        {
            entity.ToTable("EtatsDeSortie");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.Key, e.Mois, e.Annee }).IsUnique();
            entity.Property(e => e.Key).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Title).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Mois).HasMaxLength(10).IsRequired();
            entity.Property(e => e.Annee).HasMaxLength(10).IsRequired();
            entity.Property(e => e.RowsJson).IsRequired();
            entity.Property(e => e.FormulasJson).IsRequired();
            entity.Property(e => e.IsGenerated).HasDefaultValue(true);
        });

        // AdminFiscalSetting configuration
        modelBuilder.Entity<AdminFiscalSetting>(entity =>
        {
            entity.ToTable("AdminFiscalSettings");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.IsTable6Enabled).HasDefaultValue(true);
        });

        // Seed data
        SeedData(modelBuilder);
    }

    private void SeedData(ModelBuilder modelBuilder)
    {
        // Tous les utilisateurs ont le même mot de passe: 
        var seedCreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        // Hash BCrypt pour ""
        const string passwordHash = "$2a$11$3f1y0aSd2iVFhKoWi60oVuwBiNQb913o5x94e0pYXB9eaqvHXW1By";

        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = 1,
                Email = "test@gmail.com",
                PasswordHash = passwordHash,
                FirstName = "Test",
                LastName = "User",
                Direction = "Test",
                PhoneNumber = "0661000000",
                Role = "admin",
                CreatedAt = seedCreatedAt
            },
            new User
            {
                Id = 2,
                Email = "admin@test.com",
                PasswordHash = passwordHash,
                FirstName = "Admin",
                LastName = "Test",
                Direction = "Administration",
                PhoneNumber = "0661999999",
                Role = "admin",
                CreatedAt = seedCreatedAt
            },
            new User
            {
                Id = 3,
                Email = "admin@gmail.com",
                PasswordHash = passwordHash,
                FirstName = "Admin",
                LastName = "Gmail",
                Direction = "Administration",
                PhoneNumber = "0661999998",
                Role = "admin",
                CreatedAt = seedCreatedAt
            }
        );

        // Seed default banks
        var defaultPositions = System.Text.Json.JsonSerializer.Serialize(new BankPositions
        {
            City = new FieldPosition { X = 50, Y = 100, Width = 150, FontSize = 14 },
            Date = new FieldPosition { X = 400, Y = 100, Width = 150, FontSize = 14 },
            Payee = new FieldPosition { X = 120, Y = 180, Width = 400, FontSize = 14 },
            AmountInWords = new FieldPosition { X = 120, Y = 240, Width = 500, FontSize = 12 },
            Amount = new FieldPosition { X = 450, Y = 300, Width = 150, FontSize = 18 }
        });

        modelBuilder.Entity<Bank>().HasData(
            new Bank { Id = 1, Code = "BNA", Name = "BNA - Banque Nationale d'Algérie", PositionsJson = defaultPositions, CreatedAt = seedCreatedAt },
            new Bank { Id = 2, Code = "CPA", Name = "CPA - Crédit Populaire d'Algérie", PositionsJson = defaultPositions, CreatedAt = seedCreatedAt },
            new Bank { Id = 3, Code = "BEA", Name = "BEA - Banque Extérieure d'Algérie", PositionsJson = defaultPositions, CreatedAt = seedCreatedAt }
        );

        // Seed default regions
        modelBuilder.Entity<Region>().HasData(
            new Region { Id = 1, Name = "nord", VillesJson = "[\"Alger\", \"Tipaza\", \"Boumerdes\", \"Blida\", \"Ain Defla\"]", CreatedAt = seedCreatedAt },
            new Region { Id = 2, Name = "sud", VillesJson = "[\"Ouargla\", \"Ghardaia\", \"Tamanrasset\", \"Adrar\", \"Illizi\"]", CreatedAt = seedCreatedAt },
            new Region { Id = 3, Name = "est", VillesJson = "[\"Constantine\", \"Annaba\", \"Sétif\", \"Batna\", \"Guelma\"]", CreatedAt = seedCreatedAt },
            new Region { Id = 4, Name = "ouest", VillesJson = "[\"Oran\", \"Tlemcen\", \"Sidi Bel Abbès\", \"Mostaganem\", \"Mascara\"]", CreatedAt = seedCreatedAt }
        );

        modelBuilder.Entity<AdminFiscalSetting>().HasData(
            new AdminFiscalSetting
            {
                Id = 1,
                IsTable6Enabled = true,
                UpdatedAt = seedCreatedAt
            }
        );
    }
}

