# Backend .NET - Tableau de Bord

Ce dossier contient une API ASP.NET Core pour l'authentification des utilisateurs stockes dans SQL Server.

## Projet

- API: `backend/TableauDeBord.Api`
- Framework: `.NET 10`
- Auth: `JWT Bearer`
- DB: `SQL Server` (table `user` existante)

## Endpoints disponibles

- `POST /api/auth/login`
  - body: `{ "email": "...", "password": "..." }`
  - reponse: `{ "token": "...", "user": { ... } }`
- `GET /api/auth/me` (Authorization: Bearer <token>)
- `POST /api/auth/change-password` (Authorization: Bearer <token>)

## Configuration

Modifier `backend/TableauDeBord.Api/appsettings.Development.json`:

```json
{
  "Database": {
    "ConnectionString": "Server=localhost;Database=TabDeBord;Trusted_Connection=True;TrustServerCertificate=True;",
    "Schema": "dbo",
    "UserTable": "user",
    "IdColumn": "id",
    "EmailColumn": "email",
    "PasswordColumn": "password",
    "RoleColumn": "role",
    "DisplayNameColumn": "name",
    "PasswordIsHashedWithBcrypt": false
  },
  "Jwt": {
    "Secret": "CHANGE_THIS_WITH_A_STRONG_SECRET_KEY_2026"
  },
  "Cors": {
    "AllowedOrigins": ["http://localhost:3000"]
  }
}
```

Important:
- Adaptez les noms de colonnes (`IdColumn`, `EmailColumn`, etc.) selon votre vraie table `user`.
- Si les mots de passe sont stockes en BCrypt, mettez `PasswordIsHashedWithBcrypt` a `true`.

## Lancement

Depuis `backend/TableauDeBord.Api`:

```powershell
dotnet restore
dotnet run
```

Par defaut, l'API ecoute sur `http://localhost:5241`.

## Connexion frontend

Dans le frontend Next.js, definir:

- `NEXT_PUBLIC_API_BASE=http://localhost:5241`

Exemple dans un fichier `.env.local` a la racine du frontend.
