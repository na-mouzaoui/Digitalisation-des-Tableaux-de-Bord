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
    public DbSet<AdminSetting> AdminSettings { get; set; }
    public DbSet<Domaine> Domaines { get; set; }
    public DbSet<SousDomaine> SousDomaines { get; set; }
    public DbSet<Kpi> Kpis { get; set; }
    public DbSet<SousKpi> SousKpis { get; set; }
    public DbSet<StepComment> StepComments { get; set; }
    public DbSet<Valeur> Valeurs { get; set; }


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
            entity.Property(e => e.Nom).HasColumnName("nom").HasMaxLength(150).IsRequired();
            entity.Property(e => e.Wilayas).HasColumnName("wilayas").HasMaxLength(2000);
            entity.Ignore(e => e.CreatedAt);
        });

        // Wilaya configuration
        modelBuilder.Entity<Wilaya>(entity =>
        {
            entity.ToTable("Wilaya");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
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
            entity.HasMany(e => e.Kpis)
                .WithOne(k => k.SousDomaine)
                .HasForeignKey(k => k.SousDomaineId)
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
            entity.HasOne(e => e.SousDomaine)
                .WithMany(sd => sd.Kpis)
                .HasForeignKey(e => e.SousDomaineId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.SousDomaineId, e.Nom })
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

        // Valeur configuration
        modelBuilder.Entity<Valeur>(entity =>
        {
            entity.ToTable("Valeurs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id_SousKpi).IsRequired();
            entity.Property(e => e.Id_Periode).IsRequired();
            entity.HasOne(e => e.SousKpi)
                  .WithMany()
                  .HasForeignKey(e => e.Id_SousKpi)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.M).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Evol).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Part_Pct).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Ecart).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Objectif_2026).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Situation_Actuelle).HasMaxLength(255);
            entity.Property(e => e.M_Objectif).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Realise).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Taux).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Objectif).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Realise).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Taux).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Wilaya).HasMaxLength(255);
            entity.Property(e => e.Taux_M).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Taux_M_1).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Montant_Recouvre).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Montant_Mis_Recouvrement).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Montant_Recouvre).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Taux_Recouvrement).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Objectif_Recouvrement).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Recrute).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Recrute).HasColumnType("decimal(18,2)");
            entity.Property(e => e.MTTR_Objectif).HasColumnType("decimal(18,2)");
            entity.Property(e => e.MTTR_Realise).HasColumnType("decimal(18,2)");
            entity.Property(e => e.MTTR_Ecart).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Debit_Objectif).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Debit_Realise).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Debit_Ecart).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Cadres_Sup).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Cadres).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Maitrise).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_Execution).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Cadres_Sup).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Cadres).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Maitrise).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_Execution).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_CDI).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_CDD).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_1_CTA).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_CDI).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_CDD).HasColumnType("decimal(18,2)");
            entity.Property(e => e.M_CTA).HasColumnType("decimal(18,2)");

            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ApprovedByUser)
                  .WithMany()
                  .HasForeignKey(e => e.ApprovedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.ApprovedByDirecteurUser)
                  .WithMany()
                  .HasForeignKey(e => e.ApprovedByDirecteurUserId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.ApprovedByDivisionnaireUser)
                  .WithMany()
                  .HasForeignKey(e => e.ApprovedByDivisionnaireUserId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.UserId, e.Id_Periode, e.Id_SousKpi });
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
                MustChangePassword = false,
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
                MustChangePassword = false,
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
                MustChangePassword = false,
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

