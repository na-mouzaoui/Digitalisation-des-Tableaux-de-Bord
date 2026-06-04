namespace DigitalisationDesTableauxDeBordAPI.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Direction { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Role { get; set; } = "utilisateur"; // utilisateur, directeur, divisionnaire, admin
    public string? Region { get; set; } // nord, sud, est, ouest (pour role divisionnaire uniquement)
    public string AllowedKpis { get; set; } = ""; // IDs des KPI autorisés, séparés par des virgules ex: "1,2,3,4"
    public string AllowedDomaines { get; set; } = ""; // IDs des domaines autorisés, séparés par des virgules ex: "1,2,3"
    public string AllowedSousDomaines { get; set; } = ""; // IDs des sous-domaines autorisés, séparés par des virgules ex: "1,2,3"
    public bool MustChangePassword { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}

public class Region
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // nord, sud, est, ouest
    public string VillesJson { get; set; } = "[]"; // Liste des villes en JSON
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Wilaya
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Nom { get; set; } = string.Empty;
}

public class AuditLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Action { get; set; } = string.Empty; // Type d'action
    public string EntityType { get; set; } = string.Empty; // Type d'entité affectée
    public int? EntityId { get; set; } // ID de l'entité affectée
    public string Details { get; set; } = string.Empty; // Détails en JSON
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public User User { get; set; } = null!;
}

public class Tableau
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TabKey { get; set; } = "";        // ex: "tva_immo", "encaissement"
    public string Mois { get; set; } = "";          // "01" é "12"
    public string Annee { get; set; } = "";         // "2025"
    public string Direction { get; set; } = "";     // Direction de l'utilisateur
    public string DataJson { get; set; } = "{}";   // Données du tableau en JSON
    public bool IsApproved { get; set; } = false;
    public int? ApprovedByUserId { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public User? ApprovedByUser { get; set; }
}

public class StepComment
{
    public int Id { get; set; }
    public string TabKey { get; set; } = string.Empty;
    public string Mois { get; set; } = string.Empty;
    public string Annee { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string Comment { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}

public class AdminSetting
{
    public int Id { get; set; }
    public string DisabledTabKeysJson { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Domaine
{
    public int Id { get; set; }
    public string Designation { get; set; } = string.Empty;
    
    public ICollection<SousDomaine> SousDomaines { get; set; } = new List<SousDomaine>();
}

public class SousDomaine
{
    public int Id { get; set; }
    public int DomaineId { get; set; }
    public string Designation { get; set; } = string.Empty;
    
    public Domaine Domaine { get; set; } = null!;
    public ICollection<Kpi> Kpis { get; set; } = new List<Kpi>();
}

public class Kpi
{
    public int Id { get; set; }
    public int SousDomaineId { get; set; }
    public string Nom { get; set; } = string.Empty;
    
    public SousDomaine SousDomaine { get; set; } = null!;
    public ICollection<SousKpi> SousKpis { get; set; } = new List<SousKpi>();
}

public class SousKpi
{
    public int Id { get; set; }
    public int KpiId { get; set; }
    public string Designation { get; set; } = string.Empty;
    public int Order { get; set; }

    public Kpi Kpi { get; set; } = null!;
}

public class Valeur
{
    public int Id { get; set; }
    public int Id_SousKpi { get; set; }
    public int Id_Periode { get; set; }

    public decimal? M { get; set; }
    public decimal? M_1 { get; set; }
    public decimal? Evol { get; set; }
    public decimal? Part_Pct { get; set; }
    public decimal? Ecart { get; set; }
    public decimal? Objectif_2026 { get; set; }
    public string? Situation_Actuelle { get; set; }

    public decimal? M_Objectif { get; set; }
    public decimal? M_Realise { get; set; }
    public decimal? M_Taux { get; set; }
    public decimal? M_1_Objectif { get; set; }
    public decimal? M_1_Realise { get; set; }
    public decimal? M_1_Taux { get; set; }
    public string? M_Wilaya { get; set; }
    public decimal? Taux_M { get; set; }
    public decimal? Taux_M_1 { get; set; }

    public decimal? M_1_Montant_Recouvre { get; set; }
    public decimal? M_Montant_Mis_Recouvrement { get; set; }
    public decimal? M_Montant_Recouvre { get; set; }
    public decimal? M_Taux_Recouvrement { get; set; }
    public decimal? M_Objectif_Recouvrement { get; set; }

    public decimal? M_1_Recrute { get; set; }
    public decimal? M_Recrute { get; set; }

    public decimal? MTTR_Objectif { get; set; }
    public decimal? MTTR_Realise { get; set; }
    public decimal? MTTR_Ecart { get; set; }
    public decimal? Debit_Objectif { get; set; }
    public decimal? Debit_Realise { get; set; }
    public decimal? Debit_Ecart { get; set; }

    public decimal? M_1_Cadres_Sup { get; set; }
    public decimal? M_1_Cadres { get; set; }
    public decimal? M_1_Maitrise { get; set; }
    public decimal? M_1_Execution { get; set; }
    public decimal? M_Cadres_Sup { get; set; }
    public decimal? M_Cadres { get; set; }
    public decimal? M_Maitrise { get; set; }
    public decimal? M_Execution { get; set; }

    public decimal? M_1_CDI { get; set; }
    public decimal? M_1_CDD { get; set; }
    public decimal? M_1_CTA { get; set; }
    public decimal? M_CDI { get; set; }
    public decimal? M_CDD { get; set; }
    public decimal? M_CTA { get; set; }

    public SousKpi SousKpi { get; set; } = null!;
}

// DTOs
public class CreateUserRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Direction { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Role { get; set; } = "utilisateur";
    public string? Region { get; set; }
    public List<int>? AllowedKpiIds { get; set; }
    public List<int>? AllowedDomaineIds { get; set; }
    public List<int>? AllowedSousDomaineIds { get; set; }
}

public class UpdateUserRequest
{
    public string? Password { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Direction { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Role { get; set; }
    public string? Region { get; set; }
    public List<int>? AllowedKpiIds { get; set; }
    public List<int>? AllowedDomaineIds { get; set; }
    public List<int>? AllowedSousDomaineIds { get; set; }
}

public class TableauRequest
{
    public string TabKey { get; set; } = string.Empty;
    public string Mois { get; set; } = string.Empty;
    public string Annee { get; set; } = string.Empty;
    public string? Direction { get; set; }
    public string DataJson { get; set; } = "{}";
}