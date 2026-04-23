"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Save } from "lucide-react"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import { API_BASE } from "@/lib/config"
import {
  getCurrenttableauPeriod,
  gettableauPeriodLockMessage,
  istableauPeriodLocked,
} from "@/lib/fiscal-period-deadline"
import { synctableauPolicy } from "@/lib/fiscal-policy"
import {
  getManageabletableauTabKeysForDirection,
  isAdmintableauRole,
  isRegionaltableauRole,
  isFinancetableauRole,
  istableauTabDisabledByPolicy,
} from "@/lib/fiscal-tab-access"


// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTES GLOBALES
// ─────────────────────────────────────────────────────────────────────────────
const PRIMARY_COLOR = "#2db34b"


// ─────────────────────────────────────────────────────────────────────────────
// 3. HELPERS DE FORMATAGE DES MONTANTS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (v: number | string) => {
  if (v === "" || isNaN(Number(v))) return ""
  const n = Number(v)
  const [intPart, decPart] = n.toFixed(2).split(".")
  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decPart}`
}

const normalizeAmountInput = (value: string) => {
  const raw = value.replace(/\u00A0/g, " ").trim()
  if (!raw) return ""
  const hasTrailingSeparator = /[.,]$/.test(raw)
  const cleaned = raw.replace(/\s/g, "").replace(/,/g, ".").replace(/[^0-9.]/g, "")
  if (!cleaned) return ""
  const parts = cleaned.split(".")
  const integerPart = (parts[0] || "0").replace(/^0+(?=\d)/, "")
  const decimalPart = parts.slice(1).join("").slice(0, 2)
  if (hasTrailingSeparator && decimalPart.length === 0) return `${integerPart}.`
  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart
}

const formatAmountInput = (value: string) => {
  const normalized = normalizeAmountInput(value)
  if (!normalized) return ""
  const hasTrailingDot = normalized.endsWith(".")
  const [integerPart, decimalPart = ""] = normalized.split(".")
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  if (hasTrailingDot) return `${grouped},`
  return decimalPart ? `${grouped},${decimalPart}` : grouped
}

const num = (v: string) => {
  const normalized = normalizeAmountInput(v)
  return parseFloat(normalized.endsWith(".") ? normalized.slice(0, -1) : normalized) || 0
}

const toPercent = (numerator: number, denominator: number) =>
  denominator ? (numerator / denominator) * 100 : 0


// ─────────────────────────────────────────────────────────────────────────────
// 4. COMPOSANT GÉNÉRIQUE : AmountInput
// ─────────────────────────────────────────────────────────────────────────────
type AmountInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

function AmountInput({ value, onChange, ...props }: AmountInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange) return
    const normalizedValue = normalizeAmountInput(event.target.value)
    onChange({
      ...event,
      target: { ...event.target, value: normalizedValue },
      currentTarget: { ...event.currentTarget, value: normalizedValue },
    } as React.ChangeEvent<HTMLInputElement>)
  }
  return <Input {...props} type="text" inputMode="decimal" value={formatAmountInput(value)} onChange={handleChange} />
}


// ═════════════════════════════════════════════════════════════════════════════
// 5. TYPES DE DONNÉES
//
//    ┌─ GUIDE : AJOUTER UN NOUVEAU TABLEAU ────────────────────────────────┐
//    │  a) Déclarez son type ici                                            │
//    │  b) Créez ses constantes DEFAULT_* et LABELS_* juste en dessous     │
//    │  c) Créez son composant Tab* (section 6)                             │
//    │  d) Ajoutez son état dans Savedtableau (section 8a)                   │
//    │  e) Ajoutez son normalize* (section 8b)                              │
//    │  f) Ajoutez son état useState (section 10d)                          │
//    │  g) Incluez-le dans handleSave (section 10n)                         │
//    │  h) Ajoutez-le dans le JSX (section 11)                              │
//    └─────────────────────────────────────────────────────────────────────┘
// ═════════════════════════════════════════════════════════════════════════════

// ── Réclamation ──────────────────────────────────────────────────────────────
type ReclamationRow = {
  category: "recues" | "traitees"
  type: "GP" | "B2B"
  mGp: string; mB2b: string; m1Gp: string; m1B2b: string
}
const DEFAULT_RECLAMATION_ROWS: ReclamationRow[] = [
  { category: "recues",   type: "GP",  mGp: "", mB2b: "", m1Gp: "", m1B2b: "" },
  { category: "recues",   type: "B2B", mGp: "", mB2b: "", m1Gp: "", m1B2b: "" },
  { category: "traitees", type: "GP",  mGp: "", mB2b: "", m1Gp: "", m1B2b: "" },
  { category: "traitees", type: "B2B", mGp: "", mB2b: "", m1Gp: "", m1B2b: "" },
]

// ── Réclamation GP ───────────────────────────────────────────────────────────
type ReclamationGpRow = { label: string; recues: string; traitees: string }
const RECLAMATION_GP_LABELS = ["Appels", "Couverture", "Offres", "Data", "SMS", "Autres"] as const
const DEFAULT_RECLAMATION_GP_ROWS: ReclamationGpRow[] = RECLAMATION_GP_LABELS.map((label) => ({ label, recues: "", traitees: "" }))

// ── E-Payement ───────────────────────────────────────────────────────────────
type EPayementRow = { rechargement: string; m: string; m1: string; evol: string }
const EPAYEMENT_CHANNELS = ["Baridimob", "webportail", "GAB-Alg Poste", "WINPAY (BNA)"] as const
const createDefaultEPayementRows = (): EPayementRow[] =>
  EPAYEMENT_CHANNELS.map((rechargement) => ({ rechargement, m: "", m1: "", evol: "" }))

// ── Total Encaissement ───────────────────────────────────────────────────────
type TotalEncaissementRow = { mGp: string; mB2b: string; m1Gp: string; m1B2b: string; evol: string }
const EMPTY_TOTAL_ENCAISSEMENT_ROW: TotalEncaissementRow = { mGp: "", mB2b: "", m1Gp: "", m1B2b: "", evol: "-" }

// ── Recouvrement ─────────────────────────────────────────────────────────────
type RecouvrementRow = { label: string; mGp: string; mB2b: string; m1Gp: string; m1B2b: string }
const RECOUVREMENT_LABELS = ["Montant Mis en Recouvrement", "Montant Recouvre", "Total"] as const
const DEFAULT_RECOUVREMENT_ROWS: RecouvrementRow[] = RECOUVREMENT_LABELS.map((label) => ({ label, mGp: "", mB2b: "", m1Gp: "", m1B2b: "" }))

// ── Réalisation Technique Réseau ─────────────────────────────────────────────
type RealisationTechniqueReseauRow = { label: string; m: string; m1: string }
const REALISATION_TECHNIQUE_RESEAU_LABELS = ["sites acquis", "site en cours de construction", "sites construits"] as const
const DEFAULT_REALISATION_TECHNIQUE_RESEAU_ROWS: RealisationTechniqueReseauRow[] =
  REALISATION_TECHNIQUE_RESEAU_LABELS.map((label) => ({ label, m: "", m1: "" }))

// ── Situation Réseau ─────────────────────────────────────────────────────────
type SituationReseauRow = { situation: string; equipements: string; m: string; m1: string }
const DEFAULT_SITUATION_RESEAU_ROWS: SituationReseauRow[] = [
  { situation: "Reseau 2G", equipements: "BTS 900/1800 Mhz", m: "", m1: "" },
  { situation: "Reseau 3G", equipements: "NodeB", m: "", m1: "" },
  { situation: "Reseau 4G", equipements: "eNodeB (Evolved NodeB) (FDD+TDD)\neNodeB (Evolved NodeB) (FDD)", m: "", m1: "" },
]

// ── Trafic Data ──────────────────────────────────────────────────────────────
type TraficDataRow = { label: string; m: string; m1: string }
const TRAFIC_DATA_LABELS = ["2G-3G Traffic Volume per day", "4G Traffic Volume per day", "Total daily traffic volume"] as const
const DEFAULT_TRAFIC_DATA_ROWS: TraficDataRow[] = TRAFIC_DATA_LABELS.map((label) => ({ label, m: "", m1: "" }))

// ── Amélioration Qualité ──────────────────────────────────────────────────────
type AmeliorationQualiteRow = { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }
const EMPTY_AMELIORATION_QUALITE_ROW: AmeliorationQualiteRow = { wilaya: "", mObjectif: "", mRealise: "", m1Objectif: "", m1Realise: "", ecart: "" }

// ── Couverture Réseau ─────────────────────────────────────────────────────────
type CouvertureReseauRow = { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }
const EMPTY_COUVERTURE_RESEAU_ROW: CouvertureReseauRow = { wilaya: "", mObjectif: "", mRealise: "", m1Objectif: "", m1Realise: "", ecart: "" }

// ── Action Notable Réseau ─────────────────────────────────────────────────────
type ActionNotableReseauRow = { action: string; objectif2025: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const DEFAULT_ACTION_NOTABLE_RESEAU_ROWS: ActionNotableReseauRow[] = [
  { action: "Densification de couverture par des nouveaux sites", objectif2025: "Acquisition et Integration de 2000 nouveaux sites", mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" },
  { action: "Densification du LTE_30Mhz (1800_15+2100_15)", objectif2025: "La mise a niveau de 1000 sites avec la technologie 4G", mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" },
  { action: "Usage de la neutralite technologique sur la bande 2100Mhz en faveur de la LTE (0-15Mhz)", objectif2025: "Implementation et integration de 15Mhz de la bande passante 2100Mhz avec la technologie 4G sur 600 Sites", mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" },
  { action: "Implementation de la couche LTE TDD 2300", objectif2025: "Implementation et integration de 3000 Sites LTE TDD (Massive MIMO & 8T8R) pour les Sites 4G (1800/2100) sur les 58 wilaya", mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" },
]

// ── Disponibilité Réseau ──────────────────────────────────────────────────────
type DisponibiliteReseauRow = { designation: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const DISPONIBILITE_RESEAU_LABELS = ["Disponibilite des Services", "Disponibilite Coeur Reseau", "Disponibilite Acces Radio 2G", "Disponibilite Acces Radio 3G", "Disponibilite Acces Radio 4G", "Drop call 2G", "RAB Voice Drop 3G", "ERAB Drop 4G", "MTTR", "2G Congestion Rate", "Disponibilite Globale reseau"] as const
const DEFAULT_DISPONIBILITE_RESEAU_ROWS: DisponibiliteReseauRow[] = DISPONIBILITE_RESEAU_LABELS.map((designation) => ({ designation, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))

// ── Désactivation / Résiliation ───────────────────────────────────────────────
type DesactivationResiliationRow = { designation: string; m: string; m1: string; evol: string }
const DESACTIVATION_RESILIATION_LABELS = ["Postpaid GP", "Prepaid GP", "Postpaid B2B", "Prepaid B2B", "Total"] as const
const DEFAULT_DESACTIVATION_RESILIATION_ROWS: DesactivationResiliationRow[] = DESACTIVATION_RESILIATION_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ── Parc Abonnés B2B ──────────────────────────────────────────────────────────
type ParcAbonnesB2BRow = { designation: string; m: string; m1: string; evol: string }
const PARC_ABONNES_B2B_LABELS = ["Postpaid B2B", "Prepaid B2B", "TOTAL"] as const
const DEFAULT_PARC_ABONNES_B2B_ROWS: ParcAbonnesB2BRow[] = PARC_ABONNES_B2B_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ── Parc Abonnés GP ───────────────────────────────────────────────────────────
type ParcAbonnesGpRow = { designation: string; m: string; m1: string; evol: string }
const PARC_ABONNES_GP_LABELS = ["Postpaid GP", "Prepaid GP", "TOTAL"] as const
const DEFAULT_PARC_ABONNES_GP_ROWS: ParcAbonnesGpRow[] = PARC_ABONNES_GP_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ── Total Parc Abonnés ────────────────────────────────────────────────────────
type TotalParcAbonnesRow = { designation: string; m: string; m1: string; evol: string }
const TOTAL_PARC_ABONNES_LABELS = ["Parc Postpaid", "Parc Prepaid", "TOTAL"] as const
const DEFAULT_TOTAL_PARC_ABONNES_ROWS: TotalParcAbonnesRow[] = TOTAL_PARC_ABONNES_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ── Total Parc Abonnés par Technologie ───────────────────────────────────────
type TotalParcAbonnesTechnologieRow = { designation: string; m: string; m1: string; evol: string }
const TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS = ["2G", "3G", "4G", "TOTAL"] as const
const DEFAULT_TOTAL_PARC_ABONNES_TECHNOLOGIE_ROWS: TotalParcAbonnesTechnologieRow[] = TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ── Activation ────────────────────────────────────────────────────────────────
type ActivationRow = { designation: string; m: string; m1: string; evol: string }
const ACTIVATION_LABELS = ["Postpaid GP", "Prepaid GP", "Postpaid B2B", "Prepaid B2B", "Total"] as const
const DEFAULT_ACTIVATION_ROWS: ActivationRow[] = ACTIVATION_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ── Chiffre d'Affaires MDA ────────────────────────────────────────────────────
type ChiffreAffairesMdaRow = { designation: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const CHIFFRE_AFFAIRES_MDA_LABELS = ["Grand Public", "B2B", "Interco & Roaming"] as const
const DEFAULT_CHIFFRE_AFFAIRES_MDA_ROWS: ChiffreAffairesMdaRow[] = CHIFFRE_AFFAIRES_MDA_LABELS.map((designation) => ({ designation, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))

// ── Créances Contentieuses ────────────────────────────────────────────────────
type CreancesContentieusesRow = { designation: string; m: string; m1: string; evol: string }
const CREANCES_CONTENTIEUSES_LABELS = ["Objectif", "Montant recouvre", "Taux de recouvrement"] as const
const DEFAULT_CREANCES_CONTENTIEUSES_ROWS: CreancesContentieusesRow[] = CREANCES_CONTENTIEUSES_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ── Frais Personnel ───────────────────────────────────────────────────────────
type FraisPersonnelRow = { designation: string; m: string; m1: string }
const FRAIS_PERSONNEL_LABELS = ["Objectif", "Realisation", "Taux d'atteinte", "Salaire Moyen"] as const
const DEFAULT_FRAIS_PERSONNEL_ROWS: FraisPersonnelRow[] = FRAIS_PERSONNEL_LABELS.map((designation) => ({ designation, m: "", m1: "" }))

// ── Effectif GSP ──────────────────────────────────────────────────────────────
type EffectifGspRow = { gsp: string; m: string; m1: string; part: string }
const EFFECTIF_GSP_LABELS = ["Cadres Sup", "Cadres", "Maitrise", "Execution", "Total"] as const
const DEFAULT_EFFECTIF_GSP_ROWS: EffectifGspRow[] = EFFECTIF_GSP_LABELS.map((gsp) => ({ gsp, m: "", m1: "", part: "" }))

// ── Absentéisme ───────────────────────────────────────────────────────────────
type AbsenteismeRow = { motif: string; m: string; m1: string; part: string }
const ABSENTEISME_LABELS = ["Irregulieres", "Cadre Disciplinaire", "Cadre Medical", "Autorisees", "TOTAL"] as const
const DEFAULT_ABSENTEISME_ROWS: AbsenteismeRow[] = ABSENTEISME_LABELS.map((motif) => ({ motif, m: "", m1: "", part: "" }))

// ── Mouvement Effectifs ───────────────────────────────────────────────────────
type MouvementEffectifsRow = {
  bloc: "arrives" | "departs"; operation: string
  mCadresSup: string; mCadres: string; mMaitrise: string; mExecution: string
  m1CadresSup: string; m1Cadres: string; m1Maitrise: string; m1Execution: string
}
const MOUVEMENT_EFFECTIFS_TEMPLATE: Array<{ bloc: MouvementEffectifsRow["bloc"]; operation: string }> = [
  { bloc: "arrives", operation: "Detachement" }, { bloc: "arrives", operation: "Recrutement" },
  { bloc: "arrives", operation: "Reintegration" }, { bloc: "arrives", operation: "Stagiaires" },
  { bloc: "arrives", operation: "Personnes a besoins specifiques" }, { bloc: "arrives", operation: "TOTAL" },
  { bloc: "departs", operation: "Abandon de poste" }, { bloc: "departs", operation: "Deces" },
  { bloc: "departs", operation: "Demission" }, { bloc: "departs", operation: "Detachement" },
  { bloc: "departs", operation: "Fin de contrat" }, { bloc: "departs", operation: "Licenciement" },
  { bloc: "departs", operation: "Retraite" }, { bloc: "departs", operation: "Stagiaires" },
  { bloc: "departs", operation: "Personnes a besoins specifiques" }, { bloc: "departs", operation: "TOTAL" },
]
const DEFAULT_MOUVEMENT_EFFECTIFS_ROWS: MouvementEffectifsRow[] = MOUVEMENT_EFFECTIFS_TEMPLATE.map((item) => ({
  ...item, mCadresSup: "", mCadres: "", mMaitrise: "", mExecution: "",
  m1CadresSup: "", m1Cadres: "", m1Maitrise: "", m1Execution: "",
}))

// ── Mouvement Effectifs par Domaine ───────────────────────────────────────────
type MouvementEffectifsDomaineRow = {
  bloc: "recrutement" | "sortant"; domaine: string
  mCdi: string; mCdd: string; mCta: string
  m1Cdi: string; m1Cdd: string; m1Cta: string
}
const MOUVEMENT_EFFECTIFS_DOMAINE_TEMPLATE: Array<{ bloc: MouvementEffectifsDomaineRow["bloc"]; domaine: string }> = [
  { bloc: "recrutement", domaine: "COMMERCIAL" }, { bloc: "recrutement", domaine: "MANAGEMENT" },
  { bloc: "recrutement", domaine: "SUPPORT" }, { bloc: "recrutement", domaine: "TECHNIQUE" },
  { bloc: "recrutement", domaine: "TOTAL" },
  { bloc: "sortant", domaine: "COMMERCIAL" }, { bloc: "sortant", domaine: "MANAGEMENT" },
  { bloc: "sortant", domaine: "SUPPORT" }, { bloc: "sortant", domaine: "TECHNIQUE" },
  { bloc: "sortant", domaine: "TOTAL" },
]
const DEFAULT_MOUVEMENT_EFFECTIFS_DOMAINE_ROWS: MouvementEffectifsDomaineRow[] = MOUVEMENT_EFFECTIFS_DOMAINE_TEMPLATE.map((item) => ({
  ...item, mCdi: "", mCdd: "", mCta: "", m1Cdi: "", m1Cdd: "", m1Cta: "",
}))

// ── Compte Résultat ───────────────────────────────────────────────────────────
type CompteResultatRow = { designation: string; mBudget: string; mRealise: string; mTaux: string; m1Budget: string; m1Realise: string; m1Taux: string }
const COMPTE_RESULTAT_LABELS = [
  "Chiffre d'affaire GP", "Chiffre d'affair ME", "Chiffre d'affairs Interco -roming", "Total CA",
  "Consommation de l'exercice", "Service Exterieurs et autres consommations", "VALEUR AJOUTEE D'EXPLOITATION",
  "Charge du Personnel", "Impots, Taxes et versement assimile", "EBE", "Autres produits Operasionnels",
  "Autres charges Operationnelles", "Dotations aux amortissements", "Reprises sur pertes de valeur et provisions",
  "Resultat Operationnel",
] as const
const DEFAULT_COMPTE_RESULTAT_ROWS: CompteResultatRow[] = COMPTE_RESULTAT_LABELS.map((designation) => ({ designation, mBudget: "", mRealise: "", mTaux: "", m1Budget: "", m1Realise: "", m1Taux: "" }))

// ── Effectifs Formés GSP ──────────────────────────────────────────────────────
type EffectifsFormesGspRow = { gsp: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const EFFECTIFS_FORMES_GSP_LABELS = ["Cadres & cadres Superieures", "Execution", "Maitrise", "Total Personnes Formees"] as const
const DEFAULT_EFFECTIFS_FORMES_GSP_ROWS: EffectifsFormesGspRow[] = EFFECTIFS_FORMES_GSP_LABELS.map((gsp) => ({ gsp, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))

// ── Formations par Domaines ───────────────────────────────────────────────────
type FormationsDomainesRow = { domaine: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const FORMATIONS_DOMAINES_LABELS = ["Commercial", "Technique", "Management", "Divers (Langue Anglaise)", "Total Formations effectuees"] as const
const DEFAULT_FORMATIONS_DOMAINES_ROWS: FormationsDomainesRow[] = FORMATIONS_DOMAINES_LABELS.map((domaine) => ({ domaine, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))

// ── MTTR ──────────────────────────────────────────────────────────────────────
type MttrCityRow = { wilayaM: string; objectifM: string; realiseM: string; wilayaM1: string; objectifM1: string; realiseM1: string; ecart: string }
type MttrRegionRow = { region: string; cities: MttrCityRow[] }
const MTTR_REGIONS = ["DR Alger", "DR Oran", "DR Constantine", "DR Setif", "DR Ouargla", "DR Bechar", "DR Annaba", "DR Chlef"] as const
const EMPTY_MTTR_CITY_ROW: MttrCityRow = { wilayaM: "", objectifM: "", realiseM: "", wilayaM1: "", objectifM1: "", realiseM1: "", ecart: "" }
const DEFAULT_MTTR_ROWS: MttrRegionRow[] = MTTR_REGIONS.map((region) => ({ region, cities: [{ ...EMPTY_MTTR_CITY_ROW }] }))

// ── (MODÈLE) Nouveau tableau ──────────────────────────────────────────────────
// type MonNouveauTableauRow = { col1: string; col2: string }
// const MON_NOUVEAU_LABELS = ["Ligne 1", "Ligne 2"] as const
// const DEFAULT_MON_NOUVEAU_ROWS: MonNouveauTableauRow[] = MON_NOUVEAU_LABELS.map((col1) => ({ col1, col2: "" }))


// ─────────────────────────────────────────────────────────────────────────────
// 6. COMPOSANTS DE TABLEAUX
//    Pattern commun : update(index, field, value) + AmountInput + bouton Save
// ─────────────────────────────────────────────────────────────────────────────

// ── Bouton Save réutilisable ──────────────────────────────────────────────────
function SaveButton({ onSave, isSubmitting }: { onSave: () => void; isSubmitting: boolean }) {
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={onSave} disabled={isSubmitting} className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
        <Save size={13} /> {isSubmitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  )
}

// ── 6a. Réclamation ───────────────────────────────────────────────────────────
interface TabReclamationProps {
  rows: ReclamationRow[]
  setRows: React.Dispatch<React.SetStateAction<ReclamationRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabReclamation({ rows, setRows, onSave, isSubmitting }: TabReclamationProps) {
  const update = (index: number, field: keyof Pick<ReclamationRow, "mGp" | "mB2b" | "m1Gp" | "m1B2b">, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  const recuesRows   = rows.filter((r) => r.category === "recues")
  const traiteesRows = rows.filter((r) => r.category === "traitees")
  const recuesTotals   = { mGp: recuesRows.reduce((s, r) => s + num(r.mGp), 0),   mB2b: recuesRows.reduce((s, r) => s + num(r.mB2b), 0),   m1Gp: recuesRows.reduce((s, r) => s + num(r.m1Gp), 0),   m1B2b: recuesRows.reduce((s, r) => s + num(r.m1B2b), 0) }
  const traiteesTotals = { mGp: traiteesRows.reduce((s, r) => s + num(r.mGp), 0), mB2b: traiteesRows.reduce((s, r) => s + num(r.mB2b), 0), m1Gp: traiteesRows.reduce((s, r) => s + num(r.m1Gp), 0), m1B2b: traiteesRows.reduce((s, r) => s + num(r.m1B2b), 0) }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Reclamations</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Type</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M GP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M B2B</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M+1 GP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M+1 B2B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.category}-${row.type}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {index % 2 === 0 && (
                  <td rowSpan={2} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle">
                    {row.category === "recues" ? "Recues" : "Traitees"}
                  </td>
                )}
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-700">{row.type}</td>
                <td className="px-2 py-1 border-b"><AmountInput value={row.mGp}   onChange={(e) => update(index, "mGp",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-2 py-1 border-b"><AmountInput value={row.mB2b}  onChange={(e) => update(index, "mB2b",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-2 py-1 border-b"><AmountInput value={row.m1Gp}  onChange={(e) => update(index, "m1Gp",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-2 py-1 border-b"><AmountInput value={row.m1B2b} onChange={(e) => update(index, "m1B2b", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-xs text-right border-t">Taux de traitement (%)</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(traiteesTotals.mGp,   recuesTotals.mGp))}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(traiteesTotals.mB2b,  recuesTotals.mB2b))}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(traiteesTotals.m1Gp,  recuesTotals.m1Gp))}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(traiteesTotals.m1B2b, recuesTotals.m1B2b))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6b. Réclamation GP ────────────────────────────────────────────────────────
interface TabReclamationGpProps {
  rows: ReclamationGpRow[]
  setRows: React.Dispatch<React.SetStateAction<ReclamationGpRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabReclamationGp({ rows, setRows, onSave, isSubmitting }: TabReclamationGpProps) {
  const update = (index: number, field: "recues" | "traitees", value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  const totalRecues   = rows.reduce((s, r) => s + num(r.recues),   0)
  const totalTraitees = rows.reduce((s, r) => s + num(r.traitees), 0)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Type de Reclamation GP</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b" colSpan={2}>M</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b">Taux (%)</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b">Part (%)</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b"></th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Recues</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Traitees</th>
              <th className="px-3 py-2 border-b"></th>
              <th className="px-3 py-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const recues = num(row.recues), traitees = num(row.traitees)
              return (
                <tr key={`${row.label}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                  <td className="px-2 py-1 border-b"><AmountInput value={row.recues}   onChange={(e) => update(index, "recues",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-2 py-1 border-b"><AmountInput value={row.traitees} onChange={(e) => update(index, "traitees", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-3 py-2 border-b text-xs text-right font-semibold text-gray-700">{fmt(toPercent(traitees, recues))}</td>
                  <td className="px-3 py-2 border-b text-xs text-right font-semibold text-gray-700">{fmt(toPercent(recues, totalRecues))}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 text-xs text-right border-t">Total</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(totalRecues)}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(totalTraitees)}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(totalTraitees, totalRecues))}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{totalRecues > 0 ? "100,00" : ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6c. E-Payement (bloc réutilisable + wrapper) ──────────────────────────────
interface EPayementBlockProps {
  title: string
  rows: EPayementRow[]
  setRows: React.Dispatch<React.SetStateAction<EPayementRow[]>>
}
function EPayementBlock({ title, rows, setRows }: EPayementBlockProps) {
  const update = (index: number, field: "m" | "m1" | "evol", value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Rechargement</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M+1</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Evol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{EPAYEMENT_CHANNELS[index] ?? row.rechargement}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}    onChange={(e) => update(index, "m",    e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 130 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1}   onChange={(e) => update(index, "m1",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 130 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.evol} onChange={(e) => update(index, "evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 130 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface TabEPayementSingleProps {
  title: string
  rows: EPayementRow[]
  setRows: React.Dispatch<React.SetStateAction<EPayementRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabEPayementSingle({ title, rows, setRows, onSave, isSubmitting }: TabEPayementSingleProps) {
  return (
    <div className="space-y-4">
      <EPayementBlock title={title} rows={rows} setRows={setRows} />
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6d. Total Encaissement ────────────────────────────────────────────────────
interface TabTotalEncaissementProps {
  row: TotalEncaissementRow
  setRow: React.Dispatch<React.SetStateAction<TotalEncaissementRow>>
  onSave: () => void
  isSubmitting: boolean
}
function TabTotalEncaissement({ row, setRow, onSave, isSubmitting }: TabTotalEncaissementProps) {
  const update = (field: keyof TotalEncaissementRow, value: string) =>
    setRow((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={3} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Encaissement (MDA)</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M+1</th>
              <th rowSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Evol</th>
            </tr>
            <tr className="bg-gray-50">
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-medium text-gray-600 border-b border-r">Sous-colonnes</th>
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-medium text-gray-600 border-b border-r">Sous-colonnes</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">B2B</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">B2B</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">Encaissements</td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.mGp}   onChange={(e) => update("mGp",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.mB2b}  onChange={(e) => update("mB2b",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.m1Gp}  onChange={(e) => update("m1Gp",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.m1B2b} onChange={(e) => update("m1B2b", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><Input value={row.evol} onChange={(e) => update("evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="-" /></td>
            </tr>
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 border-b text-xs">Total</td>
              <td className="px-3 py-2 border-b text-xs text-right [direction:rtl]">{fmt(row.mGp   || "0")}</td>
              <td className="px-3 py-2 border-b text-xs text-right [direction:rtl]">{fmt(row.mB2b  || "0")}</td>
              <td className="px-3 py-2 border-b text-xs text-right [direction:rtl]">{fmt(row.m1Gp  || "0")}</td>
              <td className="px-3 py-2 border-b text-xs text-right [direction:rtl]">{fmt(row.m1B2b || "0")}</td>
              <td className="px-3 py-2 border-b text-xs text-center">{row.evol || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── Composant générique pour tableaux (designation | m | m1 | evol) ────────────
//    Réutilisé par : Recouvrement, Désactivation, Parc Abonnés*, Activation,
//    Créances Contentieuses, etc.
interface SimpleDesignationTableProps<T extends { m: string; m1: string }> {
  colHeader: string
  rows: (T & { designation?: string; label?: string; gsp?: string; motif?: string; domaine?: string })[]
  labelKey: string
  fields: Array<{ key: keyof T; header: string; isAmount?: boolean }>
  totalRowIndex?: number
  update: (index: number, field: keyof T, value: string) => void
}
function SimpleDesignationTable<T extends { m: string; m1: string }>({
  colHeader, rows, labelKey, fields, totalRowIndex, update,
}: SimpleDesignationTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">{colHeader}</th>
            {fields.map((f) => (
              <th key={String(f.key)} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{f.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isTotal = totalRowIndex !== undefined ? index === totalRowIndex : index === rows.length - 1
            const label = (row as any)[labelKey] as string
            return (
              <tr key={`${label}-${index}`} className={isTotal ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{label}</td>
                {fields.map((f) => (
                  <td key={String(f.key)} className="px-1 py-1 border-b">
                    <AmountInput
                      value={String(row[f.key] ?? "")}
                      onChange={(e) => update(index, f.key, e.target.value)}
                      className="h-7 px-2 text-xs"
                      placeholder="0.00"
                    />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── 6e. Recouvrement ─────────────────────────────────────────────────────────
interface TabRecouvrementProps { rows: RecouvrementRow[]; setRows: React.Dispatch<React.SetStateAction<RecouvrementRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabRecouvrement({ rows, setRows, onSave, isSubmitting }: TabRecouvrementProps) {
  const update = (index: number, field: keyof Pick<RecouvrementRow, "mGp" | "mB2b" | "m1Gp" | "m1B2b">, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={3} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Recouvrement (MDA)</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
            <tr className="bg-gray-50">
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-medium text-gray-600 border-b border-r">Sous-colonnes</th>
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-medium text-gray-600 border-b">Sous-colonnes</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">B2B</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">B2B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mGp}   onChange={(e) => update(index, "mGp",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mB2b}  onChange={(e) => update(index, "mB2b",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Gp}  onChange={(e) => update(index, "m1Gp",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1B2b} onChange={(e) => update(index, "m1B2b", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6f. Réalisation Technique Réseau ─────────────────────────────────────────
interface TabRealisationTechniqueReseauProps { rows: RealisationTechniqueReseauRow[]; setRows: React.Dispatch<React.SetStateAction<RealisationTechniqueReseauRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabRealisationTechniqueReseau({ rows, setRows, onSave, isSubmitting }: TabRealisationTechniqueReseauProps) {
  const update = (index: number, field: "m" | "m1", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Realisations techniques</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}  onChange={(e) => update(index, "m",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6g. Situation Réseau ──────────────────────────────────────────────────────
interface TabSituationReseauProps { rows: SituationReseauRow[]; setRows: React.Dispatch<React.SetStateAction<SituationReseauRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabSituationReseau({ rows, setRows, onSave, isSubmitting }: TabSituationReseauProps) {
  const update = (index: number, field: "m" | "m1", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Situation Reseaux</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Equipements</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.situation} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.situation}</td>
                <td className="px-3 py-2 border-b text-xs text-gray-700 whitespace-pre-line">{row.equipements}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}  onChange={(e) => update(index, "m",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6h. Trafic Data ───────────────────────────────────────────────────────────
interface TabTraficDataProps { rows: TraficDataRow[]; setRows: React.Dispatch<React.SetStateAction<TraficDataRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabTraficData({ rows, setRows, onSave, isSubmitting }: TabTraficDataProps) {
  const update = (index: number, field: "m" | "m1", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Trafic Data (TB)</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}  onChange={(e) => update(index, "m",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── Composant générique pour tableaux avec lignes dynamiques (wilaya + objectif/réalisé) ──
//    Réutilisé par Amélioration Qualité et Couverture Réseau
interface DynamicWilayaTableProps<T extends { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }> {
  colHeader: string
  rows: T[]
  onAdd: () => void
  onRemove: (i: number) => void
  update: (i: number, field: keyof T, value: string) => void
  onSave: () => void
  isSubmitting: boolean
}
function DynamicWilayaTable<T extends { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }>({
  colHeader, rows, onAdd, onRemove, update, onSave, isSubmitting,
}: DynamicWilayaTableProps<T>) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onAdd} className="gap-1"><Plus size={12} /> Ajouter une ligne</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">{colHeader}</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M+1</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Ecart</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Action</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Realise</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="bg-white">
                <td className="px-1 py-1 border-b"><Input value={row.wilaya} onChange={(e) => update(index, "wilaya" as keyof T, e.target.value)} className="h-7 px-2 text-xs" placeholder="Wilaya" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mObjectif}  onChange={(e) => update(index, "mObjectif"  as keyof T, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise}   onChange={(e) => update(index, "mRealise"   as keyof T, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Objectif} onChange={(e) => update(index, "m1Objectif" as keyof T, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise}  onChange={(e) => update(index, "m1Realise"  as keyof T, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.ecart}      onChange={(e) => update(index, "ecart"      as keyof T, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b text-center">
                  <Button type="button" size="icon" variant="ghost" onClick={() => onRemove(index)} disabled={rows.length <= 1} className="h-7 w-7 text-red-600"><Trash2 size={12} /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6i. Amélioration Qualité ──────────────────────────────────────────────────
interface TabAmeliorationQualiteProps { rows: AmeliorationQualiteRow[]; setRows: React.Dispatch<React.SetStateAction<AmeliorationQualiteRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabAmeliorationQualite({ rows, setRows, onSave, isSubmitting }: TabAmeliorationQualiteProps) {
  const update = (i: number, field: keyof AmeliorationQualiteRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  return <DynamicWilayaTable colHeader="Debit MBPS/Wilaya" rows={rows} onAdd={() => setRows((p) => [...p, { ...EMPTY_AMELIORATION_QUALITE_ROW }])} onRemove={(i) => setRows((p) => p.filter((_, idx) => idx !== i))} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6j. Couverture Réseau ─────────────────────────────────────────────────────
interface TabCouvertureReseauProps { rows: CouvertureReseauRow[]; setRows: React.Dispatch<React.SetStateAction<CouvertureReseauRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabCouvertureReseau({ rows, setRows, onSave, isSubmitting }: TabCouvertureReseauProps) {
  const update = (i: number, field: keyof CouvertureReseauRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  return <DynamicWilayaTable colHeader="Couverture Reseau/Wilaya" rows={rows} onAdd={() => setRows((p) => [...p, { ...EMPTY_COUVERTURE_RESEAU_ROW }])} onRemove={(i) => setRows((p) => p.filter((_, idx) => idx !== i))} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── Composant générique : tableau Objectif / Réalisé / Taux (M + M+1) ─────────
//    Réutilisé par : Action Notable, Disponibilité, Chiffre d'Affaires, Effectifs Formés, Formations
interface OrtTableProps {
  colHeader: string
  rows: Array<Record<string, string>>
  labelKey: string
  onSave: () => void
  isSubmitting: boolean
  update: (index: number, field: string, value: string) => void
}
function OrtTable({ colHeader, rows, labelKey, onSave, isSubmitting, update }: OrtTableProps) {
  const fields = ["mObjectif", "mRealise", "mTaux", "m1Objectif", "m1Realise", "m1Taux"]
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">{colHeader}</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
            <tr className="bg-gray-50">
              {["Objectif", "Realise", "Taux"].map((h, i) => (
                <th key={i} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
              {["Objectif", "Realise", "Taux"].map((h, i) => (
                <th key={i + 3} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row[labelKey]}</td>
                {fields.map((field) => (
                  <td key={field} className="px-1 py-1 border-b">
                    <AmountInput value={row[field] ?? ""} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6k. Action Notable Réseau ─────────────────────────────────────────────────
interface TabActionNotableReseauProps { rows: ActionNotableReseauRow[]; setRows: React.Dispatch<React.SetStateAction<ActionNotableReseauRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabActionNotableReseau({ rows, setRows, onSave, isSubmitting }: TabActionNotableReseauProps) {
  const update = (index: number, field: keyof ActionNotableReseauRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Action</th>
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Objectif 2025</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
            <tr className="bg-gray-50">
              {["Objectif", "Realise", "Taux"].map((h, i) => (
                <th key={i} className={`px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
              {["Objectif", "Realise", "Taux"].map((h, i) => (
                <th key={i + 3} className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.action}</td>
                <td className="px-3 py-2 border-b text-xs text-gray-700">{row.objectif2025}</td>
                {(["mObjectif", "mRealise", "mTaux", "m1Objectif", "m1Realise", "m1Taux"] as const).map((field) => (
                  <td key={field} className="px-1 py-1 border-b">
                    <AmountInput value={row[field]} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6l. Disponibilité Réseau ──────────────────────────────────────────────────
interface TabDisponibiliteReseauProps { rows: DisponibiliteReseauRow[]; setRows: React.Dispatch<React.SetStateAction<DisponibiliteReseauRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabDisponibiliteReseau({ rows, setRows, onSave, isSubmitting }: TabDisponibiliteReseauProps) {
  const update = (index: number, field: keyof DisponibiliteReseauRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Designations" rows={rows as any} labelKey="designation" update={(i, f, v) => update(i, f as keyof DisponibiliteReseauRow, v)} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6m. Désactivation / Résiliation ──────────────────────────────────────────
interface TabDesactivationResiliationProps { rows: DesactivationResiliationRow[]; setRows: React.Dispatch<React.SetStateAction<DesactivationResiliationRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabDesactivationResiliation({ rows, setRows, onSave, isSubmitting }: TabDesactivationResiliationProps) {
  const update = (index: number, field: "m" | "m1" | "evol", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Desactivation / Resiliation</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Evol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.designation} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}    onChange={(e) => update(index, "m",    e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1}   onChange={(e) => update(index, "m1",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.evol} onChange={(e) => update(index, "evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── Composant générique : tableau (designation | m | m1 | evol) ───────────────
//    Réutilisé par : ParcAbonnésB2B, ParcAbonnésGP, TotalParc*, Activation, Créances
interface SimpleEvolTableProps {
  colHeader: string
  rows: Array<{ designation: string; m: string; m1: string; evol: string }>
  update: (index: number, field: "m" | "m1" | "evol", value: string) => void
  onSave: () => void
  isSubmitting: boolean
}
function SimpleEvolTable({ colHeader, rows, update, onSave, isSubmitting }: SimpleEvolTableProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">{colHeader}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Evol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.designation} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}    onChange={(e) => update(index, "m",    e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1}   onChange={(e) => update(index, "m1",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.evol} onChange={(e) => update(index, "evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6n. Parc Abonnés B2B ─────────────────────────────────────────────────────
interface TabParcAbonnesB2BProps { rows: ParcAbonnesB2BRow[]; setRows: React.Dispatch<React.SetStateAction<ParcAbonnesB2BRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabParcAbonnesB2B({ rows, setRows, onSave, isSubmitting }: TabParcAbonnesB2BProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Parc Abonnes B2B" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6o. Parc Abonnés GP ──────────────────────────────────────────────────────
interface TabParcAbonnesGpProps { rows: ParcAbonnesGpRow[]; setRows: React.Dispatch<React.SetStateAction<ParcAbonnesGpRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabParcAbonnesGp({ rows, setRows, onSave, isSubmitting }: TabParcAbonnesGpProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Parc Abonnes GP" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6p. Total Parc Abonnés ────────────────────────────────────────────────────
interface TabTotalParcAbonnesProps { rows: TotalParcAbonnesRow[]; setRows: React.Dispatch<React.SetStateAction<TotalParcAbonnesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabTotalParcAbonnes({ rows, setRows, onSave, isSubmitting }: TabTotalParcAbonnesProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Total Parc Abonnes" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6q. Total Parc Abonnés par Technologie ───────────────────────────────────
interface TabTotalParcAbonnesTechnologieProps { rows: TotalParcAbonnesTechnologieRow[]; setRows: React.Dispatch<React.SetStateAction<TotalParcAbonnesTechnologieRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabTotalParcAbonnesTechnologie({ rows, setRows, onSave, isSubmitting }: TabTotalParcAbonnesTechnologieProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Total Parc Abonnes par Technologie" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6r. Activation ───────────────────────────────────────────────────────────
interface TabActivationProps { rows: ActivationRow[]; setRows: React.Dispatch<React.SetStateAction<ActivationRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabActivation({ rows, setRows, onSave, isSubmitting }: TabActivationProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Activation" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6s. Chiffre d'Affaires MDA ────────────────────────────────────────────────
interface TabChiffreAffairesMdaProps { rows: ChiffreAffairesMdaRow[]; setRows: React.Dispatch<React.SetStateAction<ChiffreAffairesMdaRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabChiffreAffairesMda({ rows, setRows, onSave, isSubmitting }: TabChiffreAffairesMdaProps) {
  const update = (index: number, field: keyof ChiffreAffairesMdaRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Chiffre d'Affaires (MDA)" rows={rows as any} labelKey="designation" update={(i, f, v) => update(i, f as keyof ChiffreAffairesMdaRow, v)} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6t. Créances Contentieuses ────────────────────────────────────────────────
interface TabCreancesContentieusesProps { rows: CreancesContentieusesRow[]; setRows: React.Dispatch<React.SetStateAction<CreancesContentieusesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabCreancesContentieuses({ rows, setRows, onSave, isSubmitting }: TabCreancesContentieusesProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Creances Contentieuses" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6u. Frais Personnel ───────────────────────────────────────────────────────
interface TabFraisPersonnelProps { rows: FraisPersonnelRow[]; setRows: React.Dispatch<React.SetStateAction<FraisPersonnelRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabFraisPersonnel({ rows, setRows, onSave, isSubmitting }: TabFraisPersonnelProps) {
  const update = (index: number, field: "m" | "m1", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Frais personnel (MDA)</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.designation} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}  onChange={(e) => update(index, "m",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── Composant générique : tableau (clé | m | m1 | part%) ─────────────────────
//    Réutilisé par : Effectif GSP, Absentéisme
interface SimplePartTableProps {
  colHeader: string
  rows: Array<{ m: string; m1: string; part: string } & Record<string, string>>
  labelKey: string
  update: (index: number, field: "m" | "m1" | "part", value: string) => void
  onSave: () => void
  isSubmitting: boolean
}
function SimplePartTable({ colHeader, rows, labelKey, update, onSave, isSubmitting }: SimplePartTableProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">{colHeader}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Part %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row[labelKey]}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}    onChange={(e) => update(index, "m",    e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1}   onChange={(e) => update(index, "m1",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.part} onChange={(e) => update(index, "part", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6v. Effectif GSP ──────────────────────────────────────────────────────────
interface TabEffectifGspProps { rows: EffectifGspRow[]; setRows: React.Dispatch<React.SetStateAction<EffectifGspRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabEffectifGsp({ rows, setRows, onSave, isSubmitting }: TabEffectifGspProps) {
  const update = (i: number, f: "m" | "m1" | "part", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimplePartTable colHeader="GSP" rows={rows} labelKey="gsp" update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6w. Absentéisme ───────────────────────────────────────────────────────────
interface TabAbsenteismeProps { rows: AbsenteismeRow[]; setRows: React.Dispatch<React.SetStateAction<AbsenteismeRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabAbsenteisme({ rows, setRows, onSave, isSubmitting }: TabAbsenteismeProps) {
  const update = (i: number, f: "m" | "m1" | "part", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimplePartTable colHeader="Absenteisme (jours)" rows={rows} labelKey="motif" update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6x. Mouvement Effectifs ───────────────────────────────────────────────────
interface TabMouvementEffectifsProps { rows: MouvementEffectifsRow[]; setRows: React.Dispatch<React.SetStateAction<MouvementEffectifsRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabMouvementEffectifs({ rows, setRows, onSave, isSubmitting }: TabMouvementEffectifsProps) {
  type EditableField = keyof Pick<MouvementEffectifsRow, "mCadresSup" | "mCadres" | "mMaitrise" | "mExecution" | "m1CadresSup" | "m1Cadres" | "m1Maitrise" | "m1Execution">
  const update = (index: number, field: EditableField, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Mouvement des effectifs</th>
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Type d'operation</th>
              <th colSpan={4} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={4} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
            <tr className="bg-gray-50">
              {["Cadres Sup", "Cadres", "Maitrise", "Execution"].map((h, i) => (
                <th key={i} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 3 ? " border-r" : ""}`}>{h}</th>
              ))}
              {["Cadres Sup", "Cadres", "Maitrise", "Execution"].map((h, i) => (
                <th key={i + 4} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.bloc}-${row.operation}-${index}`} className={row.operation === "TOTAL" ? "bg-green-100 font-semibold" : "bg-white"}>
                {index === 0  && <td rowSpan={6}  className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-top">Arrives</td>}
                {index === 6  && <td rowSpan={10} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-top">Departs</td>}
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.operation}</td>
                {(["mCadresSup", "mCadres", "mMaitrise", "mExecution", "m1CadresSup", "m1Cadres", "m1Maitrise", "m1Execution"] as EditableField[]).map((field) => (
                  <td key={field} className="px-1 py-1 border-b">
                    <AmountInput value={row[field]} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6y. Mouvement Effectifs par Domaine ───────────────────────────────────────
interface TabMouvementEffectifsDomaineProps { rows: MouvementEffectifsDomaineRow[]; setRows: React.Dispatch<React.SetStateAction<MouvementEffectifsDomaineRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabMouvementEffectifsDomaine({ rows, setRows, onSave, isSubmitting }: TabMouvementEffectifsDomaineProps) {
  type EditableField = keyof Pick<MouvementEffectifsDomaineRow, "mCdi" | "mCdd" | "mCta" | "m1Cdi" | "m1Cdd" | "m1Cta">
  const update = (index: number, field: EditableField, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Mouvement des effectifs par Domaine</th>
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Domaine</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
            <tr className="bg-gray-50">
              {["CDI", "CDD", "CTA"].map((h, i) => (
                <th key={i} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
              {["CDI", "CDD", "CTA"].map((h, i) => (
                <th key={i + 3} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.bloc}-${row.domaine}-${index}`} className={row.domaine === "TOTAL" ? "bg-green-100 font-semibold" : "bg-white"}>
                {index === 0 && <td rowSpan={5} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-top">Recrutement</td>}
                {index === 5 && <td rowSpan={5} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-top">Sortant</td>}
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.domaine}</td>
                {(["mCdi", "mCdd", "mCta", "m1Cdi", "m1Cdd", "m1Cta"] as EditableField[]).map((field) => (
                  <td key={field} className="px-1 py-1 border-b">
                    <AmountInput value={row[field]} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6z. Compte Résultat ───────────────────────────────────────────────────────
interface TabCompteResultatProps { rows: CompteResultatRow[]; setRows: React.Dispatch<React.SetStateAction<CompteResultatRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabCompteResultat({ rows, setRows, onSave, isSubmitting }: TabCompteResultatProps) {
  const update = (index: number, field: keyof CompteResultatRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Designations</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M+1</th>
            </tr>
            <tr className="bg-gray-50">
              {["Budget", "Realise", "Taux"].map((h, i) => (
                <th key={i} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
              {["Budget", "Realise", "Taux"].map((h, i) => (
                <th key={i + 3} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.designation} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                {(["mBudget", "mRealise", "mTaux", "m1Budget", "m1Realise", "m1Taux"] as const).map((field) => (
                  <td key={field} className="px-1 py-1 border-b">
                    <AmountInput value={row[field]} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ── 6aa. Effectifs Formés GSP ─────────────────────────────────────────────────
interface TabEffectifsFormesGspProps { rows: EffectifsFormesGspRow[]; setRows: React.Dispatch<React.SetStateAction<EffectifsFormesGspRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabEffectifsFormesGsp({ rows, setRows, onSave, isSubmitting }: TabEffectifsFormesGspProps) {
  const update = (index: number, field: keyof EffectifsFormesGspRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Effectifs Formes par GSP" rows={rows as any} labelKey="gsp" update={(i, f, v) => update(i, f as keyof EffectifsFormesGspRow, v)} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6ab. Formations par Domaines ──────────────────────────────────────────────
interface TabFormationsDomainesProps { rows: FormationsDomainesRow[]; setRows: React.Dispatch<React.SetStateAction<FormationsDomainesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabFormationsDomaines({ rows, setRows, onSave, isSubmitting }: TabFormationsDomainesProps) {
  const update = (index: number, field: keyof FormationsDomainesRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Domaines" rows={rows as any} labelKey="domaine" update={(i, f, v) => update(i, f as keyof FormationsDomainesRow, v)} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6ac. MTTR ─────────────────────────────────────────────────────────────────
interface TabMttrProps { rows: MttrRegionRow[]; setRows: React.Dispatch<React.SetStateAction<MttrRegionRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabMttr({ rows, setRows, onSave, isSubmitting }: TabMttrProps) {
  const updateCity = (regionIndex: number, cityIndex: number, field: keyof MttrCityRow, value: string) =>
    setRows((prev) => prev.map((region, rIdx) => rIdx !== regionIndex ? region : {
      ...region,
      cities: region.cities.map((city, cIdx) => (cIdx === cityIndex ? { ...city, [field]: value } : city)),
    }))
  const addCity = (regionIndex: number) =>
    setRows((prev) => prev.map((region, rIdx) => rIdx === regionIndex ? { ...region, cities: [...region.cities, { ...EMPTY_MTTR_CITY_ROW }] } : region))
  const removeCity = (regionIndex: number, cityIndex: number) =>
    setRows((prev) => prev.map((region, rIdx) => {
      if (rIdx !== regionIndex || region.cities.length <= 1) return region
      return { ...region, cities: region.cities.filter((_, cIdx) => cIdx !== cityIndex) }
    }))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">MTTR / DR</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M+1</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Ecart</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Action</th>
            </tr>
            <tr className="bg-gray-50">
              {["WILAYA", "Objectif", "Realise"].map((h, i) => (
                <th key={i} className={`px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
              {["WILAYA", "Objectif", "Realise"].map((h, i) => (
                <th key={i + 3} className={`px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((region, regionIndex) =>
              region.cities.map((city, cityIndex) => (
                <tr key={`mttr-${regionIndex}-${cityIndex}`} className="bg-white">
                  {cityIndex === 0 && (
                    <td rowSpan={region.cities.length} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-top">
                      <div className="flex items-center justify-between gap-2">
                        <span>{region.region}</span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => addCity(regionIndex)} className="h-6 w-6 text-green-700"><Plus size={11} /></Button>
                      </div>
                    </td>
                  )}
                  <td className="px-1 py-1 border-b"><Input value={city.wilayaM}  onChange={(e) => updateCity(regionIndex, cityIndex, "wilayaM",  e.target.value)} className="h-7 px-2 text-xs" placeholder="Wilaya" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.objectifM} onChange={(e) => updateCity(regionIndex, cityIndex, "objectifM", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.realiseM}  onChange={(e) => updateCity(regionIndex, cityIndex, "realiseM",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b"><Input value={city.wilayaM1} onChange={(e) => updateCity(regionIndex, cityIndex, "wilayaM1", e.target.value)} className="h-7 px-2 text-xs" placeholder="Wilaya" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.objectifM1} onChange={(e) => updateCity(regionIndex, cityIndex, "objectifM1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.realiseM1}  onChange={(e) => updateCity(regionIndex, cityIndex, "realiseM1",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.ecart}      onChange={(e) => updateCity(regionIndex, cityIndex, "ecart",      e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b text-center">
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeCity(regionIndex, cityIndex)} disabled={region.cities.length <= 1} className="h-7 w-7 text-red-600"><Trash2 size={12} /></Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. CONFIGURATION DES ONGLETS
//    Pour ajouter un onglet : ajoutez une entrée ici ET dans tableauTabKey
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "reclamation",                    label: "Reclamation",                           color: PRIMARY_COLOR, title: "TABLEAU RECLAMATION" },
  { key: "reclamation_gp",                 label: "Reclamation GP",                        color: PRIMARY_COLOR, title: "TABLEAU RECLAMATION GP" },
  { key: "e_payement_pop",                 label: "E-PAYEMENT Pop",                        color: PRIMARY_COLOR, title: "E-PAYEMENT POP (MDA)" },
  { key: "e_payement_prp",                 label: "E-PAYEMENT Prp",                        color: PRIMARY_COLOR, title: "E-PAYEMENT PRP (MDA)" },
  { key: "total_encaissement",             label: "Totale des encaissment",                color: PRIMARY_COLOR, title: "TOTALE DES ENCAISSMENT" },
  { key: "recouvrement",                   label: "Recouvrement",                          color: PRIMARY_COLOR, title: "RECOUVREMENT (MDA)" },
  { key: "realisation_technique_reseau",   label: "Realisation technique Reseau",          color: PRIMARY_COLOR, title: "REALISATION TECHNIQUE RESEAU" },
  { key: "situation_reseau",               label: "Situation Reseau",                      color: PRIMARY_COLOR, title: "SITUATION RESEAUX" },
  { key: "trafic_data",                    label: "Trafic Data",                           color: PRIMARY_COLOR, title: "TRAFIC DATA (TB)" },
  { key: "amelioration_qualite",           label: "Amelioration qualite",                  color: PRIMARY_COLOR, title: "AMELIORATION QUALITE" },
  { key: "couverture_reseau",              label: "Couverture Reseau",                     color: PRIMARY_COLOR, title: "COUVERTURE RESEAU" },
  { key: "action_notable_reseau",          label: "Action notable sur le reseau",          color: PRIMARY_COLOR, title: "ACTION NOTABLE SUR LE RESEAU" },
  { key: "disponibilite_reseau",           label: "Disponibilite reseau",                  color: PRIMARY_COLOR, title: "DISPONIBILITE RESEAU" },
  { key: "desactivation_resiliation",      label: "Desactivation / Resiliation",           color: PRIMARY_COLOR, title: "DESACTIVATION / RESILIATION" },
  { key: "parc_abonnes_b2b",               label: "Parc Abonnes B2B",                      color: PRIMARY_COLOR, title: "PARC ABONNES B2B" },
  { key: "mttr",                           label: "MTTR",                                  color: PRIMARY_COLOR, title: "MTTR / DR" },
  { key: "creances_contentieuses",         label: "Creances Contentieuses",                color: PRIMARY_COLOR, title: "CREANCES CONTENTIEUSES" },
  { key: "frais_personnel",                label: "Frais personnel",                       color: PRIMARY_COLOR, title: "FRAIS PERSONNEL (MDA)" },
  { key: "effectif_gsp",                   label: "Effectif par GSP",                      color: PRIMARY_COLOR, title: "EFFECTIF PAR GSP" },
  { key: "absenteisme",                    label: "Absenteisme",                           color: PRIMARY_COLOR, title: "ABSENTEISME (JOURS)" },
  { key: "mouvement_effectifs",            label: "Mouvement des effectifs",               color: PRIMARY_COLOR, title: "MOUVEMENT DES EFFECTIFS" },
  { key: "mouvement_effectifs_domaine",    label: "Mouvement des effectifs par domaine",   color: PRIMARY_COLOR, title: "MOUVEMENT DES EFFECTIFS PAR DOMAINE" },
  { key: "compte_resultat",                label: "Compte de resultat",                    color: PRIMARY_COLOR, title: "COMPTE DE RESULTAT" },
  { key: "effectifs_formes_gsp",           label: "Effectifs formes par GSP",              color: PRIMARY_COLOR, title: "EFFECTIFS FORMES PAR GSP" },
  { key: "formations_domaines",            label: "Formations realisees par domaines",     color: PRIMARY_COLOR, title: "FORMATIONS REALISEES PAR DOMAINES" },
  { key: "parc_abonnes_gp",               label: "Parc Abonnes GP",                       color: PRIMARY_COLOR, title: "PARC ABONNES GP" },
  { key: "total_parc_abonnes",             label: "Total Parc Abonnes",                    color: PRIMARY_COLOR, title: "TOTAL PARC ABONNES" },
  { key: "total_parc_abonnes_technologie", label: "Total Parc Abonnes par technologie",    color: PRIMARY_COLOR, title: "TOTAL PARC ABONNES PAR TECHNOLOGIE" },
  { key: "activation",                     label: "Activation",                            color: PRIMARY_COLOR, title: "ACTIVATION" },
  { key: "chiffre_affaires_mda",           label: "Chiffre d'Affaires (MDA)",              color: PRIMARY_COLOR, title: "CHIFFRE D'AFFAIRES (MDA)" },
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey =
  | "reclamation" | "reclamation_gp" | "e_payement_pop" | "e_payement_prp"
  | "total_encaissement" | "recouvrement" | "realisation_technique_reseau"
  | "situation_reseau" | "trafic_data" | "amelioration_qualite" | "couverture_reseau"
  | "action_notable_reseau" | "disponibilite_reseau" | "desactivation_resiliation"
  | "parc_abonnes_b2b" | "mttr" | "creances_contentieuses" | "frais_personnel"
  | "effectif_gsp" | "absenteisme" | "mouvement_effectifs" | "mouvement_effectifs_domaine"
  | "compte_resultat" | "effectifs_formes_gsp" | "formations_domaines"
  | "parc_abonnes_gp" | "total_parc_abonnes" | "total_parc_abonnes_technologie"
  | "activation" | "chiffre_affaires_mda"

type tableauCategoryKey =
  | "all" | "reclamation" | "e_payment" | "encaissement" | "recouvrement"
  | "reseau_technique" | "qualite_reseau" | "creances_contentieuses" | "rh"
  | "formation" | "cr" | "parc_abonnes" | "activation_desactivation_sim" | "chiffre_affaires"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all",           label: "Toutes les categories",          tabKeys: [] },
  { key: "reclamation",   label: "Reclamation",                    tabKeys: ["reclamation", "reclamation_gp"] },
  { key: "e_payment",     label: "E-payment",                      tabKeys: ["e_payement_pop", "e_payement_prp"] },
  { key: "encaissement",  label: "Encaissement",                   tabKeys: ["total_encaissement"] },
  { key: "recouvrement",  label: "Recouvrement",                   tabKeys: ["recouvrement"] },
  { key: "reseau_technique", label: "Reseau technique",            tabKeys: ["realisation_technique_reseau", "situation_reseau", "trafic_data", "amelioration_qualite", "couverture_reseau", "action_notable_reseau"] },
  { key: "qualite_reseau",   label: "Qualite reseau",              tabKeys: ["disponibilite_reseau", "mttr"] },
  { key: "creances_contentieuses", label: "Creances contentieuses", tabKeys: ["creances_contentieuses"] },
  { key: "rh",            label: "RH",                             tabKeys: ["frais_personnel", "effectif_gsp", "absenteisme", "mouvement_effectifs", "mouvement_effectifs_domaine"] },
  { key: "formation",     label: "Formation",                      tabKeys: ["effectifs_formes_gsp", "formations_domaines"] },
  { key: "cr",            label: "CR",                             tabKeys: ["compte_resultat"] },
  { key: "parc_abonnes",  label: "Parc abonne",                    tabKeys: ["parc_abonnes_b2b", "parc_abonnes_gp", "total_parc_abonnes", "total_parc_abonnes_technologie"] },
  { key: "activation_desactivation_sim", label: "Activation / Desactivation SIM", tabKeys: ["desactivation_resiliation", "activation"] },
  { key: "chiffre_affaires", label: "Chiffre d'affaires",          tabKeys: ["chiffre_affaires_mda"] },
]

const findtableauCategoryKeyForTab = (tabKey: string): tableauCategoryKey =>
  tableau_CATEGORY_OPTIONS.find((c) => c.key !== "all" && c.tabKeys.includes(tabKey as tableauTabKey))?.key ?? "all"

const istableauTabKey = (value: string): value is tableauTabKey =>
  TABS.some((tab) => tab.key === value)

const MONTHS = [
  { value: "01", label: "Janvier" },  { value: "02", label: "Fevrier" },
  { value: "03", label: "Mars" },     { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },      { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },  { value: "08", label: "Aout" },
  { value: "09", label: "Septembre" },{ value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" }, { value: "12", label: "Decembre" },
]
const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_tableau_PERIOD = getCurrenttableauPeriod()
const YEARS = Array.from({ length: 101 }, (_, i) => (2000 + i).toString())


// ─────────────────────────────────────────────────────────────────────────────
// 8. TYPES & HELPERS D'API / STOCKAGE
// ─────────────────────────────────────────────────────────────────────────────

// ── 8a. Type de la déclaration sauvegardée (localStorage + API) ──────────────
//    Ajoutez un champ *Rows pour chaque nouveau tableau
interface Savedtableau {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  reclamationRows?: ReclamationRow[]
  reclamationGpRows?: ReclamationGpRow[]
  ePayementPopRows?: EPayementRow[]
  ePayementPrpRows?: EPayementRow[]
  totalEncaissementRows?: TotalEncaissementRow[]
  recouvrementRows?: RecouvrementRow[]
  realisationTechniqueReseauRows?: RealisationTechniqueReseauRow[]
  situationReseauRows?: SituationReseauRow[]
  traficDataRows?: TraficDataRow[]
  ameliorationQualiteRows?: AmeliorationQualiteRow[]
  couvertureReseauRows?: CouvertureReseauRow[]
  actionNotableReseauRows?: ActionNotableReseauRow[]
  disponibiliteReseauRows?: DisponibiliteReseauRow[]
  desactivationResiliationRows?: DesactivationResiliationRow[]
  parcAbonnesB2bRows?: ParcAbonnesB2BRow[]
  mttrRows?: MttrRegionRow[]
  creancesContentieusesRows?: CreancesContentieusesRow[]
  fraisPersonnelRows?: FraisPersonnelRow[]
  effectifGspRows?: EffectifGspRow[]
  absenteismeRows?: AbsenteismeRow[]
  mouvementEffectifsRows?: MouvementEffectifsRow[]
  mouvementEffectifsDomaineRows?: MouvementEffectifsDomaineRow[]
  compteResultatRows?: CompteResultatRow[]
  effectifsFormesGspRows?: EffectifsFormesGspRow[]
  formationsDomainesRows?: FormationsDomainesRow[]
  parcAbonnesGpRows?: ParcAbonnesGpRow[]
  totalParcAbonnesRows?: TotalParcAbonnesRow[]
  totalParcAbonnesTechnologieRows?: TotalParcAbonnesTechnologieRow[]
  activationRows?: ActivationRow[]
  chiffreAffairesMdaRows?: ChiffreAffairesMdaRow[]
  // monNouveauTableauRows?: MonNouveauTableauRow[]  // ← nouveau tableau
}

// ── 8b. Type retourné par l'API (générique, ne change pas) ───────────────────
type Apitableautableau = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

// ── 8c. Helpers utilitaires ───────────────────────────────────────────────────
const safeString = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

const normalizeMonthValue = (value: string) =>
  MONTHS.some((m) => m.value === value) ? value : String(new Date().getMonth() + 1).padStart(2, "0")

const normalizeYearValue = (value: string) =>
  YEARS.includes(value) ? value : String(CURRENT_YEAR)

// ── 8d. Fonctions de normalisation par tableau ────────────────────────────────
//    Une fonction par tableau : remet des chaînes vides sur les champs manquants
//    et garantit le bon nombre de lignes.

const normalizeReclamationRows = (rows?: ReclamationRow[]): ReclamationRow[] => {
  const normalizeCategory = (v: unknown): ReclamationRow["category"] => safeString(v).toLowerCase() === "traitees" ? "traitees" : "recues"
  const normalizeType = (v: unknown): ReclamationRow["type"] => safeString(v).toUpperCase() === "B2B" ? "B2B" : "GP"
  const normalized = (rows ?? []).map((row) => ({
    category: normalizeCategory(row.category),
    type: normalizeType(row.type),
    mGp: safeString(row.mGp), mB2b: safeString(row.mB2b),
    m1Gp: safeString(row.m1Gp), m1B2b: safeString(row.m1B2b),
  }))
  return normalized.length === 4 ? normalized : DEFAULT_RECLAMATION_ROWS.map((r) => ({ ...r }))
}

const normalizeReclamationGpRows = (rows?: ReclamationGpRow[]): ReclamationGpRow[] => {
  const normalized = (rows ?? []).map((row, i) => ({ label: safeString(row.label) || RECLAMATION_GP_LABELS[i] || `Ligne ${i + 1}`, recues: safeString(row.recues), traitees: safeString(row.traitees) }))
  return normalized.length === RECLAMATION_GP_LABELS.length ? normalized : DEFAULT_RECLAMATION_GP_ROWS.map((r) => ({ ...r }))
}

const normalizeEPayementRows = (rows?: EPayementRow[]): EPayementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return EPAYEMENT_CHANNELS.map((rechargement, i) => ({ rechargement, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeTotalEncaissementRow = (row?: TotalEncaissementRow): TotalEncaissementRow => ({
  mGp: safeString(row?.mGp), mB2b: safeString(row?.mB2b),
  m1Gp: safeString(row?.m1Gp), m1B2b: safeString(row?.m1B2b),
  evol: safeString(row?.evol) || "-",
})

const normalizeTotalEncaissementRows = (rows?: TotalEncaissementRow[]): TotalEncaissementRow[] => {
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined
  return [normalizeTotalEncaissementRow(firstRow)]
}

const normalizeRecouvrementRows = (rows?: RecouvrementRow[]): RecouvrementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return RECOUVREMENT_LABELS.map((label, i) => ({ label, mGp: safeString(src[i]?.mGp), mB2b: safeString(src[i]?.mB2b), m1Gp: safeString(src[i]?.m1Gp), m1B2b: safeString(src[i]?.m1B2b) }))
}

const normalizeRealisationTechniqueReseauRows = (rows?: RealisationTechniqueReseauRow[]): RealisationTechniqueReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return REALISATION_TECHNIQUE_RESEAU_LABELS.map((label, i) => ({ label, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1) }))
}

const normalizeSituationReseauRows = (rows?: SituationReseauRow[]): SituationReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DEFAULT_SITUATION_RESEAU_ROWS.map((def, i) => ({ situation: def.situation, equipements: def.equipements, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1) }))
}

const normalizeTraficDataRows = (rows?: TraficDataRow[]): TraficDataRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return TRAFIC_DATA_LABELS.map((label, i) => ({ label, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1) }))
}

const normalizeAmeliorationQualiteRows = (rows?: AmeliorationQualiteRow[]): AmeliorationQualiteRow[] => {
  const src = Array.isArray(rows) ? rows : []
  if (src.length === 0) return [{ ...EMPTY_AMELIORATION_QUALITE_ROW }]
  return src.map((r) => ({ wilaya: safeString(r.wilaya), mObjectif: safeString(r.mObjectif), mRealise: safeString(r.mRealise), m1Objectif: safeString(r.m1Objectif), m1Realise: safeString(r.m1Realise), ecart: safeString(r.ecart) }))
}

const normalizeCouvertureReseauRows = (rows?: CouvertureReseauRow[]): CouvertureReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  if (src.length === 0) return [{ ...EMPTY_COUVERTURE_RESEAU_ROW }]
  return src.map((r) => ({ wilaya: safeString(r.wilaya), mObjectif: safeString(r.mObjectif), mRealise: safeString(r.mRealise), m1Objectif: safeString(r.m1Objectif), m1Realise: safeString(r.m1Realise), ecart: safeString(r.ecart) }))
}

const normalizeActionNotableReseauRows = (rows?: ActionNotableReseauRow[]): ActionNotableReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DEFAULT_ACTION_NOTABLE_RESEAU_ROWS.map((def, i) => ({ ...def, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeDisponibiliteReseauRows = (rows?: DisponibiliteReseauRow[]): DisponibiliteReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DEFAULT_DISPONIBILITE_RESEAU_ROWS.map((def, i) => ({ designation: def.designation, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeDesactivationResiliationRows = (rows?: DesactivationResiliationRow[]): DesactivationResiliationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DESACTIVATION_RESILIATION_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeParcAbonnesB2BRows = (rows?: ParcAbonnesB2BRow[]): ParcAbonnesB2BRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return PARC_ABONNES_B2B_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeCreancesContentieusesRows = (rows?: CreancesContentieusesRow[]): CreancesContentieusesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return CREANCES_CONTENTIEUSES_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeFraisPersonnelRows = (rows?: FraisPersonnelRow[]): FraisPersonnelRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return FRAIS_PERSONNEL_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1) }))
}

const normalizeEffectifGspRows = (rows?: EffectifGspRow[]): EffectifGspRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return EFFECTIF_GSP_LABELS.map((gsp, i) => ({ gsp, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), part: safeString(src[i]?.part) }))
}

const normalizeAbsenteismeRows = (rows?: AbsenteismeRow[]): AbsenteismeRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return ABSENTEISME_LABELS.map((motif, i) => ({ motif, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), part: safeString(src[i]?.part) }))
}

const normalizeMouvementEffectifsRows = (rows?: MouvementEffectifsRow[]): MouvementEffectifsRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return MOUVEMENT_EFFECTIFS_TEMPLATE.map((item, i) => ({ ...item, mCadresSup: safeString(src[i]?.mCadresSup), mCadres: safeString(src[i]?.mCadres), mMaitrise: safeString(src[i]?.mMaitrise), mExecution: safeString(src[i]?.mExecution), m1CadresSup: safeString(src[i]?.m1CadresSup), m1Cadres: safeString(src[i]?.m1Cadres), m1Maitrise: safeString(src[i]?.m1Maitrise), m1Execution: safeString(src[i]?.m1Execution) }))
}

const normalizeMouvementEffectifsDomaineRows = (rows?: MouvementEffectifsDomaineRow[]): MouvementEffectifsDomaineRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return MOUVEMENT_EFFECTIFS_DOMAINE_TEMPLATE.map((item, i) => ({ ...item, mCdi: safeString(src[i]?.mCdi), mCdd: safeString(src[i]?.mCdd), mCta: safeString(src[i]?.mCta), m1Cdi: safeString(src[i]?.m1Cdi), m1Cdd: safeString(src[i]?.m1Cdd), m1Cta: safeString(src[i]?.m1Cta) }))
}

const normalizeCompteResultatRows = (rows?: CompteResultatRow[]): CompteResultatRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return COMPTE_RESULTAT_LABELS.map((designation, i) => ({ designation, mBudget: safeString(src[i]?.mBudget), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Budget: safeString(src[i]?.m1Budget), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeEffectifsFormesGspRows = (rows?: EffectifsFormesGspRow[]): EffectifsFormesGspRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return EFFECTIFS_FORMES_GSP_LABELS.map((gsp, i) => ({ gsp, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeFormationsDomainesRows = (rows?: FormationsDomainesRow[]): FormationsDomainesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return FORMATIONS_DOMAINES_LABELS.map((domaine, i) => ({ domaine, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeParcAbonnesGpRows = (rows?: ParcAbonnesGpRow[]): ParcAbonnesGpRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return PARC_ABONNES_GP_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeTotalParcAbonnesRows = (rows?: TotalParcAbonnesRow[]): TotalParcAbonnesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return TOTAL_PARC_ABONNES_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeTotalParcAbonnesTechnologieRows = (rows?: TotalParcAbonnesTechnologieRow[]): TotalParcAbonnesTechnologieRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeActivationRows = (rows?: ActivationRow[]): ActivationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return ACTIVATION_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeChiffreAffairesMdaRows = (rows?: ChiffreAffairesMdaRow[]): ChiffreAffairesMdaRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return CHIFFRE_AFFAIRES_MDA_LABELS.map((designation, i) => ({ designation, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeMttrRows = (rows?: MttrRegionRow[]): MttrRegionRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return MTTR_REGIONS.map((regionName, i) => {
    const sourceCities = Array.isArray(src[i]?.cities) ? src[i].cities : []
    return {
      region: regionName,
      cities: sourceCities.length > 0
        ? sourceCities.map((city) => ({ wilayaM: safeString(city.wilayaM), objectifM: safeString(city.objectifM), realiseM: safeString(city.realiseM), wilayaM1: safeString(city.wilayaM1), objectifM1: safeString(city.objectifM1), realiseM1: safeString(city.realiseM1), ecart: safeString(city.ecart) }))
        : [{ ...EMPTY_MTTR_CITY_ROW }],
    }
  })
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.reclamationRows?.length ?? 0) > 0) return "reclamation"
  if ((decl.reclamationGpRows?.length ?? 0) > 0) return "reclamation_gp"
  if ((decl.ePayementPopRows?.length ?? 0) > 0) return "e_payement_pop"
  if ((decl.ePayementPrpRows?.length ?? 0) > 0) return "e_payement_prp"
  if ((decl.totalEncaissementRows?.length ?? 0) > 0) return "total_encaissement"
  if ((decl.recouvrementRows?.length ?? 0) > 0) return "recouvrement"
  if ((decl.realisationTechniqueReseauRows?.length ?? 0) > 0) return "realisation_technique_reseau"
  if ((decl.situationReseauRows?.length ?? 0) > 0) return "situation_reseau"
  if ((decl.traficDataRows?.length ?? 0) > 0) return "trafic_data"
  if ((decl.ameliorationQualiteRows?.length ?? 0) > 0) return "amelioration_qualite"
  if ((decl.couvertureReseauRows?.length ?? 0) > 0) return "couverture_reseau"
  if ((decl.actionNotableReseauRows?.length ?? 0) > 0) return "action_notable_reseau"
  if ((decl.disponibiliteReseauRows?.length ?? 0) > 0) return "disponibilite_reseau"
  if ((decl.desactivationResiliationRows?.length ?? 0) > 0) return "desactivation_resiliation"
  if ((decl.parcAbonnesB2bRows?.length ?? 0) > 0) return "parc_abonnes_b2b"
  if ((decl.mttrRows?.length ?? 0) > 0) return "mttr"
  if ((decl.creancesContentieusesRows?.length ?? 0) > 0) return "creances_contentieuses"
  if ((decl.fraisPersonnelRows?.length ?? 0) > 0) return "frais_personnel"
  if ((decl.effectifGspRows?.length ?? 0) > 0) return "effectif_gsp"
  if ((decl.absenteismeRows?.length ?? 0) > 0) return "absenteisme"
  if ((decl.mouvementEffectifsRows?.length ?? 0) > 0) return "mouvement_effectifs"
  if ((decl.mouvementEffectifsDomaineRows?.length ?? 0) > 0) return "mouvement_effectifs_domaine"
  if ((decl.compteResultatRows?.length ?? 0) > 0) return "compte_resultat"
  if ((decl.effectifsFormesGspRows?.length ?? 0) > 0) return "effectifs_formes_gsp"
  if ((decl.formationsDomainesRows?.length ?? 0) > 0) return "formations_domaines"
  if ((decl.parcAbonnesGpRows?.length ?? 0) > 0) return "parc_abonnes_gp"
  if ((decl.totalParcAbonnesRows?.length ?? 0) > 0) return "total_parc_abonnes"
  if ((decl.totalParcAbonnesTechnologieRows?.length ?? 0) > 0) return "total_parc_abonnes_technologie"
  if ((decl.activationRows?.length ?? 0) > 0) return "activation"
  if ((decl.chiffreAffairesMdaRows?.length ?? 0) > 0) return "chiffre_affaires_mda"
  return "reclamation"
}

// ── (MODÈLE) normalize pour un nouveau tableau ────────────────────────────────
// const normalizeMonNouveauTableauRows = (rows?: MonNouveauTableauRow[]): MonNouveauTableauRow[] => {
//   const src = Array.isArray(rows) ? rows : []
//   return MON_NOUVEAU_LABELS.map((col1, i) => ({ col1, col2: safeString(src[i]?.col2) }))
// }



// 
// PAGE
export default function NouvelleDeclarationPage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [editQuery, setEditQuery] = useState<{ editId: string; tab: string }>({ editId: "", tab: "" })

  // Regions (fetched from API)
  const [regions, setRegions] = useState<{ id: number; name: string }[]>([])
  useEffect(() => {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
    fetch(`${API_BASE}/api/regions`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data: { id: number; name: string }[]) => setRegions(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)

    const requestedMois = safeString(params.get("mois")).trim()
    if (requestedMois) {
      setMois(normalizeMonthValue(requestedMois))
    }

    const requestedAnnee = safeString(params.get("annee")).trim()
    if (requestedAnnee) {
      setAnnee(normalizeYearValue(requestedAnnee))
    }

    setEditQuery({
      editId: safeString(params.get("editId")).trim(),
      tab: safeString(params.get("tab")).trim(),
    })
  }, [])

  // Global meta
  const [activeTab, setActiveTab] = useState("reclamation")
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<tableauCategoryKey>("all")
  const [direction, setDirection] = useState("")
  const [mois, setMois] = useState(INITIAL_tableau_PERIOD.mois)
  const [annee, setAnnee] = useState(INITIAL_tableau_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [tableauPolicyRevision, settableauPolicyRevision] = useState(0)

  // Tab data (lifted) - TABLEAUX CONSERVES (30)
  const [reclamationRows, setReclamationRows] = useState<ReclamationRow[]>(DEFAULT_RECLAMATION_ROWS.map((row) => ({ ...row })))
  const [reclamationGpRows, setReclamationGpRows] = useState<ReclamationGpRow[]>(DEFAULT_RECLAMATION_GP_ROWS.map((row) => ({ ...row })))
  const [ePayementPopRows, setEPayementPopRows] = useState<EPayementRow[]>(createDefaultEPayementRows())
  const [ePayementPrpRows, setEPayementPrpRows] = useState<EPayementRow[]>(createDefaultEPayementRows())
  const [totalEncaissementRows, setTotalEncaissementRows] = useState<TotalEncaissementRow[]>([{ ...EMPTY_TOTAL_ENCAISSEMENT_ROW }])
  const [recouvrementRows, setRecouvrementRows] = useState<RecouvrementRow[]>(DEFAULT_RECOUVREMENT_ROWS.map((row) => ({ ...row })))
  const [realisationTechniqueReseauRows, setRealisationTechniqueReseauRows] = useState<RealisationTechniqueReseauRow[]>(DEFAULT_REALISATION_TECHNIQUE_RESEAU_ROWS.map((row) => ({ ...row })))
  const [situationReseauRows, setSituationReseauRows] = useState<SituationReseauRow[]>(DEFAULT_SITUATION_RESEAU_ROWS.map((row) => ({ ...row })))
  const [traficDataRows, setTraficDataRows] = useState<TraficDataRow[]>(DEFAULT_TRAFIC_DATA_ROWS.map((row) => ({ ...row })))
  const [ameliorationQualiteRows, setAmeliorationQualiteRows] = useState<AmeliorationQualiteRow[]>([{ ...EMPTY_AMELIORATION_QUALITE_ROW }])
  const [couvertureReseauRows, setCouvertureReseauRows] = useState<CouvertureReseauRow[]>([{ ...EMPTY_COUVERTURE_RESEAU_ROW }])
  const [actionNotableReseauRows, setActionNotableReseauRows] = useState<ActionNotableReseauRow[]>(DEFAULT_ACTION_NOTABLE_RESEAU_ROWS.map((row) => ({ ...row })))
  const [disponibiliteReseauRows, setDisponibiliteReseauRows] = useState<DisponibiliteReseauRow[]>(DEFAULT_DISPONIBILITE_RESEAU_ROWS.map((row) => ({ ...row })))
  const [desactivationResiliationRows, setDesactivationResiliationRows] = useState<DesactivationResiliationRow[]>(DEFAULT_DESACTIVATION_RESILIATION_ROWS.map((row) => ({ ...row })))
  const [parcAbonnesB2bRows, setParcAbonnesB2bRows] = useState<ParcAbonnesB2BRow[]>(DEFAULT_PARC_ABONNES_B2B_ROWS.map((row) => ({ ...row })))
  const [mttrRows, setMttrRows] = useState<MttrRegionRow[]>(DEFAULT_MTTR_ROWS.map((row) => ({ ...row, cities: row.cities.map((city) => ({ ...city })) })))
  const [creancesContentieusesRows, setCreancesContentieusesRows] = useState<CreancesContentieusesRow[]>(DEFAULT_CREANCES_CONTENTIEUSES_ROWS.map((row) => ({ ...row })))
  const [fraisPersonnelRows, setFraisPersonnelRows] = useState<FraisPersonnelRow[]>(DEFAULT_FRAIS_PERSONNEL_ROWS.map((row) => ({ ...row })))
  const [effectifGspRows, setEffectifGspRows] = useState<EffectifGspRow[]>(DEFAULT_EFFECTIF_GSP_ROWS.map((row) => ({ ...row })))
  const [absenteismeRows, setAbsenteismeRows] = useState<AbsenteismeRow[]>(DEFAULT_ABSENTEISME_ROWS.map((row) => ({ ...row })))
  const [mouvementEffectifsRows, setMouvementEffectifsRows] = useState<MouvementEffectifsRow[]>(DEFAULT_MOUVEMENT_EFFECTIFS_ROWS.map((row) => ({ ...row })))
  const [mouvementEffectifsDomaineRows, setMouvementEffectifsDomaineRows] = useState<MouvementEffectifsDomaineRow[]>(DEFAULT_MOUVEMENT_EFFECTIFS_DOMAINE_ROWS.map((row) => ({ ...row })))
  const [compteResultatRows, setCompteResultatRows] = useState<CompteResultatRow[]>(DEFAULT_COMPTE_RESULTAT_ROWS.map((row) => ({ ...row })))
  const [effectifsFormesGspRows, setEffectifsFormesGspRows] = useState<EffectifsFormesGspRow[]>(DEFAULT_EFFECTIFS_FORMES_GSP_ROWS.map((row) => ({ ...row })))
  const [formationsDomainesRows, setFormationsDomainesRows] = useState<FormationsDomainesRow[]>(DEFAULT_FORMATIONS_DOMAINES_ROWS.map((row) => ({ ...row })))
  const [parcAbonnesGpRows, setParcAbonnesGpRows] = useState<ParcAbonnesGpRow[]>(DEFAULT_PARC_ABONNES_GP_ROWS.map((row) => ({ ...row })))
  const [totalParcAbonnesRows, setTotalParcAbonnesRows] = useState<TotalParcAbonnesRow[]>(DEFAULT_TOTAL_PARC_ABONNES_ROWS.map((row) => ({ ...row })))
  const [totalParcAbonnesTechnologieRows, setTotalParcAbonnesTechnologieRows] = useState<TotalParcAbonnesTechnologieRow[]>(DEFAULT_TOTAL_PARC_ABONNES_TECHNOLOGIE_ROWS.map((row) => ({ ...row })))
  const [activationRows, setActivationRows] = useState<ActivationRow[]>(DEFAULT_ACTIVATION_ROWS.map((row) => ({ ...row })))
  const [chiffreAffairesMdaRows, setChiffreAffairesMdaRows] = useState<ChiffreAffairesMdaRow[]>(DEFAULT_CHIFFRE_AFFAIRES_MDA_ROWS.map((row) => ({ ...row })))
  const [tableauDeclarations, settableauDeclarations] = useState<Apitableautableau[]>([])

  const userRole = user?.role ?? ""
  const isAdminRole = isAdmintableauRole(userRole)
  const isRegionalRole = isRegionaltableauRole(userRole)
  const isFinanceRole = isFinancetableauRole(userRole)
  const adminSelectedDirection = safeString(direction).trim()
  
  const manageableTabKeys = useMemo(
    () => new Set(getManageabletableauTabKeysForDirection(userRole, isAdminRole ? adminSelectedDirection : undefined)),
    [adminSelectedDirection, tableauPolicyRevision, isAdminRole, userRole],
  )
  
  const availableTabs = useMemo(
    () => TABS.filter((tab) => manageableTabKeys.has(tab.key) || CUSTOM_tableau_TAB_KEYS.has(tab.key)),
    [manageableTabKeys],
  )
  
  const disabledTabKeys = useMemo(
    () => new Set(availableTabs.filter((tab) => istableauTabDisabledByPolicy(tab.key)).map((tab) => tab.key)),
    [availableTabs, tableauPolicyRevision],
  )
  
  const selectableTabs = useMemo(
    () => availableTabs.map((tab) => ({ ...tab, isDisabled: disabledTabKeys.has(tab.key) })),
    [availableTabs, disabledTabKeys],
  )
  
  const declarationTabs = useMemo(
    () => selectableTabs.filter((tab) => CUSTOM_tableau_TAB_KEYS.has(tab.key)),
    [selectableTabs],
  )
  
  const declarationCategoryOptions = useMemo(() => {
    const availableKeys = new Set(declarationTabs.map((tab) => tab.key))
    return tableau_CATEGORY_OPTIONS.filter(
      (category) => category.key === "all" || category.tabKeys.some((tabKey) => availableKeys.has(tabKey)),
    )
  }, [declarationTabs])
  
  const filteredDeclarationTabs = useMemo(() => {
    if (selectedCategoryKey === "all") return declarationTabs
    const selectedCategory = declarationCategoryOptions.find((category) => category.key === selectedCategoryKey)
    if (!selectedCategory) return declarationTabs
    const categoryTabKeys = new Set(selectedCategory.tabKeys)
    return declarationTabs.filter((tab) => categoryTabKeys.has(tab.key as tableauTabKey))
  }, [declarationCategoryOptions, declarationTabs, selectedCategoryKey])
  
  const selectableYears = useMemo(
    () => YEARS.filter((year) => MONTHS.some((month) => !istableauPeriodLocked(month.value, year, userRole))),
    [tableauPolicyRevision, userRole],
  )
  
  const selectableMonths = useMemo(
    () => MONTHS.filter((month) => !istableauPeriodLocked(month.value, annee, userRole)),
    [annee, tableauPolicyRevision, userRole],
  )
  
  const hasFiscalTabAccess = declarationTabs.length > 0
  const isActiveTabDisabled = disabledTabKeys.has(activeTab)

  const resolveDirectionForRole = useCallback(
    (fallbackDirection = "") => {
      const normalizedFallback = safeString(fallbackDirection).trim()
      if (isRegionalRole) {
        const regionalDirection = safeString(user?.region ?? user?.direction ?? "").trim()
        return regionalDirection || normalizedFallback
      }
      if (isFinanceRole) {
        return "Siege"
      }
      return normalizedFallback
    },
    [isRegionalRole, isFinanceRole, user],
  )

  const effectiveDirection = resolveDirectionForRole(safeString(direction).trim() || safeString(user?.direction).trim() || "Siege")

  useEffect(() => {
    if (!userRole) return
    let cancelled = false
    const requestedDirection = isAdminRole ? adminSelectedDirection : undefined
    const syncPolicy = async () => {
      await synctableauPolicy(requestedDirection)
      if (!cancelled) {
        settableauPolicyRevision((prev) => prev + 1)
      }
    }
    syncPolicy()
    return () => { cancelled = true }
  }, [adminSelectedDirection, isAdminRole, userRole])

  const canManageTabForDirection = useCallback(
    (tabKey: string, directionValue: string) => {
      if (CUSTOM_tableau_TAB_KEYS.has(tabKey)) return true
      return getManageabletableauTabKeysForDirection(userRole, isAdminRole ? directionValue : undefined).includes(tabKey)
    },
    [tableauPolicyRevision, isAdminRole, userRole],
  )

  useEffect(() => {
    if (filteredDeclarationTabs.length === 0) return
    const firstEnabledTab = filteredDeclarationTabs.find((tab) => !tab.isDisabled)?.key ?? filteredDeclarationTabs[0].key
    if (!filteredDeclarationTabs.some((tab) => tab.key === activeTab) || disabledTabKeys.has(activeTab)) {
      setActiveTab(firstEnabledTab)
    }
  }, [activeTab, disabledTabKeys, filteredDeclarationTabs])

  useEffect(() => {
    if (selectedCategoryKey === "all") return
    if (declarationCategoryOptions.some((category) => category.key === selectedCategoryKey)) return
    setSelectedCategoryKey("all")
  }, [declarationCategoryOptions, selectedCategoryKey])

  useEffect(() => {
    if (!selectableYears.includes(annee)) {
      const fallbackYear = selectableYears[0]
      if (fallbackYear) setAnnee(fallbackYear)
    }
    if (!selectableMonths.some((month) => month.value === mois)) {
      const fallbackMonth = selectableMonths[0]?.value
      if (fallbackMonth) setMois(fallbackMonth)
    }
  }, [annee, mois, selectableMonths, selectableYears])

  useEffect(() => {
    if (!user || isAdminRole) return
    setDirection((prev) => resolveDirectionForRole(prev))
  }, [user, isAdminRole, resolveDirectionForRole])

  useEffect(() => {
    if (!user || status !== "authenticated") {
      settableauDeclarations([])
      return
    }
    let cancelled = false
    const loadDeclarations = async () => {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
        const response = await fetch(`${API_BASE}/api/fiscal`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!response.ok) {
          if (!cancelled) settableauDeclarations([])
          return
        }
        const payload = await response.json().catch(() => null)
        const declarations = Array.isArray(payload)
          ? payload.map((item) => ({
              id: Number((item as { id?: unknown }).id ?? 0),
              tabKey: String((item as { tabKey?: unknown }).tabKey ?? "").trim().toLowerCase(),
              mois: String((item as { mois?: unknown }).mois ?? "").trim(),
              annee: String((item as { annee?: unknown }).annee ?? "").trim(),
              direction: String((item as { direction?: unknown }).direction ?? "").trim(),
              dataJson: String((item as { dataJson?: unknown }).dataJson ?? "{}"),
            }))
          : []
        if (!cancelled) settableauDeclarations(declarations)
      } catch {
        if (!cancelled) settableauDeclarations([])
      }
    }
    loadDeclarations()
    return () => { cancelled = true }
  }, [status, user])

  useEffect(() => {
    if (isLoading || status !== "authenticated" || !user) return
    if (!editQuery.editId) {
      setEditingDeclarationId(null)
      setEditingCreatedAt("")
      setEditingSourceMois("")
      setEditingSourceAnnee("")
      return
    }
    try {
      const parsed = JSON.parse(localStorage.getItem("fiscal_declarations") ?? "[]")
      const declarations = Array.isArray(parsed) ? (parsed as Savedtableau[]) : []
      const declaration = declarations.find((item) => safeString(item.id) === editQuery.editId)
      if (!declaration) {
        toast({
          title: "Declaration introuvable",
          description: "La declaration demandee n'existe pas ou a deja ete supprimee.",
          variant: "destructive",
        })
        return
      }
      const requestedTab = istableauTabKey(editQuery.tab) ? editQuery.tab : resolveDeclarationTabKey(declaration)
      const loadedDirection = safeString(declaration.direction).trim()
      const scopedDirection = isAdminRole ? loadedDirection : resolveDirectionForRole(loadedDirection)
      if (!isAdminRole && !canManageTabForDirection(requestedTab, scopedDirection)) {
        toast({
          title: "Acces refuse",
          description: "Votre profil n'est pas autorise a modifier ce tableau fiscal.",
          variant: "destructive",
        })
        router.push("/fisca_dashbord")
        return
      }
      setEditingDeclarationId(safeString(declaration.id) || editQuery.editId)
      setEditingCreatedAt(safeString(declaration.createdAt) || new Date().toISOString())
      setActiveTab(requestedTab)
      setDirection(scopedDirection)
      const loadedMois = normalizeMonthValue(safeString(declaration.mois))
      const loadedAnnee = normalizeYearValue(safeString(declaration.annee))
      setMois(loadedMois)
      setAnnee(loadedAnnee)
      setEditingSourceMois(loadedMois)
      setEditingSourceAnnee(loadedAnnee)
      // Chargement des données des tableaux conservés
      setReclamationRows(normalizeReclamationRows(declaration.reclamationRows))
      setReclamationGpRows(normalizeReclamationGpRows(declaration.reclamationGpRows))
      setEPayementPopRows(normalizeEPayementRows(declaration.ePayementPopRows))
      setEPayementPrpRows(normalizeEPayementRows(declaration.ePayementPrpRows))
      setTotalEncaissementRows(normalizeTotalEncaissementRows(declaration.totalEncaissementRows))
      setRecouvrementRows(normalizeRecouvrementRows(declaration.recouvrementRows))
      setRealisationTechniqueReseauRows(normalizeRealisationTechniqueReseauRows(declaration.realisationTechniqueReseauRows))
      setSituationReseauRows(normalizeSituationReseauRows(declaration.situationReseauRows))
      setTraficDataRows(normalizeTraficDataRows(declaration.traficDataRows))
      setAmeliorationQualiteRows(normalizeAmeliorationQualiteRows(declaration.ameliorationQualiteRows))
      setCouvertureReseauRows(normalizeCouvertureReseauRows(declaration.couvertureReseauRows))
      setActionNotableReseauRows(normalizeActionNotableReseauRows(declaration.actionNotableReseauRows))
      setDisponibiliteReseauRows(normalizeDisponibiliteReseauRows(declaration.disponibiliteReseauRows))
      setDesactivationResiliationRows(normalizeDesactivationResiliationRows(declaration.desactivationResiliationRows))
      setParcAbonnesB2bRows(normalizeParcAbonnesB2BRows(declaration.parcAbonnesB2bRows))
      setMttrRows(normalizeMttrRows(declaration.mttrRows))
      setCreancesContentieusesRows(normalizeCreancesContentieusesRows(declaration.creancesContentieusesRows))
      setFraisPersonnelRows(normalizeFraisPersonnelRows(declaration.fraisPersonnelRows))
      setEffectifGspRows(normalizeEffectifGspRows(declaration.effectifGspRows))
      setAbsenteismeRows(normalizeAbsenteismeRows(declaration.absenteismeRows))
      setMouvementEffectifsRows(normalizeMouvementEffectifsRows(declaration.mouvementEffectifsRows))
      setMouvementEffectifsDomaineRows(normalizeMouvementEffectifsDomaineRows(declaration.mouvementEffectifsDomaineRows))
      setCompteResultatRows(normalizeCompteResultatRows(declaration.compteResultatRows))
      setEffectifsFormesGspRows(normalizeEffectifsFormesGspRows(declaration.effectifsFormesGspRows))
      setFormationsDomainesRows(normalizeFormationsDomainesRows(declaration.formationsDomainesRows))
      setParcAbonnesGpRows(normalizeParcAbonnesGpRows(declaration.parcAbonnesGpRows))
      setTotalParcAbonnesRows(normalizeTotalParcAbonnesRows(declaration.totalParcAbonnesRows))
      setTotalParcAbonnesTechnologieRows(normalizeTotalParcAbonnesTechnologieRows(declaration.totalParcAbonnesTechnologieRows))
      setActivationRows(normalizeActivationRows(declaration.activationRows))
      setChiffreAffairesMdaRows(normalizeChiffreAffairesMdaRows(declaration.chiffreAffairesMdaRows))
    } catch {
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger la declaration a modifier.",
        variant: "destructive",
      })
    }
  }, [canManageTabForDirection, editQuery.editId, editQuery.tab, isAdminRole, isLoading, resolveDirectionForRole, router, status, user, toast])

  if (isLoading || !user || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  const handleSave = async () => {
    const saveDirection = effectiveDirection
    const isAdminEditing = isAdminRole && !!editingDeclarationId
    
    if (!isAdminEditing && !canManageTabForDirection(activeTab, saveDirection)) {
      toast({
        title: "Acces refuse",
        description: "Votre profil n'est pas autorise a creer ou modifier ce tableau fiscal.",
        variant: "destructive",
      })
      return
    }

    if (isActiveTabDisabled) {
      toast({
        title: "Tableau desactive",
        description: "Le tableau selectionne est desactive par l'administration.",
        variant: "destructive",
      })
      return
    }

    if (!selectableYears.includes(annee) || !selectableMonths.some((month) => month.value === mois)) {
      toast({
        title: "Periode cloturee",
        description: "Le mois ou l'annee selectionne(e) est hors delai.",
        variant: "destructive",
      })
      return
    }

    if (!mois) {
      toast({ title: "Mois requis", description: "Veuillez selectionner le mois avant d'enregistrer.", variant: "destructive" })
      return
    }
    if (!annee) {
      toast({ title: "Annee requise", description: "Veuillez selectionner l'annee avant d'enregistrer.", variant: "destructive" })
      return
    }

    const isSourcePeriodLocked = !!editingDeclarationId && !!editingSourceMois && !!editingSourceAnnee && istableauPeriodLocked(editingSourceMois, editingSourceAnnee, userRole)
    if (isSourcePeriodLocked) {
      toast({
        title: "Periode cloturee",
        description: `${gettableauPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification n'est autorisee.`,
        variant: "destructive",
      })
      return
    }

    if (istableauPeriodLocked(mois, annee, userRole)) {
      toast({
        title: "Periode cloturee",
        description: `${gettableauPeriodLockMessage(mois, annee, userRole)} Aucune creation ou modification n'est autorisee.`,
        variant: "destructive",
      })
      return
    }

    // Validation des champs pour les tableaux conservés
    let validationError = false
    switch (activeTab) {
      case "reclamation":
        if (reclamationRows.some((r) => !r.mGp && !r.mB2b && !r.m1Gp && !r.m1B2b)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Reclamation.", variant: "destructive" })
          validationError = true
        }
        break
      case "reclamation_gp":
        if (reclamationGpRows.some((r) => !r.recues || !r.traitees)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Reclamation GP.", variant: "destructive" })
          validationError = true
        }
        break
      case "e_payement_pop":
        if (ePayementPopRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau E-PAYEMENT Pop.", variant: "destructive" })
          validationError = true
        }
        break
      case "e_payement_prp":
        if (ePayementPrpRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau E-PAYEMENT Prp.", variant: "destructive" })
          validationError = true
        }
        break
      case "total_encaissement":
        if (totalEncaissementRows.some((row) => !row.mGp || !row.mB2b || !row.m1Gp || !row.m1B2b || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les valeurs du tableau Totale des encaissment.", variant: "destructive" })
          validationError = true
        }
        break
      case "recouvrement":
        if (recouvrementRows.some((row) => !row.mGp || !row.mB2b || !row.m1Gp || !row.m1B2b)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Recouvrement.", variant: "destructive" })
          validationError = true
        }
        break
      case "realisation_technique_reseau":
        if (realisationTechniqueReseauRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Realisation technique Reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "situation_reseau":
        if (situationReseauRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Situation Reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "trafic_data":
        if (traficDataRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Trafic Data.", variant: "destructive" })
          validationError = true
        }
        break
      case "amelioration_qualite":
        if (ameliorationQualiteRows.some((row) => !row.wilaya || !row.mObjectif || !row.mRealise || !row.m1Objectif || !row.m1Realise || !row.ecart)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Amelioration qualite.", variant: "destructive" })
          validationError = true
        }
        break
      case "couverture_reseau":
        if (couvertureReseauRows.some((row) => !row.wilaya || !row.mObjectif || !row.mRealise || !row.m1Objectif || !row.m1Realise || !row.ecart)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Couverture Reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "action_notable_reseau":
        if (actionNotableReseauRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Action notable sur le reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "disponibilite_reseau":
        if (disponibiliteReseauRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Disponibilite reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "desactivation_resiliation":
        if (desactivationResiliationRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Desactivation / Resiliation.", variant: "destructive" })
          validationError = true
        }
        break
      case "parc_abonnes_b2b":
        if (parcAbonnesB2bRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Parc Abonnes B2B.", variant: "destructive" })
          validationError = true
        }
        break
      case "mttr":
        if (mttrRows.some((region) => region.cities.some((city) => !city.wilayaM || !city.objectifM || !city.realiseM || !city.wilayaM1 || !city.objectifM1 || !city.realiseM1 || !city.ecart))) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau MTTR.", variant: "destructive" })
          validationError = true
        }
        break
      case "creances_contentieuses":
        if (creancesContentieusesRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Creances Contentieuses.", variant: "destructive" })
          validationError = true
        }
        break
      case "frais_personnel":
        if (fraisPersonnelRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Frais personnel.", variant: "destructive" })
          validationError = true
        }
        break
      case "effectif_gsp":
        if (effectifGspRows.some((row) => !row.m || !row.m1 || !row.part)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Effectif par GSP.", variant: "destructive" })
          validationError = true
        }
        break
      case "absenteisme":
        if (absenteismeRows.some((row) => !row.m || !row.m1 || !row.part)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Absenteisme.", variant: "destructive" })
          validationError = true
        }
        break
      case "mouvement_effectifs":
        if (mouvementEffectifsRows.some((row) => !row.mCadresSup || !row.mCadres || !row.mMaitrise || !row.mExecution || !row.m1CadresSup || !row.m1Cadres || !row.m1Maitrise || !row.m1Execution)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Mouvement des effectifs.", variant: "destructive" })
          validationError = true
        }
        break
      case "mouvement_effectifs_domaine":
        if (mouvementEffectifsDomaineRows.some((row) => !row.mCdi || !row.mCdd || !row.mCta || !row.m1Cdi || !row.m1Cdd || !row.m1Cta)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Mouvement des effectifs par domaine.", variant: "destructive" })
          validationError = true
        }
        break
      case "compte_resultat":
        if (compteResultatRows.some((row) => !row.mBudget || !row.mRealise || !row.mTaux || !row.m1Budget || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Compte de resultat.", variant: "destructive" })
          validationError = true
        }
        break
      case "effectifs_formes_gsp":
        if (effectifsFormesGspRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Effectifs formes par GSP.", variant: "destructive" })
          validationError = true
        }
        break
      case "formations_domaines":
        if (formationsDomainesRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Formations realisees par domaines.", variant: "destructive" })
          validationError = true
        }
        break
      case "parc_abonnes_gp":
        if (parcAbonnesGpRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Parc Abonnes GP.", variant: "destructive" })
          validationError = true
        }
        break
      case "total_parc_abonnes":
        if (totalParcAbonnesRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Total Parc Abonnes.", variant: "destructive" })
          validationError = true
        }
        break
      case "total_parc_abonnes_technologie":
        if (totalParcAbonnesTechnologieRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Total Parc Abonnes parc technologie.", variant: "destructive" })
          validationError = true
        }
        break
      case "activation":
        if (activationRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Activation.", variant: "destructive" })
          validationError = true
        }
        break
      case "chiffre_affaires_mda":
        if (chiffreAffairesMdaRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Chiffre d'Affaires (MDA).", variant: "destructive" })
          validationError = true
        }
        break
    }
    if (validationError) return

    let existingDeclarations: Savedtableau[] = []
    try {
      const parsed = JSON.parse(localStorage.getItem("fiscal_declarations") ?? "[]")
      existingDeclarations = Array.isArray(parsed) ? (parsed as Savedtableau[]) : []
    } catch {
      existingDeclarations = []
    }

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 400))

    const declarationId = editingDeclarationId ?? Date.now().toString()
    const declarationCreatedAt = editingCreatedAt || new Date().toISOString()
    
    const baseDecl: Savedtableau = {
      id: declarationId,
      createdAt: declarationCreatedAt,
      direction: saveDirection,
      mois,
      annee,
      reclamationRows: [],
      reclamationGpRows: [],
      ePayementPopRows: [],
      ePayementPrpRows: [],
      totalEncaissementRows: [],
      recouvrementRows: [],
      realisationTechniqueReseauRows: [],
      situationReseauRows: [],
      traficDataRows: [],
      ameliorationQualiteRows: [],
      couvertureReseauRows: [],
      actionNotableReseauRows: [],
      disponibiliteReseauRows: [],
      desactivationResiliationRows: [],
      parcAbonnesB2bRows: [],
      mttrRows: [],
      creancesContentieusesRows: [],
      fraisPersonnelRows: [],
      effectifGspRows: [],
      absenteismeRows: [],
      mouvementEffectifsRows: [],
      mouvementEffectifsDomaineRows: [],
      compteResultatRows: [],
      effectifsFormesGspRows: [],
      formationsDomainesRows: [],
      parcAbonnesGpRows: [],
      totalParcAbonnesRows: [],
      totalParcAbonnesTechnologieRows: [],
      activationRows: [],
      chiffreAffairesMdaRows: [],
    }
    
    switch (activeTab) {
      case "reclamation":
        baseDecl.reclamationRows = reclamationRows
        break
      case "reclamation_gp":
        baseDecl.reclamationGpRows = reclamationGpRows
        break
      case "e_payement_pop":
        baseDecl.ePayementPopRows = ePayementPopRows
        break
      case "e_payement_prp":
        baseDecl.ePayementPrpRows = ePayementPrpRows
        break
      case "total_encaissement":
        baseDecl.totalEncaissementRows = totalEncaissementRows
        break
      case "recouvrement":
        baseDecl.recouvrementRows = recouvrementRows
        break
      case "realisation_technique_reseau":
        baseDecl.realisationTechniqueReseauRows = realisationTechniqueReseauRows
        break
      case "situation_reseau":
        baseDecl.situationReseauRows = situationReseauRows
        break
      case "trafic_data":
        baseDecl.traficDataRows = traficDataRows
        break
      case "amelioration_qualite":
        baseDecl.ameliorationQualiteRows = ameliorationQualiteRows
        break
      case "couverture_reseau":
        baseDecl.couvertureReseauRows = couvertureReseauRows
        break
      case "action_notable_reseau":
        baseDecl.actionNotableReseauRows = actionNotableReseauRows
        break
      case "disponibilite_reseau":
        baseDecl.disponibiliteReseauRows = disponibiliteReseauRows
        break
      case "desactivation_resiliation":
        baseDecl.desactivationResiliationRows = desactivationResiliationRows
        break
      case "parc_abonnes_b2b":
        baseDecl.parcAbonnesB2bRows = parcAbonnesB2bRows
        break
      case "mttr":
        baseDecl.mttrRows = mttrRows
        break
      case "creances_contentieuses":
        baseDecl.creancesContentieusesRows = creancesContentieusesRows
        break
      case "frais_personnel":
        baseDecl.fraisPersonnelRows = fraisPersonnelRows
        break
      case "effectif_gsp":
        baseDecl.effectifGspRows = effectifGspRows
        break
      case "absenteisme":
        baseDecl.absenteismeRows = absenteismeRows
        break
      case "mouvement_effectifs":
        baseDecl.mouvementEffectifsRows = mouvementEffectifsRows
        break
      case "mouvement_effectifs_domaine":
        baseDecl.mouvementEffectifsDomaineRows = mouvementEffectifsDomaineRows
        break
      case "compte_resultat":
        baseDecl.compteResultatRows = compteResultatRows
        break
      case "effectifs_formes_gsp":
        baseDecl.effectifsFormesGspRows = effectifsFormesGspRows
        break
      case "formations_domaines":
        baseDecl.formationsDomainesRows = formationsDomainesRows
        break
      case "parc_abonnes_gp":
        baseDecl.parcAbonnesGpRows = parcAbonnesGpRows
        break
      case "total_parc_abonnes":
        baseDecl.totalParcAbonnesRows = totalParcAbonnesRows
        break
      case "total_parc_abonnes_technologie":
        baseDecl.totalParcAbonnesTechnologieRows = totalParcAbonnesTechnologieRows
        break
      case "activation":
        baseDecl.activationRows = activationRows
        break
      case "chiffre_affaires_mda":
        baseDecl.chiffreAffairesMdaRows = chiffreAffairesMdaRows
        break
    }
    
    try {
      if (editingDeclarationId) {
        const hasTarget = existingDeclarations.some((item) => safeString(item.id) === editingDeclarationId)
        const updated = hasTarget
          ? existingDeclarations.map((item) => (safeString(item.id) === editingDeclarationId ? baseDecl : item))
          : [baseDecl, ...existingDeclarations]
        localStorage.setItem("fiscal_declarations", JSON.stringify(updated))
      } else {
        localStorage.setItem("fiscal_declarations", JSON.stringify([baseDecl, ...existingDeclarations]))
      }
    } catch { /* quota or SSR */ }

    try {
      const apiBase = API_BASE
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      let tabData: unknown = {}
      switch (activeTab) {
        case "reclamation": tabData = { reclamationRows }; break
        case "reclamation_gp": tabData = { reclamationGpRows }; break
        case "e_payement_pop": tabData = { ePayementPopRows }; break
        case "e_payement_prp": tabData = { ePayementPrpRows }; break
        case "total_encaissement": tabData = { totalEncaissementRows }; break
        case "recouvrement": tabData = { recouvrementRows }; break
        case "realisation_technique_reseau": tabData = { realisationTechniqueReseauRows }; break
        case "situation_reseau": tabData = { situationReseauRows }; break
        case "trafic_data": tabData = { traficDataRows }; break
        case "amelioration_qualite": tabData = { ameliorationQualiteRows }; break
        case "couverture_reseau": tabData = { couvertureReseauRows }; break
        case "action_notable_reseau": tabData = { actionNotableReseauRows }; break
        case "disponibilite_reseau": tabData = { disponibiliteReseauRows }; break
        case "desactivation_resiliation": tabData = { desactivationResiliationRows }; break
        case "parc_abonnes_b2b": tabData = { parcAbonnesB2bRows }; break
        case "mttr": tabData = { mttrRows }; break
        case "creances_contentieuses": tabData = { creancesContentieusesRows }; break
        case "frais_personnel": tabData = { fraisPersonnelRows }; break
        case "effectif_gsp": tabData = { effectifGspRows }; break
        case "absenteisme": tabData = { absenteismeRows }; break
        case "mouvement_effectifs": tabData = { mouvementEffectifsRows }; break
        case "mouvement_effectifs_domaine": tabData = { mouvementEffectifsDomaineRows }; break
        case "compte_resultat": tabData = { compteResultatRows }; break
        case "effectifs_formes_gsp": tabData = { effectifsFormesGspRows }; break
        case "formations_domaines": tabData = { formationsDomainesRows }; break
        case "parc_abonnes_gp": tabData = { parcAbonnesGpRows }; break
        case "total_parc_abonnes": tabData = { totalParcAbonnesRows }; break
        case "total_parc_abonnes_technologie": tabData = { totalParcAbonnesTechnologieRows }; break
        case "activation": tabData = { activationRows }; break
        case "chiffre_affaires_mda": tabData = { chiffreAffairesMdaRows }; break
      }
      const requestPayload = {
        tabKey: activeTab,
        mois,
        annee,
        direction: saveDirection,
        dataJson: JSON.stringify(tabData),
      }

      if (editingDeclarationId) {
        await fetch(`${apiBase}/api/fiscal/${encodeURIComponent(editingDeclarationId)}`, {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
      }

      const createResponse = await fetch(`${apiBase}/api/fiscal`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(requestPayload),
      })

      if (!createResponse.ok) {
        throw new Error("Erreur lors de l'enregistrement")
      }
    } catch (error) {
      setIsSubmitting(false)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de contacter le serveur",
        variant: "destructive",
      })
      return
    }
    
    const tabLabel = TABS.find((t) => t.key === activeTab)?.label ?? activeTab
    toast({
      title: editingDeclarationId ? "Declaration modifiee" : "Declaration enregistree",
      description: `La declaration "${tabLabel}" a ete sauvegardee avec succes.`,
    })
    setIsSubmitting(false)
    router.push("/fisca_dashbord")
  }

  const activeColor = TABS.find((t) => t.key === activeTab)?.color ?? "#2db34b"
  const mon = MONTHS.find((m) => m.value === mois)?.label ?? mois
  const currentPeriodLockMessage = (() => {
    if (editingDeclarationId && editingSourceMois && editingSourceAnnee && istableauPeriodLocked(editingSourceMois, editingSourceAnnee, userRole)) {
      return `${gettableauPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification n'est autorisee.`
    }
    if (istableauPeriodLocked(mois, annee, userRole)) {
      return `${gettableauPeriodLockMessage(mois, annee, userRole)} Aucune creation ou modification n'est autorisee.`
    }
    return ""
  })()

  return (
    <LayoutWrapper user={user}>
      {!hasFiscalTabAccess ? (
        <AccessDeniedDialog
          title="Acces refuse"
          message={user.role === "direction"
            ? "Votre role ne vous permet pas de creer des declarations fiscales."
            : "Votre role ne vous permet pas de gerer les tableaux fiscaux."}
          redirectTo="/fisca_dashbord"
        />
      ) : (
        <>
          

          <div className="space-y-5 w-full" ref={printRef}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{editingDeclarationId ? "Modifier Declaration" : "Nouvelle Declaration"}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {editingDeclarationId
                    ? "Mettez a jour les informations du tableau puis enregistrez les modifications."
                    : "Remplissez chaque tableau, puis enregistrez."}
                </p>
              </div>
            </div>

            <Card className="border border-gray-200">
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-wrap items-end gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Mois</label>
                    <Select value={mois} onValueChange={setMois}>
                      <SelectTrigger className="h-10 text-sm w-[150px]">
                        <SelectValue placeholder="Mois" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableMonths.length === 0
                          ? <SelectItem value="no-months" disabled>Aucun mois disponible</SelectItem>
                          : selectableMonths.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Annee</label>
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={annee}
                      onChange={(e) => setAnnee(e.target.value)}
                      placeholder="Ex: 2026"
                      className="h-10 w-[120px] rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[220px]">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Categorie</label>
                    <Select value={selectedCategoryKey} onValueChange={(value) => setSelectedCategoryKey(value as tableauCategoryKey)}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Selectionner une categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {declarationCategoryOptions.map((category) => (
                          <SelectItem key={category.key} value={category.key}>{category.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 flex-1 min-w-[220px]">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tableau</label>
                    <Select value={activeTab} onValueChange={(value) => {
                      if (disabledTabKeys.has(value)) return
                      setActiveTab(value)
                      setSelectedCategoryKey(findtableauCategoryKeyForTab(value))
                    }}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Selectionner un tableau" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredDeclarationTabs.length === 0
                          ? <SelectItem value="no-tables" disabled>Aucun tableau disponible pour cette categorie</SelectItem>
                          : filteredDeclarationTabs.map((t) => (
                              <SelectItem key={t.key} value={t.key} disabled={t.isDisabled} className={t.isDisabled ? "text-muted-foreground" : ""}>
                                {t.label}{t.isDisabled ? " (desactive)" : ""}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {isActiveTabDisabled && (
                  <p className="mt-3 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                    Ce tableau est desactive par l'administration. Il apparait en grise et ne peut pas etre enregistre.
                  </p>
                )}
                {currentPeriodLockMessage && (
                  <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    {currentPeriodLockMessage}
                  </p>
                )}
              </CardContent>
            </Card>

            <div>
              {activeTab === "reclamation" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Tableau Reclamation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabReclamation rows={reclamationRows} setRows={setReclamationRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "reclamation_gp" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Tableau Reclamation GP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabReclamationGp rows={reclamationGpRows} setRows={setReclamationGpRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "e_payement_pop" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>E-PAYEMENT Pop (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabEPayementSingle
                      title="E-PAYEMENT Pop (MDA)"
                      rows={ePayementPopRows}
                      setRows={setEPayementPopRows}
                      onSave={handleSave}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}
              {activeTab === "e_payement_prp" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>E-PAYEMENT Prp (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabEPayementSingle
                      title="E-PAYEMENT Prp (MDA)"
                      rows={ePayementPrpRows}
                      setRows={setEPayementPrpRows}
                      onSave={handleSave}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}
              {activeTab === "total_encaissement" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Totale des encaissment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabTotalEncaissement
                      row={totalEncaissementRows[0] ?? EMPTY_TOTAL_ENCAISSEMENT_ROW}
                      setRow={(updater) => {
                        if (typeof updater === "function") {
                          setTotalEncaissementRows((prev) => [
                            (updater as (value: TotalEncaissementRow) => TotalEncaissementRow)(prev[0] ?? EMPTY_TOTAL_ENCAISSEMENT_ROW),
                          ])
                        } else {
                          setTotalEncaissementRows([updater])
                        }
                      }}
                      onSave={handleSave}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}
              {activeTab === "recouvrement" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Recouvrement (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabRecouvrement rows={recouvrementRows} setRows={setRecouvrementRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "realisation_technique_reseau" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Realisation technique Reseau</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabRealisationTechniqueReseau
                      rows={realisationTechniqueReseauRows}
                      setRows={setRealisationTechniqueReseauRows}
                      onSave={handleSave}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}
              {activeTab === "situation_reseau" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Situation Reseau</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabSituationReseau rows={situationReseauRows} setRows={setSituationReseauRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "trafic_data" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Trafic Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabTraficData rows={traficDataRows} setRows={setTraficDataRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "amelioration_qualite" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Amelioration qualite</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabAmeliorationQualite rows={ameliorationQualiteRows} setRows={setAmeliorationQualiteRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "couverture_reseau" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Couverture Reseau</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabCouvertureReseau rows={couvertureReseauRows} setRows={setCouvertureReseauRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "action_notable_reseau" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Action notable sur le reseau</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabActionNotableReseau rows={actionNotableReseauRows} setRows={setActionNotableReseauRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "disponibilite_reseau" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Disponibilite reseau</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabDisponibiliteReseau rows={disponibiliteReseauRows} setRows={setDisponibiliteReseauRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "desactivation_resiliation" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Desactivation / Resiliation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabDesactivationResiliation rows={desactivationResiliationRows} setRows={setDesactivationResiliationRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "parc_abonnes_b2b" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Parc Abonnes B2B</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabParcAbonnesB2B rows={parcAbonnesB2bRows} setRows={setParcAbonnesB2bRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "mttr" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>MTTR / DR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabMttr rows={mttrRows} setRows={setMttrRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "creances_contentieuses" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Creances Contentieuses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabCreancesContentieuses rows={creancesContentieusesRows} setRows={setCreancesContentieusesRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "frais_personnel" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Frais personnel (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabFraisPersonnel rows={fraisPersonnelRows} setRows={setFraisPersonnelRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "effectif_gsp" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Effectif par GSP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabEffectifGsp rows={effectifGspRows} setRows={setEffectifGspRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "absenteisme" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Absenteisme</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabAbsenteisme rows={absenteismeRows} setRows={setAbsenteismeRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "mouvement_effectifs" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Mouvement des effectifs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabMouvementEffectifs rows={mouvementEffectifsRows} setRows={setMouvementEffectifsRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "mouvement_effectifs_domaine" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Mouvement des effectifs par domaine</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabMouvementEffectifsDomaine rows={mouvementEffectifsDomaineRows} setRows={setMouvementEffectifsDomaineRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "compte_resultat" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Compte de resultat</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabCompteResultat rows={compteResultatRows} setRows={setCompteResultatRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "effectifs_formes_gsp" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Effectifs formes par GSP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabEffectifsFormesGsp rows={effectifsFormesGspRows} setRows={setEffectifsFormesGspRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "formations_domaines" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Formations realisees par domaines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabFormationsDomaines rows={formationsDomainesRows} setRows={setFormationsDomainesRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "parc_abonnes_gp" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Parc Abonnes GP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabParcAbonnesGp rows={parcAbonnesGpRows} setRows={setParcAbonnesGpRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "total_parc_abonnes" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Total Parc Abonnes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabTotalParcAbonnes rows={totalParcAbonnesRows} setRows={setTotalParcAbonnesRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "total_parc_abonnes_technologie" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Total Parc Abonnes parc technologie</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabTotalParcAbonnesTechnologie rows={totalParcAbonnesTechnologieRows} setRows={setTotalParcAbonnesTechnologieRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "activation" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Activation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabActivation rows={activationRows} setRows={setActivationRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "chiffre_affaires_mda" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Chiffre d'Affaires (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabChiffreAffairesMda rows={chiffreAffairesMdaRows} setRows={setChiffreAffairesMdaRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </LayoutWrapper>
  )
}