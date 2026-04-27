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
    public string Role { get; set; } = "comptabilite"; // direction, comptabilite, regionale, admin
    public string? Region { get; set; } // nord, sud, est, ouest (pour role regionale uniquement)
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

public class AdminSetting
{
    public int Id { get; set; }
    public string DisabledTabKeysJson { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
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
    public string Role { get; set; } = "comptabilite";
    public string? Region { get; set; }
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
}

public class TableauRequest
{
    public string TabKey { get; set; } = string.Empty;
    public string Mois { get; set; } = string.Empty;
    public string Annee { get; set; } = string.Empty;
    public string? Direction { get; set; }
    public string DataJson { get; set; } = "{}";
}