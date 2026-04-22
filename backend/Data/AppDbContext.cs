using Microsoft.EntityFrameworkCore;
using CheckFillingAPI.Models;

namespace CheckFillingAPI.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Region> Regions { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<Tableau> Tableaus { get; set; }
    public DbSet<AdminSetting> AdminSettings { get; set; }

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

        modelBuilder.Entity<Region>().HasData(
            new Region { Id = 1, Name = "nord", VillesJson = "[\"Alger\", \"Tipaza\", \"Boumerdes\", \"Blida\", \"Ain Defla\"]", CreatedAt = seedCreatedAt },
            new Region { Id = 2, Name = "sud", VillesJson = "[\"Ouargla\", \"Ghardaia\", \"Tamanrasset\", \"Adrar\", \"Illizi\"]", CreatedAt = seedCreatedAt },
            new Region { Id = 3, Name = "est", VillesJson = "[\"Constantine\", \"Annaba\", \"Sétif\", \"Batna\", \"Guelma\"]", CreatedAt = seedCreatedAt },
            new Region { Id = 4, Name = "ouest", VillesJson = "[\"Oran\", \"Tlemcen\", \"Sidi Bel Abbès\", \"Mostaganem\", \"Mascara\"]", CreatedAt = seedCreatedAt }
        );

        modelBuilder.Entity<AdminSetting>().HasData(
            new AdminSetting
            {
                Id = 1,
                UpdatedAt = seedCreatedAt
            }
        );
    }
}

