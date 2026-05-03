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
      label: "Compte de Résultat",
      points: [{ key: "compte_resultat", label: "Compte de Résultat" }],
    },
  ],
  DVDRS: [
    {
      key: "suivi_infrastructures_reseau",
      label: "Suivi Infrastructures Réseau",
      points: [{ key: "suivi_infrastructures_reseau", label: "Suivi Infrastructures Réseau" }],
    },
    {
      key: "evolution_trafic_data",
      label: "Évolution Trafic Data",
      points: [{ key: "evolution_trafic_data", label: "Évolution Trafic Data" }],
    },
    {
      key: "amelioration_qualite",
      label: "Amélioration Qualité",
      points: [{ key: "amelioration_qualite", label: "Amélioration Qualité" }],
    },
    {
      key: "couverture_reseau",
      label: "Couverture Réseau",
      points: [{ key: "couverture_reseau", label: "Couverture Réseau" }],
    },
    {
      key: "action_notable_reseau",
      label: "Action Notable Réseau",
      points: [{ key: "action_notable_reseau", label: "Action Notable Réseau" }],
    },
    {
      key: "situation_reseaux",
      label: "Situation Réseaux",
      points: [{ key: "situation_reseaux", label: "Situation Réseaux" }],
    },
  ],
  DQRPC: [
    {
      key: "disponibilite_reseau",
      label: "Disponibilité Réseau",
      points: [{ key: "disponibilite_reseau", label: "Disponibilité Réseau" }],
    },
    {
      key: "mttr",
      label: "MTTR / DR",
      points: [{ key: "mttr", label: "MTTR / DR" }],
    },
  ],
  commercial: [
    {
      key: "reclamation",
      label: "Reclamation",
      points: [
        { key: "reclamation", label: "Réclamation" },
        { key: "reclamation_gp", label: "Réclamation GP" },
      ],
    },
    {
      key: "e_payment",
      label: "E-payment",
      points: [
        { key: "e_payement_pop", label: "E-payment Pop" },
        { key: "e_payement_prp", label: "E-payment Prp" },
      ],
    },
    {
      key: "rechargement",
      label: "Rechargement",
      points: [{ key: "rechargement", label: "Rechargement" }],
    },
    {
      key: "encaissement",
      label: "Encaissement",
      points: [{ key: "total_encaissement", label: "Total des encaissements" }],
    },
    {
      key: "recouvrement",
      label: "Recouvrement",
      points: [{ key: "recouvrement", label: "Recouvrement" }],
    },
    {
      key: "parc_abonnes",
      label: "Parc Abonne",
      points: [
        { key: "parc_abonnes_b2b", label: "Parc Abonnés B2B" },
        { key: "parc_abonnes_gp", label: "Parc Abonnés GP" },
        { key: "total_parc_abonnes", label: "Total Parc Abonnés" },
        { key: "total_parc_abonnes_technologie", label: "Parc Abonnés par technologie" },
      ],
    },
    {
      key: "activation_desactivation_sim",
      label: "Activation / desactivation SIM",
      points: [
        { key: "desactivation_resiliation", label: "Désactivation / Résiliation" },
        { key: "activation", label: "Activation SIM" },
      ],
    },
    {
      key: "chiffre_affaires",
      label: "Chiffre d'affaire",
      points: [{ key: "chiffre_affaires_mda", label: "Chiffre d'Affaires MDA" }],
    },
  ],
  Support: [
    {
      key: "creance_contentieuses",
      label: "Creance contentieuses",
      points: [{ key: "creance_contentieuses", label: "Créances contentieuses" }],
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
        { key: "frequence_formation", label: "Fréquence formation" },
      ],
    },
  ],
  regionale: [
    {
      key: "realisation_technique_reseau",
      label: "Réalisation Technique Réseau",
      points: [{ key: "realisation_technique_reseau", label: "Réalisation Technique Réseau" }],
    },
    {
      key: "amelioration_qualite",
      label: "Amélioration Qualité",
      points: [{ key: "amelioration_qualite", label: "Amélioration Qualité" }],
    },
    {
      key: "mttr",
      label: "MTTR / DR",
      points: [{ key: "mttr", label: "MTTR / DR" }],
    },
  ],
}

export function getDomainProgressSteps(domain: DomainKey): TableauProgressStep[] {
  return DOMAIN_PROGRESS_STEPS[domain]
}
