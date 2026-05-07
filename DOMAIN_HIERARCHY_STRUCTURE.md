# Hiérarchie Domaine-SousDomaine-Catégorie-KPI

## Vue d'ensemble
La structure a été réorganisée en 4 niveaux hiérarchiques :

```
Domaine 
  ├─ SousDomaine (onglets/tabs)
  │   ├─ Catégorie
  │   │   ├─ KPI (tableau)
  │   │   └─ KPI
  │   └─ Catégorie
  │       └─ KPI
  └─ SousDomaine
      └─ ...
```

## Implémentation technique

### 1. Modèles EF Core (Models.cs)
- **Domaine** : Entité racine représentant les 6 pages principales
- **SousDomaine** : Onglets/tabs de chaque page (ex: "Chiffre d'Affaires" pour Commercial)
- **Catégorie** : Catégories au sein de chaque sous-domaine
- **Kpi** : Tables de données (modifié pour FK vers Categorie au lieu de néant)
- **SousKpi** : Lignes individuelles de chaque KPI

### 2. Relations dans AppDbContext
```
Domaine [1] ──────── [*] SousDomaine
SousDomaine [1] ──── [*] Catégorie
Catégorie [1] ────── [*] Kpi
Kpi [1] ────────---- [*] SousKpi
```

### 3. Index d'unicité
- `IX_Kpis_(CategorieId, Nom)` : Permet les doublons de noms de KPI dans différentes catégories
  - Exemple : MTTR existe dans DVDRS, DQRPC et Regionale

## Migrations EF Core

### Migration 1 : AddDomaineHierarchy
- Crée les tables : Domaines, SousDomaines, Categories
- Ajoute FK CategorieId dans Kpis
- Crée les index et contraintes

### Migration 2 : FixKpiUniqueIndex
- Modifie l'index d'unicité sur Kpis de global à (CategorieId, Nom)
- Permet les doublons de noms dans différentes catégories

## Script de peuplement des données

Fichier : `backend/DatabaseScripts/2026-05-07_populate_domaine_hierarchy.sql`

Données peuplées :
- 6 Domaines
- 20 SousDomaines (onglets)
- 20 Catégories
- 32 KPIs

## Détail par domaine

### Commercial (14 KPIs)
| Sous-domaine | Catégorie | KPIs |
|---|---|---|
| Chiffre d'Affaires | Chiffre d'Affaires | 1 KPI |
| Parc Abonné | Parc Abonné | 4 KPIs |
| Activation-Desactivation SIM | Activations et Désactivations | 2 KPIs |
| Reclamation | Traitement des Reclamations | 2 KPIs |
| E-payment | Paiment électronique | 2 KPIs |
| Encaissement | Total des Encaissements | 1 KPI |
| Rechargement | Rechargement | 1 KPI |
| Recouvrement | Recouvrement | 1 KPI |

### DVDRS (2 KPIs)
| Sous-domaine | Catégorie | KPIs |
|---|---|---|
| Disponibilité réseau | Disponibilité réseau | 1 KPI |
| MTTR | MTTR | 1 KPI |

### DQRPC (3 KPIs)
| Sous-domaine | Catégorie | KPIs |
|---|---|---|
| Réalisation technique réseau | Réalisation technique réseau | 1 KPI |
| Amélioration qualité | Amélioration qualité | 1 KPI |
| MTTR | MTTR | 1 KPI |

### Support (9 KPIs)
| Sous-domaine | Catégorie | KPIs |
|---|---|---|
| Créances contentieuses | Créances contentieuses | 1 KPI |
| RH | RH | 5 KPIs |
| Formation | Formation | 3 KPIs |

### Finances (1 KPI)
| Sous-domaine | Catégorie | KPIs |
|---|---|---|
| Compte de résultat | Compte de résultat | 1 KPI |

### Regionale (3 KPIs)
| Sous-domaine | Catégorie | KPIs |
|---|---|---|
| Réalisation technique réseau | Réalisation technique réseau | 1 KPI |
| Amélioration qualité | Amélioration qualité | 1 KPI |
| MTTR | MTTR | 1 KPI |

## Notes importantes

1. **Contrainte d'unicité par catégorie** : Le même nom de KPI peut exister dans différentes catégories
   - Exemple : "MTTR" existe 3 fois (dans DVDRS, DQRPC, Regionale)
   
2. **Base de données recréée** : Toutes les migrations ont été appliquées en order
   - Raison : Ajustement de la contrainte d'unicité sur les KPIs

3. **SousDomaines = Tabs** : Les sous-domaines correspondent directement aux onglets visibles dans l'interface
   - Commercial a 8 onglets
   - DQRPC a 3 onglets
   - etc.

4. **Prochaines étapes possibles** :
   - Créer des APIs pour lire la hiérarchie complète
   - Modifier les pages du tableau pour utiliser cette hiérarchie
   - Ajouter des APIs CRUD pour gérer la hiérarchie
