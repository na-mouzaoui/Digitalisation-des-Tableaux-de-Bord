# DFC Portal - Documentation fonctionnelle

Ce document décrit le contenu de l'application en 4 parties :
1. Impression de chèque
2. Fisca
3. Recap Fiscaux
4. Page Admin

## 1. Impression de chèque

### Objectif
Permettre la création, la prévisualisation, l'impression et le suivi des chèques.

### Fonctionnalités principales
- Création d'un chèque avec montant, bénéficiaire, ville, date, banque et référence.
- Conversion automatique du montant en lettres (pour l'impression).
- Prévisualisation avant impression.
- Génération et impression PDF du chèque(texts des champs sans fond du cheque).
- Gestion des banques (ajout, modification, suppression) avec modèle PDF de chèque.
- Calibrage des positions des champs par banque et par utilisateur.
- Gestion des chéquiers (création, consultation, mise à jour, suppression selon droits).
- Historique des chèques avec recherche, tri, filtres, export PDF/Excel.
- Mise à jour du statut des chèques (émis, annulé, rejeté) avec motif si nécessaire.
- Journalisation des actions (audit) et notifications temps réel des mises à jour.

### Règles métier importantes
- Le rôle direction n'a pas le droit de créer/imprimer des chèques.
- Un fournisseur peut être recréé avec le même nom tant que cela n’est pas fait par le même type d’utilisateur.Cas particulier : Pour les utilisateurs régionaux, l’unicité est basée sur la région.
- Les utilisateurs régionale sont limités à leur périmètre régional (accès et données filtrées).
- Référence de chèque vérifiée côté API.
- Si un chéquier est plein, aucun nouveau chèque ne peut être émis dessus.
- Le compteur d'utilisation du chéquier est incrémenté à chaque émission.
- Un chéquier déjà utilisé ne peut plus être modifié.
- Validation des chéquiers :
  - série exactement 2 caractères,
  - numéros dans la plage autorisée,
  - numéro de fin >= numéro de début,
  - unicité sur banque + série + numéro de départ.

## 2. Fisca

### Objectif
Saisir, sauvegarder, modifier, consulter, imprimer et historiser les déclarations fiscales.

### Fonctionnalités principales
- Saisie des déclarations par onglet/tableau fiscal.
- Gestion de la période (mois/année) et de la direction.
- Filtrage automatique des tableaux fiscaux selon le profil et la direction sélectionnée.
- Sauvegarde d'une déclaration (création et modification).
- Consultation des déclarations récentes dans le dashboard fiscal.
- Rappels fiscaux et indicateurs de complétude/approbation dans le dashboard fiscal.
- Consultation détaillée au clic ligne, impression PDF, modification, suppression.
- Validation (approbation) des déclarations via bouton dédié dans le dashboard fiscal pour les comptes approbateurs (régional et finance).
- Filtres avancés (type, période, direction, date) et tri dans le dashboard.
- Tableau 1 (Encaissement) en saisie HT avec calcul automatique de la TVA et du TTC.
- Formatage des montants en temps réel (séparateurs de milliers) lors de la saisie.
- Affichage des montants de total en sens droite-vers-gauche pour homogénéité visuelle.
- Gestion des fournisseurs fiscaux :
  - CRUD,
  - export CSV,
  - import CSV intelligent avec déduplication,
  - résolution des conflits (garder l'existant ou remplacer par CSV).
- Gestion des wilayas/communes (tableau TAP) via une source TypeScript dédiée.

### Fonctionnalités de rappel fiscal
- Endpoint dédié : `GET /api/fiscal/reminders`.
- Période de calcul : 10/15 du mois suivant 
- Périmètre selon rôle connecté :
  - admin : toutes les régions configurées + Siège,
  - regionale : sa région,
  - finance/comptabilite : Siège.
- Indicateurs calculés par direction :
  - totalTabs,
  - enteredTabs,
  - approvedTabs,
  - remainingToEnterTabs,
  - remainingToApproveTabs,
  - missingTabs,
  - daysUntilDeadline et isUrgent.
- Urgence rappel : activée à J-5 (et avant échéance) si des tableaux restent à saisir ou approuver.
- Le bandeau de rappel est dissocié des KPI :
  - les tuiles KPI restent toujours visibles,
  - seul le message change (alerte rouge si urgent, statut vert sinon).
- Côté admin, un filtre par direction est disponible ; la vue "Tout" conserve le dénominateur global (toutes directions + Siège), même si certaines directions n'ont aucune déclaration.

### Règles métier importantes
- Le rôle direction n'a pas accès à la création de déclarations fiscales.
- Direction imposée selon le rôle :
  - regionale -> direction fixée automatiquement sur la région du compte,
  - finance/comptabilite -> direction fixée à "Siège",
  - admin -> direction sélectionnable.
- Attribution des tableaux fiscaux par type de compte :
  - regionale -> tableaux 1 à 6,
  - finance/comptabilite -> tableaux 7 à 16.
- Attribution des tableaux fiscaux pour admin selon la direction choisie :
  - direction "Siège" -> tableaux 7 à 16,
  - autre direction -> tableaux 1 à 6,
  - si aucune direction n'est encore sélectionnée -> tableaux 1 à 16.
- Les contrôles d'accès par tableau sont appliqués côté frontend et côté backend.
- Compatibilité historique Tableau 1 : les anciennes déclarations sauvegardées avec Encaissement TTC sont automatiquement converties en HT au chargement.
- Validation des champs obligatoires avant sauvegarde selon le tableau actif.
- Le mois/année sélectionnés sont limités aux périodes encore ouvertes pour le profil connecté.
- Unicité des factures pour les tableaux TVA (2 et 3) sur la clé :
  - fournisseur,
  - référence facture,
  - montant HT.
- Limite temporelle des factures : les factures saisies ne doivent pas dater de plus de 13 mois avant la période actuelle.
  - Exemple : En avril 2026, les factures doivent être de mars 2025 ou plus récentes.
  - Le contrôle est appliqué côté backend lors de la validation.
- Cette unicité et limitation temporelle sont contrôlées côté backend, y compris sur l'historique des périodes.
- Règle de clôture de période (délai légal interne) :
  - Comptes régionaux : date limite = 10 du mois suivant à 23:59:59.
  - Comptes admin et finance : date limite = 15 du mois suivant à 23:59:59.
  - Exemple : période Mars 2026 -> limite au 10 Avril 2026 (régional) et au 15 Avril 2026 (admin/finance), à 23:59:59.
  - Au-delà du délai applicable au compte connecté : création, modification et suppression interdites.
  - Le blocage est appliqué côté frontend et côté backend.
- Permissions de modification/suppression par groupe/direction :
  - Tous les utilisateurs d'une même région peuvent modifier et supprimer les déclarations de cette région.
  - Tous les utilisateurs finance/comptabilité peuvent modifier et supprimer les déclarations du siège.
  - Les admins peuvent modifier/supprimer toutes les déclarations.
  - La permission est basée sur le groupe (direction/région) de l'utilisateur, pas sur qui a créé la déclaration.
  - L'audit enregistre qui a effectué la modification/suppression (audit trail complet).
- Workflow d'approbation des déclarations :
  - Un compte regionale peut être marqué comme approbateur régional.
  - Un approbateur régional peut approuver uniquement les déclarations d'autres utilisateurs de la même région.
  - Un compte finance/comptabilite peut être marqué comme approbateur finance.
  - Un approbateur finance peut approuver uniquement les déclarations du niveau Siège.
  - Un approbateur (régional ou finance) peut aussi approuver ses propres déclarations.
  - Une déclaration modifiée repasse automatiquement en état "En attente" (nouvelle approbation requise).
  - Règles de consultation dashboard fiscal :
    - admin : voit toutes les déclarations (approuvées et en attente), y compris celles émises par les comptes admin et finance/comptabilite.
    - finance/comptabilite : voit toutes les déclarations du niveau Siège (approuvées et en attente) + toutes les déclarations régionales (approuvées et en attente).
    - direction (global) : voit toutes les déclarations du siège approuvées + toutes les déclarations régionales (approuvées et en attente).
- Les données peuvent exister localement (cache local) et sont aussi persistées côté API.

## 3. Recap Fiscaux

### Objectif
Générer et consulter des récapitulatifs fiscaux automatiques regroupant les 7 tableaux consolidés d'une période donnée.

### Fonctionnalités principales
- **Génération des recaps** :
  - Création automatique de récapitulatifs pour une période (mois/année) sélectionnée.
  - Génération de 7 tableaux consolidés :
    1. G50 (Acomptes, TVA, Droits Timbre, TACP, TNFPDAL, IRG, autres taxes)
    2. TVA Collectée (par fournisseur/direction)
    3. TVA Situation (par DR et type)
    4. Droits de Timbre
    5. TACP 7% (Taxe d'Activité professionnelle)
    6. TNFDAL 1% (Taxe nationale de formation)
    7. Masters 1,5% (Taxe sur masters)
  - Overwriting automatique : génération d'une même période remplace l'ancienne version.
- **Historique des recaps** :
  - Tableau d'affichage l'historique de tous les recaps générés.
  - Affichage du mois, année et date de création.
  - Icône Imprimer (vert) pour générer le PDF.
  - Icône Supprimer (rouge) pour retirer un recap.
- **Filtrage avancé** :
  - Filtres par type recap (type de tableau).
  - Filtres par mois et année.
  - Filtres par plage de dates (Du / Au).
  - Bouton "Effacer filtres" pour réinitialiser.
  - Toggle "Afficher les filtres" pour réduire l'interface.
- **Consultation détaillée** :
  - Clic sur ligne d'historique ouvre une popup de consultation.
  - Affichage formaté du tableau avec en-têtes, totaux et bordures claires.
  - Formatage des montants (séparateurs de milliers, virgule pour décimales : format fr-DZ).
  - Bouton Imprimer dans la popup pour génération PDF.
- **Génération PDF** :
  - Template cohérent avec les autres PDFs (en-tête ATM MOBILIS SPA, logo, DR, période, titre).
  - Format paysage A4.
  - Tableau avec bordures, en-têtes gras et totaux soulignés.
  - Impression directe via prévisualisation ou download.
- **Suppression** :
  - Bouton Supprimer dans le popup pour retirer un recap (avec confirmation).
  - Fermeture automatique du popup après suppression.

### Règles métier importantes
- Accès au module Recap : disponible pour les rôles finance/comptabilite, regionale et admin.
- Les recaps consolidés remplacent automatiquement ceux de la même période pour éviter les doublons.
- Les données des recaps sont placeholders zéros (préparation pour intégration avec calculs réels).
- Formatage des montants cohérent avec le reste de l'application (fr-DZ : milliers espaced, virgule décimale).
- Design des tableaux unifié avec shadcn/ui Table pour cohérence visuelle.

## 4. Page Admin

### Objectif
Centraliser l'administration des utilisateurs, des référentiels et de l'audit.

### Fonctionnalités principales
- Tableau de bord admin en 3 onglets :
  - Utilisateurs,
  - Audit,
  - Gestion.
- Gestion des utilisateurs :
  - création,
  - modification,
  - suppression,
  - attribution du rôle,
  - attribution de région,
  - activation de l'option "compte approbateur régional" (checkbox) pour les comptes regionale,
  - activation de l'option "compte approbateur finance" (checkbox) pour les comptes finance/comptabilite,
  - attribution des modules d'accès.
- Journal d'audit :
  - consultation des actions système,
  - filtres (utilisateur, action, dates),
  - tri et visualisation détaillée.
- Espace Gestion (ordre actuel) :
  1. Gestion des banques
  2. Gestion des fournisseurs fiscaux
  3. Configuration des régions
- Configuration des régions :
  - création,
  - modification,
  - suppression,
  - affectation des villes.

### Règles métier importantes
- Accès réservé aux administrateurs.
- Redirection automatique des non-admin vers les pages autorisées.
- Validation numéro de téléphone utilisateur : doit commencer par 0 et contenir exactement 10 chiffres.
- Si le rôle est regionale, la région est obligatoire.
- Si le rôle est regionale, l'option approbateur peut être activée pour autoriser la validation des déclarations de la même région.
- Si le rôle est finance/comptabilite, l'option approbateur finance peut être activée pour autoriser la validation des déclarations du niveau Siège.
- Les actions sensibles sont tracées dans le journal d'audit.

---

## 5. Restrictions d'Accès - Module Recap

### Contrôle d'accès par rôle

Nouvelles règles de contrôle d'accès pour la page Recap :

| Rôle | Accès | Génération | Consultation |
|------|-------|-----------|--------------|
| **Admin** | ✅ Complet | ✅ Oui | ✅ Oui |
| **Finance / Comptabilité** | ✅ Complet | ✅ Oui | ✅ Oui |
| **Régionale** | ❌ Refusé | ❌ Refusé | ❌ Refusé |
| **Direction (Global)** | ✅ Limité | ❌ Refusé (bouton désactivé) | ✅ Oui (consultation et filtrage) |

**Détails d'implémentation :**
- Utilisateurs **régionaux** : voient une page "Accès refusé" avec message explicatif
- Utilisateurs **direction** : le bouton "Generer" est désactivé avec tooltip informatif
- Historique visible pour tous les non-régionaux (consultation, filtrage par type/mois/année, impression PDF)

---

