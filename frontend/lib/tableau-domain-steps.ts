/**
 * Configuration des étapes de saisie indépendantes par domaine
 * Chaque domaine a son propre flux de step-by-step
 * Après le dernier tab d'un domaine → retour au dashboard
 */

export type DomainKey = "finances" | "DVDRS" | "DQRPC" | "commercial" | "Support" | "regionale"

const DOMAIN_ROUTE_SEGMENTS: Record<DomainKey, string> = {
  finances: "finances",
  DVDRS: "DVDRS",
  DQRPC: "DQRPC",
  commercial: "commercial",
  Support: "Support",
  regionale: "regionale",
}

export interface TableauStep {
  key: string
  label: string
}

/**
 * Étapes indépendantes pour chaque domaine
 */
export const DOMAIN_STEPS: Record<DomainKey, TableauStep[]> = {
  finances: [
    { key: "compte_resultat", label: "Finance DCG" },
    { key: "avancement_engagement", label: "Finance DFC" },
  ],
  DVDRS: [
    { key: "reseau", label: "Reseau technique" },
  ],
  DQRPC: [
    { key: "reseau", label: "Qualité Reseau" },
  ],
  commercial: [
    { key: "chiffre_affaires_mda", label: "Chiffre d'Affaires MDA" },
    { key: "parc_abonnes_b2b", label: "Parc Abonnés B2B" },
    { key: "parc_abonnes_gp", label: "Parc Abonnés GP" },
    { key: "total_parc_abonnes", label: "Total Parc Abonnés" },
    { key: "total_parc_abonnes_technologie", label: "Total Parc Abonnés/Technologie" },
    { key: "desactivation_resiliation", label: "Désactivation/Résiliation" },
    { key: "activation", label: "Activation SIM" },
    { key: "reclamation", label: "Réclamation" },
    { key: "reclamation_gp", label: "Réclamation GP" },
    { key: "e_payement_pop", label: "E-Payment POP" },
    { key: "e_payement_prp", label: "E-Payment PRP" },
    { key: "total_encaissement", label: "Total Encaissement" },
    { key: "rechargement", label: "Rechargement" },
    { key: "recouvrement", label: "Recouvrement" },
  ],
  Support: [
    { key: "creances_contentieuses", label: "Créances Contentieuses" },
    { key: "rh", label: "Ressources Humaines" },
    { key: "formation", label: "Formation" },
  ],
  regionale: [
    { key: "reseau", label: "Réseau" },
  ],
}

/**
 * Récupère l'étape suivante DANS LE MÊME DOMAINE
 * Si c'est le dernier tab, retourne null → retour au dashboard
 */
export function getNextStep(
  domain: DomainKey,
  currentTabKey?: string
): { tabKey: string; label: string } | null {
  const steps = DOMAIN_STEPS[domain]
  const currentIndex = steps.findIndex((step) => step.key === currentTabKey)

  // Si ce n'est pas le dernier tab du domaine
  if (currentIndex !== -1 && currentIndex < steps.length - 1) {
    const nextStep = steps[currentIndex + 1]
    return {
      tabKey: nextStep.key,
      label: nextStep.label,
    }
  }

  // Dernier tab du domaine
  return null
}

/**
 * Construit l'URL pour le prochain tab du même domaine
 * Si dernier tab → retourne "/dashbord"
 */
export function getNextStepPath(
  domain: DomainKey,
  currentTabKey?: string,
  mois?: string,
  annee?: string
): string {
  const nextStep = getNextStep(domain, currentTabKey)

  if (!nextStep) {
    // Dernier tab du domaine → retour au dashboard
    return "/dashbord"
  }

  const params = new URLSearchParams()
  if (mois) params.append("mois", mois)
  if (annee) params.append("annee", annee)
  params.append("tab", nextStep.tabKey)

  const queryString = params.toString()
  return `/tableau/${DOMAIN_ROUTE_SEGMENTS[domain]}${queryString ? "?" + queryString : ""}`
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
