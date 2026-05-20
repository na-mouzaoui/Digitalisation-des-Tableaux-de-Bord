import { DomainKey } from "@/lib/tableau-domain-steps"

export interface TableauProgressPoint {
  key: string
  label: string
}

export interface TableauProgressStep {
  key: string
  label: string
  points: TableauProgressPoint[]
}

export const DOMAIN_PROGRESS_STEPS: Record<DomainKey, TableauProgressStep[]> = {
  finances: [
    {
      key: "compte_resultat",
      label: "Finance DCG",
      points: [
        { key: "compte_resultat", label: "Compte de Résultat" },
        { key: "investissement", label: "Investissement (MDA)" },
      ],
    },
    {
      key: "avancement_engagement",
      label: "Finance DFC",
      points: [
        { key: "avancement_engagement", label: "Etat d'avancement des engagement (MDA)" },
        { key: "tresorerie", label: "Trésorerie Mobilis (MDA)" },
      ],
    },
  ],
  DVDRS: [
    {
      key: "reseau",
      label: "Reseau technique",
      points: [
        { key: "realisation_technique_reseau", label: "Suivi Infrastructures Réseau 2G/3G/4G" },
        { key: "situation_reseau", label: "Situation Réseau" },
        { key: "trafic_data", label: "Évolution Trafic Data" },
        { key: "amelioration_qualite", label: "Amélioration Qualité" },
        { key: "couverture_reseau", label: "Couverture Réseau" },
        { key: "action_notable_reseau", label: "Action Notable sur le Réseau" },
      ],
    },
  ],
  DQRPC: [
    {
      key: "reseau",
      label: "Qualité Reseau",
      points: [
        { key: "disponibilite_reseau", label: "Disponibilité Réseau" },
        { key: "mttr", label: "MTTR / DR" },
      ],
    },
  ],
  commercial: [
    {
      key: "chiffre_affaires",
      label: "Chiffre d'affaire",
      points: [{ key: "chiffre_affaires_mda", label: "Chiffre d'Affaires MDA" }],
    },
    {
      key: "parc_abonnes",
      label: "Parc Abonne",
      points: [
        { key: "parc_abonnes_gp", label: "Parc Abonnés GP" },
        { key: "total_parc_abonnes_technologie", label: "Parc Abonnés par technologie" },
      ],
    },
    {
      key: "activation_desactivation_sim",
      label: "Activation",
      points: [
        { key: "desactivation_resiliation", label: "Désactivation / Résiliation" },
        { key: "activation", label: "Activation SIM" },
      ],
    },
    {
      key: "reclamation",
      label: "Reclamation",
      points: [
        { key: "reclamation", label: "Réclamation" },
      ],
    },
    {
      key: "e_payment",
      label: "E-payment",
      points: [
        { key: "e_payement_pop", label: "E-PAYEMENT (MDA)" },
      ],
    },
    {
      key: "encaissement",
      label: "Encaissement",
      points: [{ key: "total_encaissement", label: "Total des encaissements" }],
    },
    {
      key: "rechargement",
      label: "Rechargement",
      points: [{ key: "rechargement", label: "Rechargement" }],
    },
    {
      key: "recouvrement",
      label: "Recouvrement",
      points: [{ key: "recouvrement", label: "Recouvrement" }],
    },
  ],
  Support: [
    {
      key: "creances_contentieuses",
      label: "Créances Contentieuses",
      points: [
        { key: "creances_contentieuses", label: "Recouvrement Créances" },
        { key: "creances_contentieuses_anterieur", label: "Antérieur au 01/01/2024" },
      ],
    },
    {
      key: "rh",
      label: "RH",
      points: [
        { key: "frais_personnel", label: "Frais personnel" },
        { key: "effectif_gsp", label: "Effectif GSP" },
        { key: "absenteisme", label: "Absentéisme" },
        { key: "mouvement_effectifs", label: "Mouvement effectifs" },
        { key: "mouvement_effectifs_domaine", label: "Mouvement effectifs domaine" },
      ],
    },
    {
      key: "formation",
      label: "Formation",
      points: [
        { key: "effectifs_formes_gsp", label: "Effectifs formés GSP" },
        { key: "formations_domaines", label: "Formations domaines" },
        { key: "budget_formation", label: "Budget formation" },
      ],
    },
  ],
  regionale: [
    {
      key: "reseau",
      label: "Réseau",
      points: [
        { key: "realisation_technique_reseau", label: "Réalisation Technique Réseau" },
        { key: "amelioration_qualite", label: "Amélioration Qualité" },
        { key: "mttr", label: "MTTR / DR" },
      ],
    },
  ],
}

export function getDomainProgressSteps(domain: DomainKey): TableauProgressStep[] {
  return DOMAIN_PROGRESS_STEPS[domain]
}
