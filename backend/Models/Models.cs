namespace CheckFillingAPI.Models;

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
    public bool IsRegionalApprover { get; set; } = false; // Peut approuver les déclarations régionales de la même région
    public bool IsFinanceApprover { get; set; } = false; // Peut approuver les déclarations du niveau Siège
    public string AccessModules { get; set; } = "fisca"; // modules accessibles : fisca
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Check> Checks { get; set; } = new List<Check>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}

public class Check
{
    public string Reference { get; set; } = string.Empty; // Clé primaire
    public int UserId { get; set; }
    public int? CheckbookId { get; set; } // Référence au chéquier
    public decimal Amount { get; set; }
    public string Payee { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Ville { get; set; } = string.Empty; // Ville du chèque pour filtrage régional
    public string Date { get; set; } = string.Empty;
    public string Status { get; set; } = "emit"; // emit, annule, rejete
    public string? Motif { get; set; } // Motif d'annulation ou de rejet
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public User User { get; set; } = null!;
    public Checkbook? Checkbook { get; set; }
}

public class Bank
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? PdfUrl { get; set; }
    public string PositionsJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Supplier
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string CompanyType { get; set; } = string.Empty; // url, sarl, eurl, spa, etc.
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Checkbook
{
    public int Id { get; set; }
    public int BankId { get; set; }
    public string AgencyName { get; set; } = string.Empty;
    public string AgencyCode { get; set; } = string.Empty;
    public string Serie { get; set; } = string.Empty; // 2 caractères
    public int StartNumber { get; set; } // 7 caractères (nombre)
    public int EndNumber { get; set; } // 7 caractères (nombre)
    public int Capacity { get; set; } // Nombre total de chèques du chéquier
    public int UsedCount { get; set; } = 0; // Nombre de chèques utilisés
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public Bank Bank { get; set; } = null!;
}

public class BankPositions
{
    public FieldPosition City { get; set; } = new();
    public FieldPosition Date { get; set; } = new();
    public FieldPosition Payee { get; set; } = new();
    public FieldPosition AmountInWords { get; set; } = new();
    public FieldPosition? AmountInWordsLine2 { get; set; }
    public FieldPosition Amount { get; set; } = new();
    public CheckLayout? CheckLayout { get; set; }
}

public class FieldPosition
{
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int FontSize { get; set; }
    public int Rotation { get; set; } = 0;
}

public class CheckLayout
{
    public int Width { get; set; }
    public int Height { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public int Rotation { get; set; }
}

public class Region
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // nord, sud, est, ouest
    public string VillesJson { get; set; } = "[]"; // Liste des villes en JSON
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Action { get; set; } = string.Empty; // Type d'action
    public string EntityType { get; set; } = string.Empty; // Check, Bank, User, etc.
    public int? EntityId { get; set; } // ID de l'entité affectée
    public string Details { get; set; } = string.Empty; // Détails en JSON
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public User User { get; set; } = null!;
}

public class UserBankCalibration
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int BankId { get; set; }
    public string PositionsJson { get; set; } = "{}"; // Calibrage personnalisé pour cette banque
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public User User { get; set; } = null!;
    public Bank Bank { get; set; } = null!;
}

public class Declaration
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TabKey { get; set; } = "";        // ex: "tva_immo", "encaissement"
    public string Mois { get; set; } = "";          // "01" à "12"
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

public class FiscalFournisseur
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string RaisonSociale { get; set; } = string.Empty;
    public string Adresse { get; set; } = string.Empty;
    public string AuthNIF { get; set; } = string.Empty;
    public string RC { get; set; } = string.Empty;  // Registre de Commerce
    public string AuthRC { get; set; } = string.Empty;
    public string NIF { get; set; } = string.Empty; // Numéro d'Identification Fiscale
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}

public class AdminFiscalSetting
{
    public int Id { get; set; }
    public bool IsTable6Enabled { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
