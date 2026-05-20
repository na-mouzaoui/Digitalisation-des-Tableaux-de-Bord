/**
 * Configuration des étapes de saisie pour chaque domaine de tableaux
 * Définit l'ordre de remplissage des tableaux et la progression
 */

export type DomainKey = "finances" | "DVDRS" | "DQRPC" | "commercial" | "Support" | "regionale"

export interface TableauStep {
  key: string
  label: string
  tabKey?: string
}

/**
 * Étapes de saisie par domaine, dans l'ordre
 */
export const DOMAIN_STEPS: Record<DomainKey, TableauStep[]> = {
  finances: [
    { key: "compte_resultat", label: "Finance DCG", tabKey: "cr" },
    { key: "avancement_engagement", label: "Finance DFC", tabKey: "avancement_engagement" },
  ],
  DVDRS: [
    { key: "suivi_infrastructures_reseau", label: "Suivi Infrastructures Réseau" },
    { key: "evolution_trafic_data", label: "Évolution Trafic Data" },
    { key: "amelioration_qualite", label: "Amélioration Qualité" },
    { key: "couverture_reseau", label: "Couverture Réseau" },
    { key: "action_notable_reseau", label: "Action Notable Réseau" },
    { key: "situation_reseaux", label: "Situation Réseaux" },
  ],
  DQRPC: [
    { key: "disponibilite_reseau", label: "Disponibilité Réseau" },
    { key: "mttr", label: "MTTR / DR" },
  ],
  commercial: [
    { key: "reclamation", label: "Réclamation" },
    { key: "reclamation_gp", label: "Réclamation GP" },
    { key: "e_payement_pop", label: "E-Payment POP" },
    { key: "e_payement_prp", label: "E-Payment PRP" },
    { key: "total_encaissement", label: "Total Encaissement" },
    { key: "rechargement", label: "Rechargement" },
    { key: "recouvrement", label: "Recouvrement" },
    { key: "desactivation_resiliation", label: "Désactivation/Résiliation" },
    { key: "parc_abonnes_b2b", label: "Parc Abonnés B2B" },
    { key: "parc_abonnes_gp", label: "Parc Abonnés GP" },
    { key: "total_parc_abonnes", label: "Total Parc Abonnés" },
    { key: "total_parc_abonnes_technologie", label: "Total Parc Abonnés/Technologie" },
    { key: "activation", label: "Activation SIM" },
    { key: "chiffre_affaires_mda", label: "Chiffre d'Affaires MDA" },
  ],
  Support: [
    { key: "creance_contentieuses", label: "Créances Contentieuses" },
    { key: "rh", label: "Ressources Humaines" },
    { key: "formation", label: "Formation" },
  ],
  regionale: [
    { key: "realisation_technique_reseau", label: "Réalisation Technique Réseau" },
    { key: "amelioration_qualite", label: "Amélioration Qualité" },
    { key: "mttr", label: "MTTR / DR" },
  ],
}

/**
 * Ordre global des domaines
 */
export const DOMAIN_ORDER: DomainKey[] = [
  "finances",
  "DVDRS",
  "DQRPC",
  "commercial",
  "Support",
  "regionale",
]

/**
 * Récupère le prochain tableau à remplir dans le domaine actuel
 * Si c'est le dernier du domaine, retourne le premier du prochain domaine
 * Si c'est le dernier global, retourne null
 */
export function getNextStep(
  currentDomain: DomainKey,
  currentTabKey?: string
): { domain: DomainKey; tabKey: string; label: string } | null {
  const currentSteps = DOMAIN_STEPS[currentDomain]
  const currentIndex = currentSteps.findIndex((step) => step.key === currentTabKey)

  // Si ce n'est pas le dernier tableau du domaine
  if (currentIndex !== -1 && currentIndex < currentSteps.length - 1) {
    const nextStep = currentSteps[currentIndex + 1]
    return {
      domain: currentDomain,
      tabKey: nextStep.key,
      label: nextStep.label,
    }
  }

  // Si c'est le dernier du domaine, passer au domaine suivant
  const currentDomainIndex = DOMAIN_ORDER.indexOf(currentDomain)
  if (currentDomainIndex !== -1 && currentDomainIndex < DOMAIN_ORDER.length - 1) {
    const nextDomain = DOMAIN_ORDER[currentDomainIndex + 1]
    const firstStep = DOMAIN_STEPS[nextDomain][0]
    return {
      domain: nextDomain,
      tabKey: firstStep.key,
      label: firstStep.label,
    }
  }

  // C'est le dernier tableau global
  return null
}

/**
 * Construit l'URL pour le prochain tableau
 */
export function getNextStepPath(
  currentDomain: DomainKey,
  currentTabKey?: string,
  mois?: string,
  annee?: string
): string {
  const nextStep = getNextStep(currentDomain, currentTabKey)
  
  if (!nextStep) {
    // Dernier tableau complété
    return "/dashbord"
  }

  const params = new URLSearchParams()
  if (mois) params.append("mois", mois)
  if (annee) params.append("annee", annee)
  if (nextStep.tabKey) params.append("tab", nextStep.tabKey)

  const queryString = params.toString()
  return `/tableau/${nextStep.domain.toLowerCase()}${queryString ? "?" + queryString : ""}`
}

/**
 * Calcule la progression pour un domaine
 */
export function getDomainProgress(
  domain: DomainKey,
  completedTabKeys: Set<string>
): { completed: number; total: number; percentage: number } {
  const steps = DOMAIN_STEPS[domain]
  const completed = steps.filter((step) => completedTabKeys.has(step.key)).length
  const total = steps.length
  const percentage = total > 0 ? (completed / total) * 100 : 0

  return { completed, total, percentage }
}

/**
 * Récupère le statut actuel (domaine actuel et progression globale)
 */
export function getGlobalProgress(
  currentDomain: DomainKey,
  completedByDomain: Record<DomainKey, Set<string>>
): { currentDomainIndex: number; totalDomains: number; percentage: number } {
  const currentDomainIndex = DOMAIN_ORDER.indexOf(currentDomain)
  
  let totalCompleted = 0
  let totalSteps = 0

  DOMAIN_ORDER.forEach((domain) => {
    const completed = completedByDomain[domain]?.size ?? 0
    const total = DOMAIN_STEPS[domain].length
    totalCompleted += completed
    totalSteps += total
  })

  const percentage = totalSteps > 0 ? (totalCompleted / totalSteps) * 100 : 0

  return {
    currentDomainIndex,
    totalDomains: DOMAIN_ORDER.length,
    percentage,
  }
}
