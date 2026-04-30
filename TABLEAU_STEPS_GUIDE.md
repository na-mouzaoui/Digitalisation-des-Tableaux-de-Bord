# Système Step-by-Step pour les Tableaux

## Vue d'ensemble

Un nouveau système de workflow a été mis en place pour naviguer séquentiellement entre les tableaux:

1. **Navigation automatique**: Après enregistrement → tableau suivant du même domaine
2. **Passage de domaine**: Dernier tableau du domaine → premier tableau du domaine suivant
3. **Fin du workflow**: Dernier tableau global → retour au dashboard

## Fichiers créés

### Librairies
- `/lib/tableau-steps.ts`: Configuration des étapes par domaine, logique de navigation

### Composants
- `/components/tableau-step-nav.tsx`: Affichage de la progression des étapes
- `/components/tableau-header.tsx`: En-tête générique pour les pages de tableau

### Hooks
- `/hooks/use-tableau-step-navigation.ts`: Gestion de la navigation

## Architecture

### 1. Configuration des domaines

Chaque domaine a une liste d'étapes ordonnées:

```typescript
DOMAIN_STEPS: {
  finances: [{ key: "compte_resultat", label: "Compte de Résultat" }],
  DVDRS: [
    { key: "suivi_infrastructures_reseau", label: "..." },
    { key: "evolution_trafic_data", label: "..." },
    // ...
  ],
  // ...
}
```

Ordre global: `finances` → `DVDRS` → `DQRPC` → `commercial` → `Support` → `regionale`

### 2. Navigation

Fonction `getNextStepPath()`:
- Prend: domaine actuel + tabKey actuel + mois/année
- Retourne: URL du prochain tableau
- Si dernier global → retourne `/dashbord`

### 3. UI

- `TableauHeader`: En-tête avec progression visuelle
- `TableauStepNav`: Liste verticale des étapes avec statuts
- `TableauStepNavHorizontal`: Progression horizontale (optionnelle)

## Intégration dans une page

### Étape 1: Imports

```typescript
import { useTableauStepNavigation } from "@/hooks/use-tableau-step-navigation"
import { TableauHeader } from "@/components/tableau-header"
```

### Étape 2: Dans le composant

```typescript
export default function FinancesPage() {
  const { navigateToNextStep, getCurrentTabKey, getMoisAnnee } = useTableauStepNavigation("finances")
  const currentTabKey = getCurrentTabKey()
  const { mois, annee } = getMoisAnnee()

  const handleSave = async () => {
    try {
      // ... sauvegarder les données ...
      
      // Navigation automatique au prochain tableau
      navigateToNextStep()
      
      toast({ title: "Enregistré et passage au suivant!" })
    } catch (error) {
      // ... gestion d'erreur ...
    }
  }

  return (
    <LayoutWrapper>
      <TableauHeader
        title="Tableaux Financiers"
        domain="finances"
        currentTabKey={currentTabKey}
        mois={mois}
        annee={annee}
        onBackClick={() => router.push("/dashbord")}
      />
      
      {/* Contenu du tableau */}
    </LayoutWrapper>
  )
}
```

### Étape 3: Modifier handleSave

Remplacer `router.push("/dashbord")` par `navigateToNextStep()`

## Pages à modifier

✓ `/app/tableau/finances/page.tsx`
✓ `/app/tableau/commercial/page.tsx`
✓ `/app/tableau/DVDRS/page.tsx`
✓ `/app/tableau/DQRPC/page.tsx`
✓ `/app/tableau/Support/page.tsx`
✓ `/app/tableau/regionale/page.tsx`

## Progression visuelle

### Statuts des étapes
- **Bleu**: Étape actuelle
- **Vert**: Étape complétée
- **Gris**: En attente

### Composants disponibles
- `TableauStepNav`: Liste verticale (détaillée)
- `TableauStepNavHorizontal`: Barres horizontales (compacte)

## Exemple complet

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useTableauStepNavigation } from "@/hooks/use-tableau-step-navigation"
import { TableauHeader } from "@/components/tableau-header"
import { LayoutWrapper } from "@/components/layout-wrapper"

export default function FinancesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { navigateToNextStep, getCurrentTabKey, getMoisAnnee } = useTableauStepNavigation("finances")
  
  const currentTabKey = getCurrentTabKey()
  const { mois, annee } = getMoisAnnee()

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSave = async () => {
    try {
      setIsSubmitting(true)
      
      // Logique d'enregistrement existante
      // ...
      
      // Navigation automatique
      navigateToNextStep()
      toast({ title: "Tableau enregistré!" })
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <LayoutWrapper>
      <TableauHeader
        title="Tableaux Financiers"
        domain="finances"
        currentTabKey={currentTabKey}
        mois={mois}
        annee={annee}
        onBackClick={() => router.push("/dashbord")}
        layout="vertical"
      />
      
      {/* Contenu existant */}
    </LayoutWrapper>
  )
}
```
