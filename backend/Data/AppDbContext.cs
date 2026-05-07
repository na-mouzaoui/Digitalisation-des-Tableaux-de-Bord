using Microsoft.EntityFrameworkCore;
using DigitalisationDesTableauxDeBordAPI.Models;

namespace DigitalisationDesTableauxDeBordAPI.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Region> Regions { get; set; }
    public DbSet<Wilaya> Wilayas { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<Tableau> Tableaus { get; set; }
    public DbSet<AdminSetting> AdminSettings { get; set; }
    public DbSet<Domaine> Domaines { get; set; }
    public DbSet<SousDomaine> SousDomaines { get; set; }
    public DbSet<Categorie> Categories { get; set; }
    public DbSet<Kpi> Kpis { get; set; }
    public DbSet<SousKpi> SousKpis { get; set; }

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
        });

        // Region configuration
        modelBuilder.Entity<Region>(entity =>
        {
            entity.ToTable("DR");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Name).HasColumnName("nom").HasMaxLength(150).IsRequired();
            entity.Property(e => e.VillesJson).HasColumnName("wilayas").HasMaxLength(255).IsRequired();
            entity.Ignore(e => e.CreatedAt);
        });

        // Wilaya configuration
        modelBuilder.Entity<Wilaya>(entity =>
        {
            entity.ToTable("Wilaya");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Code).HasColumnName("code").HasMaxLength(20).IsRequired();
            entity.Property(e => e.Nom).HasColumnName("nom").HasMaxLength(150).IsRequired();
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

        // Tableau configuration
        modelBuilder.Entity<Tableau>(entity =>
        {
            entity.ToTable("Tableau");
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

        // AdminSetting configuration
        modelBuilder.Entity<AdminSetting>(entity =>
        {
            entity.ToTable("AdminSettings");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.DisabledTabKeysJson)
                .HasColumnType("nvarchar(max)")
                .HasDefaultValue("[]");
        });

        // Domaine configuration
        modelBuilder.Entity<Domaine>(entity =>
        {
            entity.ToTable("Domaines");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Designation)
                .HasMaxLength(255)
                .IsRequired();
            entity.HasMany(e => e.SousDomaines)
                .WithOne(sd => sd.Domaine)
                .HasForeignKey(sd => sd.DomaineId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // SousDomaine configuration
        modelBuilder.Entity<SousDomaine>(entity =>
        {
            entity.ToTable("SousDomaines");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Designation)
                .HasMaxLength(255)
                .IsRequired();
            entity.HasOne(e => e.Domaine)
                .WithMany(d => d.SousDomaines)
                .HasForeignKey(e => e.DomaineId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(e => e.Categories)
                .WithOne(c => c.SousDomaine)
                .HasForeignKey(c => c.SousDomaineId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Categorie configuration
        modelBuilder.Entity<Categorie>(entity =>
        {
            entity.ToTable("Categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Designation)
                .HasMaxLength(255)
                .IsRequired();
            entity.HasOne(e => e.SousDomaine)
                .WithMany(sd => sd.Categories)
                .HasForeignKey(e => e.SousDomaineId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(e => e.Kpis)
                .WithOne(k => k.Categorie)
                .HasForeignKey(k => k.CategorieId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // KPI configuration
        modelBuilder.Entity<Kpi>(entity =>
        {
            entity.ToTable("Kpis");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Nom)
                .HasMaxLength(120)
                .IsRequired();
            entity.HasOne(e => e.Categorie)
                .WithMany(c => c.Kpis)
                .HasForeignKey(e => e.CategorieId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.CategorieId, e.Nom })
                .IsUnique();
        });

        modelBuilder.Entity<SousKpi>(entity =>
        {
            entity.ToTable("SousKpis");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Designation)
                .HasMaxLength(200)
                .IsRequired();
            entity.HasOne(e => e.Kpi)
                .WithMany(k => k.SousKpis)
                .HasForeignKey(e => e.KpiId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.KpiId, e.Order })
                .IsUnique();
        });

        // Seed data
        SeedData(modelBuilder);
    }

    private void SeedData(ModelBuilder modelBuilder)
    {
        var seedCreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
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

        modelBuilder.Entity<AdminSetting>().HasData(
            new AdminSetting
            {
                Id = 1,
                DisabledTabKeysJson = "[]",
                UpdatedAt = seedCreatedAt
            }
        );
    }
}

