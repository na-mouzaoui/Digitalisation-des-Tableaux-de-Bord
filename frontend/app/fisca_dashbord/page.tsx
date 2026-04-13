"use client"

import { useEffect, useMemo, useState } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Trash2, Printer, Filter, ChevronUp, ChevronDown, X, Pencil, Clock3, CalendarDays, Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { API_BASE } from "@/lib/config"
const getFiscalPeriodLockMessage = (mois: string, annee: string) => `Période ${mois}/${annee}.`
const isFiscalPeriodLocked = () => false

type EncRow = { designation: string; ht?: string; ttc?: string }
type TvaRate = "19" | "9"
type TvaRow = { nomRaisonSociale: string; adresse: string; nif: string; authNif: string; numRC: string; authRC: string; numFacture: string; dateFacture: string; montantHT: string; tva: string; tauxTVA?: TvaRate | "" }
type TimbreRow = { designation: string; caTTCEsp: string; droitTimbre: string }
type TAPRow = { wilayaCode: string; tap2: string }
type SiegeEncRow = { ttc: string; ht: string }
type IrgRow    = { assietteImposable: string; montant: string }
type Taxe2Row  = { base: string; montant: string }
type MasterRow = { date: string; nomMaster: string; numFacture: string; dateFacture: string; montantHT: string; taxe15: string; mois: string; observation: string }
type Taxe12Row = { montant: string }
type Ibs14Row  = {
  numFacture: string
  montantBrutDevise: string
  tauxChange: string
  dateContrat?: string
  montantBrutDinars: string
  montantNetDevise: string
  montantIBS: string
  montantNetDinars: string
}
type Taxe15Row = { numFacture: string; dateFacture: string; raisonSociale: string; montantNetDevise: string; monnaie: string; tauxChange: string; montantDinars: string; tauxTaxe: string; montantAPayer: string }
type Tva16Row  = { numFacture: string; montantBrutDevise: string; tauxChange: string; montantBrutDinars: string; tva19: string }
type EPayementRow = { rechargement: string; m: string; m1: string; evol: string }
type TotalEncaissementRow = { mGp: string; mB2b: string; m1Gp: string; m1B2b: string; evol: string }
type RecouvrementRow = { label: string; mGp: string; mB2b: string; m1Gp: string; m1B2b: string }
type RealisationTechniqueReseauRow = { label: string; m: string; m1: string }
type SituationReseauRow = { situation: string; equipements: string; m: string; m1: string }
type TraficDataRow = { label: string; m: string; m1: string }
type AmeliorationQualiteRow = { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }
type CouvertureReseauRow = { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }
type ActionNotableReseauRow = { action: string; objectif2025: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
type DisponibiliteReseauRow = { designation: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
type DesactivationResiliationRow = { designation: string; m: string; m1: string; evol: string }
type ParcAbonnesB2BRow = { designation: string; m: string; m1: string; evol: string }
type MttrCityRow = { wilayaM: string; objectifM: string; realiseM: string; wilayaM1: string; objectifM1: string; realiseM1: string; ecart: string }
type MttrRegionRow = { region: string; cities: MttrCityRow[] }
type CreancesContentieusesRow = { designation: string; m: string; m1: string; evol: string }
type FraisPersonnelRow = { designation: string; m: string; m1: string }
type EffectifGspRow = { gsp: string; m: string; m1: string; part: string }
type AbsenteismeRow = { motif: string; m: string; m1: string; part: string }
type MouvementEffectifsRow = {
  bloc: "arrives" | "departs"
  operation: string
  mCadresSup: string
  mCadres: string
  mMaitrise: string
  mExecution: string
  m1CadresSup: string
  m1Cadres: string
  m1Maitrise: string
  m1Execution: string
}
type MouvementEffectifsDomaineRow = {
  bloc: "recrutement" | "sortant"
  domaine: string
  mCdi: string
  mCdd: string
  mCta: string
  m1Cdi: string
  m1Cdd: string
  m1Cta: string
}
type CompteResultatRow = {
  designation: string
  mBudget: string
  mRealise: string
  mTaux: string
  m1Budget: string
  m1Realise: string
  m1Taux: string
}
type EffectifsFormesGspRow = {
  gsp: string
  mObjectif: string
  mRealise: string
  mTaux: string
  m1Objectif: string
  m1Realise: string
  m1Taux: string
}
type FormationsDomainesRow = {
  domaine: string
  mObjectif: string
  mRealise: string
  mTaux: string
  m1Objectif: string
  m1Realise: string
  m1Taux: string
}
type ParcAbonnesGpRow = { designation: string; m: string; m1: string; evol: string }
type TotalParcAbonnesRow = { designation: string; m: string; m1: string; evol: string }
type TotalParcAbonnesTechnologieRow = { designation: string; m: string; m1: string; evol: string }
type ActivationRow = { designation: string; m: string; m1: string; evol: string }
type ChiffreAffairesMdaRow = {
  designation: string
  mObjectif: string
  mRealise: string
  mTaux: string
  m1Objectif: string
  m1Realise: string
  m1Taux: string
}

const SIEGE_G1_LABELS = ["Encaissement", "Encaissement Exon\u00e9r\u00e9e"]
const SIEGE_G2_LABELS = [
  "Encaissement MOBIPOST", "Encaissement POST PAID", "Encaissement RACIMO",
  "Encaissement DME", "Encaissement SOFIA", "Encaissement CCP RECOUVREMENT A",
  "Encaissement CCP RECOUVREMENT B", "Encaissement CCP TPE",
  "Encaissement BNA TPE", "Encaissement MASTER ALGERIE POSTE",
]

const IRG_LABELS = [
  "IRG sur Salaire Bareme", "Autre IRG 10%", "Autre IRG 15%",
  "Jetons de présence 15%", "Tantieme 15%",
]
const TAXE2_LABELS = ["Taxe sur l'importation des biens et services"]
const TAXE12_LABELS = ["Taxe de Formation Professionnelle 1%", "Taxe d'Apprentissage 1%"]
const MONTH_LABELS_SHORT = ["Janv","Fév","Mars","Avr","Mai","Juin","Juil","Août","Sept","Oct","Nov","Déc"]
const EPAYEMENT_CHANNELS = ["Baridimob", "webportail", "GAB-Alg Poste", "WINPAY (BNA)"] as const

interface SavedDeclaration {
  id: string
  userId?: number
  createdAt: string
  direction: string
  mois: string
  annee: string
  isApproved?: boolean
  approvedByUserId?: number | null
  approvedAt?: string | null
  encRows?: EncRow[]
  tvaImmoRows?: TvaRow[]
  tvaBiensRows?: TvaRow[]
  timbreRows?: TimbreRow[]
  b12?: string
  b13?: string
  tapRows?: TAPRow[]
  caSiegeRows?: SiegeEncRow[]
  irgRows?: IrgRow[]
  taxe2Rows?: Taxe2Row[]
  masterRows?: MasterRow[]
  taxe11Montant?: string
  taxe12Rows?: Taxe12Row[]
  acompteMonths?: string[]
  ibs14Rows?: Ibs14Row[]
  taxe15Rows?: Taxe15Row[]
  tva16Rows?: Tva16Row[]
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
}

interface ApiFiscalDeclaration {
  id: number
  userId: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
  isApproved?: boolean
  approvedByUserId?: number | null
  approvedAt?: string | null
  createdAt: string
}

interface ApiFiscalRecap {
  id: number
  key: string
  title: string
  mois: string
  annee: string
  rowsJson: string
  formulasJson: string
  isGenerated: boolean
  createdAt: string
  updatedAt: string
}

interface SavedRecap {
  id: string
  key: string
  title: string
  mois: string
  annee: string
  createdAt: string
  rows: Record<string, string>[]
}

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? "")) : []

const mapApiDeclarationToSaved = (item: ApiFiscalDeclaration): SavedDeclaration => {
  const parsedData = (() => {
    try {
      const payload = JSON.parse(item.dataJson ?? "{}")
      return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  })()

  const declaration: SavedDeclaration = {
    id: String(item.id),
    userId: item.userId,
    createdAt: item.createdAt,
    direction: item.direction ?? "",
    mois: item.mois,
    annee: item.annee,
    isApproved: !!item.isApproved,
    approvedByUserId: item.approvedByUserId ?? null,
    approvedAt: item.approvedAt ?? null,
    encRows: [],
    tvaImmoRows: [],
    tvaBiensRows: [],
    timbreRows: [],
    b12: "",
    b13: "",
    tapRows: [],
    caSiegeRows: [],
    irgRows: [],
    taxe2Rows: [],
    masterRows: [],
    taxe11Montant: "",
    taxe12Rows: [],
    acompteMonths: [],
    ibs14Rows: [],
    taxe15Rows: [],
    tva16Rows: [],
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

  switch ((item.tabKey ?? "").trim().toLowerCase()) {
    case "encaissement":
      declaration.encRows = toArray<EncRow>(parsedData.encRows)
      break
    case "tva_immo":
      declaration.tvaImmoRows = toArray<TvaRow>(parsedData.tvaImmoRows)
      break
    case "tva_biens":
      declaration.tvaBiensRows = toArray<TvaRow>(parsedData.tvaBiensRows)
      break
    case "droits_timbre":
      declaration.timbreRows = toArray<TimbreRow>(parsedData.timbreRows)
      break
    case "ca_tap":
      declaration.b12 = String(parsedData.b12 ?? "")
      declaration.b13 = String(parsedData.b13 ?? "")
      break
    case "etat_tap":
      declaration.tapRows = toArray<TAPRow>(parsedData.tapRows)
      break
    case "ca_siege":
      declaration.caSiegeRows = toArray<SiegeEncRow>(parsedData.caSiegeRows)
      break
    case "irg":
      declaration.irgRows = toArray<IrgRow>(parsedData.irgRows)
      break
    case "taxe2":
      declaration.taxe2Rows = toArray<Taxe2Row>(parsedData.taxe2Rows)
      break
    case "taxe_masters":
      declaration.masterRows = toArray<MasterRow>(parsedData.masterRows)
      break
    case "taxe_vehicule":
      declaration.taxe11Montant = String(parsedData.taxe11Montant ?? "")
      break
    case "taxe_formation":
      declaration.taxe12Rows = toArray<Taxe12Row>(parsedData.taxe12Rows)
      break
    case "acompte":
      declaration.acompteMonths = toStringArray(parsedData.acompteMonths)
      break
    case "ibs":
      declaration.ibs14Rows = toArray<Ibs14Row>(parsedData.ibs14Rows)
      break
    case "taxe_domicil":
      declaration.taxe15Rows = toArray<Taxe15Row>(parsedData.taxe15Rows)
      break
    case "tva_autoliq":
      declaration.tva16Rows = toArray<Tva16Row>(parsedData.tva16Rows)
      break
    case "e_payement":
      declaration.ePayementPopRows = toArray<EPayementRow>(parsedData.ePayementPopRows)
      declaration.ePayementPrpRows = toArray<EPayementRow>(parsedData.ePayementPrpRows)
      break
    case "e_payement_pop":
      declaration.ePayementPopRows = toArray<EPayementRow>(parsedData.ePayementPopRows)
      break
    case "e_payement_prp":
      declaration.ePayementPrpRows = toArray<EPayementRow>(parsedData.ePayementPrpRows)
      break
    case "total_encaissement":
      declaration.totalEncaissementRows = toArray<TotalEncaissementRow>(parsedData.totalEncaissementRows)
      break
    case "recouvrement":
      declaration.recouvrementRows = toArray<RecouvrementRow>(parsedData.recouvrementRows)
      break
    case "realisation_technique_reseau":
      declaration.realisationTechniqueReseauRows = toArray<RealisationTechniqueReseauRow>(parsedData.realisationTechniqueReseauRows)
      break
    case "situation_reseau":
      declaration.situationReseauRows = toArray<SituationReseauRow>(parsedData.situationReseauRows)
      break
    case "trafic_data":
      declaration.traficDataRows = toArray<TraficDataRow>(parsedData.traficDataRows)
      break
    case "amelioration_qualite":
      declaration.ameliorationQualiteRows = toArray<AmeliorationQualiteRow>(parsedData.ameliorationQualiteRows)
      break
    case "couverture_reseau":
      declaration.couvertureReseauRows = toArray<CouvertureReseauRow>(parsedData.couvertureReseauRows)
      break
    case "action_notable_reseau":
      declaration.actionNotableReseauRows = toArray<ActionNotableReseauRow>(parsedData.actionNotableReseauRows)
      break
    case "disponibilite_reseau":
      declaration.disponibiliteReseauRows = toArray<DisponibiliteReseauRow>(parsedData.disponibiliteReseauRows)
      break
    case "desactivation_resiliation":
      declaration.desactivationResiliationRows = toArray<DesactivationResiliationRow>(parsedData.desactivationResiliationRows)
      break
    case "parc_abonnes_b2b":
      declaration.parcAbonnesB2bRows = toArray<ParcAbonnesB2BRow>(parsedData.parcAbonnesB2bRows)
      break
    case "mttr":
      declaration.mttrRows = toArray<MttrRegionRow>(parsedData.mttrRows)
      break
    case "creances_contentieuses":
      declaration.creancesContentieusesRows = toArray<CreancesContentieusesRow>(parsedData.creancesContentieusesRows)
      break
    case "frais_personnel":
      declaration.fraisPersonnelRows = toArray<FraisPersonnelRow>(parsedData.fraisPersonnelRows)
      break
    case "effectif_gsp":
      declaration.effectifGspRows = toArray<EffectifGspRow>(parsedData.effectifGspRows)
      break
    case "absenteisme":
      declaration.absenteismeRows = toArray<AbsenteismeRow>(parsedData.absenteismeRows)
      break
    case "mouvement_effectifs":
      declaration.mouvementEffectifsRows = toArray<MouvementEffectifsRow>(parsedData.mouvementEffectifsRows)
      break
    case "mouvement_effectifs_domaine":
      declaration.mouvementEffectifsDomaineRows = toArray<MouvementEffectifsDomaineRow>(parsedData.mouvementEffectifsDomaineRows)
      break
    case "compte_resultat":
      declaration.compteResultatRows = toArray<CompteResultatRow>(parsedData.compteResultatRows)
      break
    case "effectifs_formes_gsp":
      declaration.effectifsFormesGspRows = toArray<EffectifsFormesGspRow>(parsedData.effectifsFormesGspRows)
      break
    case "formations_domaines":
      declaration.formationsDomainesRows = toArray<FormationsDomainesRow>(parsedData.formationsDomainesRows)
      break
    case "parc_abonnes_gp":
      declaration.parcAbonnesGpRows = toArray<ParcAbonnesGpRow>(parsedData.parcAbonnesGpRows)
      break
    case "total_parc_abonnes":
      declaration.totalParcAbonnesRows = toArray<TotalParcAbonnesRow>(parsedData.totalParcAbonnesRows)
      break
    case "total_parc_abonnes_technologie":
      declaration.totalParcAbonnesTechnologieRows = toArray<TotalParcAbonnesTechnologieRow>(parsedData.totalParcAbonnesTechnologieRows)
      break
    case "activation":
      declaration.activationRows = toArray<ActivationRow>(parsedData.activationRows)
      break
    case "chiffre_affaires_mda":
      declaration.chiffreAffairesMdaRows = toArray<ChiffreAffairesMdaRow>(parsedData.chiffreAffairesMdaRows)
      break
    default:
      break
  }

  return declaration
}

const MONTHS: Record<string, string> = {
  "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
  "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Août",
  "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre",
}

const DASH_TABS = [
  { key: "encaissement",  label: "1 - Encaissement",       color: "#2db34b", title: "ETAT DES ENCAISSEMENTS" },
  { key: "tva_immo",      label: "2 - TVA / IMMO",         color: "#1d6fb8", title: "ETAT TVA / IMMOBILISATIONS" },
  { key: "tva_biens",     label: "3 - TVA / Biens & Serv", color: "#7c3aed", title: "ETAT TVA / BIENS & SERVICES" },
  { key: "droits_timbre", label: "4 - Droits Timbre",      color: "#0891b2", title: "ETAT DROITS DE TIMBRE" },
  { key: "ca_tap",        label: "5 - CA 7% & CA Glob 1%", color: "#ea580c", title: "CA 7% & CA GLOBAL 1%" },
  { key: "etat_tap",      label: "6 - ETAT TAP",           color: "#be123c", title: "ETAT TAP" },
  { key: "ca_siege",      label: "7 a CA Siège",           color: "#854d0e", title: "CHIFFRE D'AFFAIRE ENCAISSÉ SIÈGE" },
  { key: "irg",           label: "8 a Situation IRG",      color: "#0f766e", title: "SITUATION IRG" },
  { key: "taxe2",         label: "9 a Taxe 2%",            color: "#6d28d9", title: "SITUATION DE LA TAXE 2%" },
  { key: "taxe_masters",  label: "10 a Taxe des Master 1,5%", color: "#0369a1", title: "ÉTAT DE LA TAXE 1,5% DES MASTERS" },
  { key: "taxe_vehicule", label: "11 a Taxe Vehicule",      color: "#92400e", title: "TAXE DE VEHICULE" },
  { key: "taxe_formation",label: "12 a Taxe Formation",     color: "#065f46", title: "TAXE DE FORMATION" },
  { key: "acompte",       label: "13 a Acompte Provisionnel", color: "#1e40af", title: "SITUATION DE L'ACOMPTE PROVISIONNEL" },
  { key: "ibs",           label: "14 a IBS Fournisseurs Etrangers", color: "#7c2d12", title: "IBS SUR FOURNISSEURS ETRANGERS" },
  { key: "taxe_domicil",  label: "15 a Taxe Domiciliation", color: "#134e4a", title: "TAXE DOMICILIATION BANCAIRE" },
  { key: "tva_autoliq",   label: "16 a TVA Auto Liquidation", color: "#312e81", title: "TVA AUTO LIQUIDATION" },
  { key: "e_payement_pop",label: "17 a E-PAYEMENT Pop", color: "#065f46", title: "E-PAYEMENT POP (MDA)" },
  { key: "e_payement_prp",label: "18 a E-PAYEMENT Prp", color: "#0f766e", title: "E-PAYEMENT PRP (MDA)" },
  { key: "total_encaissement", label: "19 a Totale des encaissment", color: "#1e40af", title: "TOTALE DES ENCAISSMENT" },
  { key: "recouvrement", label: "20 a Recouvrement", color: "#166534", title: "RECOUVREMENT (MDA)" },
  { key: "realisation_technique_reseau", label: "21 a Realisation technique Reseau", color: "#1d4ed8", title: "REALISATION TECHNIQUE RESEAU" },
  { key: "situation_reseau", label: "22 a Situation Reseau", color: "#92400e", title: "SITUATION RESEAUX" },
  { key: "trafic_data", label: "23 a Trafic Data", color: "#075985", title: "TRAFIC DATA (TB)" },
  { key: "amelioration_qualite", label: "24 a Amelioration qualite", color: "#be185d", title: "AMELIORATION QUALITE" },
  { key: "couverture_reseau", label: "25 a Couverture Reseau", color: "#7c3aed", title: "COUVERTURE RESEAU" },
  { key: "action_notable_reseau", label: "26 a Action notable sur le reseau", color: "#a16207", title: "ACTION NOTABLE SUR LE RESEAU" },
  { key: "disponibilite_reseau", label: "27 a Disponibilite reseau", color: "#0f766e", title: "DISPONIBILITE RESEAU" },
  { key: "desactivation_resiliation", label: "28 a Desactivation / Resiliation", color: "#be123c", title: "DESACTIVATION / RESILIATION" },
  { key: "parc_abonnes_b2b", label: "29 a Parc Abonnes B2B", color: "#0c4a6e", title: "PARC ABONNES B2B" },
  { key: "mttr", label: "30 a MTTR", color: "#2db34b", title: "MTTR / DR" },
  { key: "creances_contentieuses", label: "31 a Creances Contentieuses", color: "#be123c", title: "CREANCES CONTENTIEUSES" },
  { key: "frais_personnel", label: "32 a Frais personnel", color: "#1d4ed8", title: "FRAIS PERSONNEL (MDA)" },
  { key: "effectif_gsp", label: "33 a Effectif par GSP", color: "#0369a1", title: "EFFECTIF PAR GSP" },
  { key: "absenteisme", label: "34 a Absenteisme", color: "#7c3aed", title: "ABSENTEISME (JOURS)" },
  { key: "mouvement_effectifs", label: "35 a Mouvement des effectifs", color: "#166534", title: "MOUVEMENT DES EFFECTIFS" },
  { key: "mouvement_effectifs_domaine", label: "36 a Mouvement des effectifs par domaine", color: "#0f766e", title: "MOUVEMENT DES EFFECTIFS PAR DOMAINE" },
  { key: "compte_resultat", label: "37 a Compte de resultat", color: "#2db34b", title: "COMPTE DE RESULTAT" },
  { key: "effectifs_formes_gsp", label: "38 a Effectifs formes par GSP", color: "#0369a1", title: "EFFECTIFS FORMES PAR GSP" },
  { key: "formations_domaines", label: "39 a Formations realisees par domaines", color: "#0f766e", title: "FORMATIONS REALISEES PAR DOMAINES" },
  { key: "parc_abonnes_gp", label: "40 a Parc Abonnes GP", color: "#1d4ed8", title: "PARC ABONNES GP" },
  { key: "total_parc_abonnes", label: "41 a Total Parc Abonnes", color: "#0369a1", title: "TOTAL PARC ABONNES" },
  { key: "total_parc_abonnes_technologie", label: "42 a Total Parc Abonnes parc technologie", color: "#0f766e", title: "TOTAL PARC ABONNES PARC TECHNOLOGIE" },
  { key: "activation", label: "43 a Activation", color: "#be123c", title: "ACTIVATION" },
  { key: "chiffre_affaires_mda", label: "44 a Chiffre d'Affaires (MDA)", color: "#2db34b", title: "CHIFFRE D'AFFAIRES (MDA)" },
]

// aaa Shared styles & helpers aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
const fmt = (v: number | string) => {
  if (v === "" || isNaN(Number(v))) return ""
  const num = Number(v)
  const [intPart, decPart] = num.toFixed(2).split(".")
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${formattedInt},${decPart}`
}
const num = (v: string | number | null | undefined) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0

  const raw = String(v ?? "").replace(/\u00A0/g, " ").trim()
  if (!raw) return 0

  const standardized = raw.replace(/\s/g, "").replace(/,/g, ".")
  const normalizedDots = standardized.replace(/\.(?=.*\.)/g, "")
  const parsed = parseFloat(normalizedDots)

  return Number.isFinite(parsed) ? parsed : 0
}
const resolveEncaissementAmounts = (row: EncRow) => {
  const htRaw = (row.ht ?? "").trim()
  if (htRaw !== "") {
    const ht = num(htRaw)
    const tva = ht * 0.19
    return { ht, tva, ttc: ht + tva }
  }

  // Backward compatibility for declarations saved with TTC as input.
  const ttc = num(row.ttc ?? "")
  const ht = ttc / 1.19
  return { ht, tva: ttc - ht, ttc }
}
const normalizeTvaRate = (value?: string): TvaRate | "" => {
  if (value === "19" || value === "9") return value
  return ""
}
const getTvaAmount = (row: TvaRow, showRateColumn: boolean) => {
  const rate = normalizeTvaRate(row.tauxTVA)
  if (showRateColumn && rate) {
    return num(row.montantHT) * (Number(rate) / 100)
  }
  return num(row.tva)
}
const getTvaRateLabel = (value?: string) => {
  const rate = normalizeTvaRate(value)
  return rate ? `${rate}%` : "a"
}
const textForPdf = (value?: string) => {
  const normalized = (value ?? "").trim()
  return normalized === "0" ? "" : normalized
}
const TH: React.CSSProperties = { border: "1px solid #d1d5db", padding: "1px 4px", textAlign: "left", fontWeight: 600, lineHeight: "1.1" }
const TD: React.CSSProperties = { border: "1px solid #e5e7eb", padding: "1px 4px", lineHeight: "1.1" }

function EncTable({ rows }: { rows: EncRow[] }) {
  const computedRows = rows.map((row) => ({
    designation: row.designation,
    ...resolveEncaissementAmounts(row),
  }))
  const totals = computedRows.reduce(
    (acc, row) => ({ ht: acc.ht + row.ht, tva: acc.tva + row.tva, ttc: acc.ttc + row.ttc }),
    { ht: 0, tva: 0, ttc: 0 },
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["DESIGNATIONS", "ENCAISSEMENTS HT", "TVA", "ENCAISSEMENTS TTC"].map((h) => (
            <TableHead key={h} className={h !== "DESIGNATIONS" ? "text-right" : undefined}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {computedRows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.designation || "-"}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.ht)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.tva)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.ttc)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(totals.ht)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(totals.tva)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(totals.ttc)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function TvaTable({ rows, totalLabel = "TOTAL" }: { rows: TvaRow[]; totalLabel?: string }) {
  const tHT  = rows.reduce((s, r) => s + num(r.montantHT), 0)
  const tTVA = rows.reduce((s, r) => s + getTvaAmount(r, true), 0)
  const tTTC = tHT + tTVA
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Nom et prénoms /Raison sociale","Adresse","NIF","Authentification du NIF","RC n°","Authentification du n°RC","Facture n°","Date","Montant HT", "TVA","Montant TTC"].map((h) => (
            <TableHead key={h} className={["Montant HT", "TVA", "Montant TTC"].includes(h) ? "text-right" : undefined}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => {
          const rowTva = getTvaAmount(r, true)
          return <TableRow key={i}>
            <TableCell className="text-xs">{textForPdf(r.nomRaisonSociale)}</TableCell>
            <TableCell className="text-xs">{textForPdf(r.adresse)}</TableCell>
            <TableCell className="text-xs">{textForPdf(r.nif)}</TableCell>
            <TableCell className="text-xs">{textForPdf(r.authNif)}</TableCell>
            <TableCell className="text-xs">{textForPdf(r.numRC)}</TableCell>
            <TableCell className="text-xs">{textForPdf(r.authRC)}</TableCell>
            <TableCell className="text-xs">{r.numFacture || "-"}</TableCell>
            <TableCell className="text-xs">{r.dateFacture || "-"}</TableCell>
            <TableCell className="text-right text-xs font-semibold">{fmt(r.montantHT)}</TableCell>
            <TableCell className="text-right text-xs font-semibold">{fmt(rowTva)}</TableCell>
            <TableCell className="text-right text-xs font-semibold">{fmt(num(r.montantHT) + rowTva)}</TableCell>
          </TableRow>
        })}
        <TableRow className="font-bold bg-muted">
          <TableCell colSpan={8}>{totalLabel}</TableCell>
          <TableCell className="text-right font-bold">{fmt(tHT)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(tTVA)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(tTTC)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function TimbreTable({ rows }: { rows: TimbreRow[] }) {
  const totalCA = rows.reduce((s, r) => s + num(r.caTTCEsp), 0)
  const totalDroit = rows.reduce((s, r) => s + num(r.droitTimbre), 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["DESIGNATIONS", "CHIFFRE D'AFFAIRES TTC", "DROITS DE TIMBRE"].map((h) => (
            <TableHead key={h} className={h !== "DESIGNATIONS" ? "text-right" : undefined}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.designation || "-"}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.caTTCEsp)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.droitTimbre)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalCA)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalDroit)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function CATable({ b12, b13 }: { b12: string; b13: string }) {
  const totalBase = num(b12) + num(b13)
  const totalTaxe = num(b12) * 0.07 + num(b13) * 0.01
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["DESIGNATIONS", "CA HT SOUMIS", "TAXE A VERSER"].map((h) => (
            <TableHead key={h} className={h !== "DESIGNATIONS" ? "text-right" : undefined}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>CA RECHARGEMENT SOUMIS A 7%</TableCell>
          <TableCell className="text-right font-semibold">{fmt(b12)}</TableCell>
          <TableCell className="text-right font-semibold">{fmt(num(b12) * 0.07)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>CA GLOBAL SOUMIS A 1%</TableCell>
          <TableCell className="text-right font-semibold">{fmt(b13)}</TableCell>
          <TableCell className="text-right font-semibold">{fmt(num(b13) * 0.01)}</TableCell>
        </TableRow>
        <TableRow className="font-bold bg-muted">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalBase)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalTaxe)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function TAPTable({ rows }: { rows: TAPRow[] }) {
  const totalImposable = rows.reduce((s, r) => s + num(r.tap2), 0)
  const totalTap = totalImposable * 0.015
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Code Wilaya", "Montant Imposable", "TAP 1,5%"].map((h) => (
            <TableHead key={h} className={["Montant Imposable", "TAP 1,5%"].includes(h) ? "text-right" : undefined}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.wilayaCode || "-"}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.tap2)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(num(r.tap2) * 0.015)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalImposable)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalTap)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function CaSiegeTable({ rows }: { rows: SiegeEncRow[] }) {
  if (!rows || rows.length < 12) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  const g1 = rows.slice(0, 2)
  const g2 = rows.slice(2, 12)
  const t1ttc = g1.reduce((s, r) => s + num(r.ttc), 0)
  const t1ht  = g1.reduce((s, r) => s + num(r.ht), 0)
  const t2ttc = g2.reduce((s, r) => s + num(r.ttc), 0)
  const t2ht  = g2.reduce((s, r) => s + num(r.ht), 0)
  type DR = { label: string; ttc: string; ht: string; total?: boolean }
  const displayRows: DR[] = [
    ...g1.map((r, i) => ({ label: SIEGE_G1_LABELS[i], ttc: fmt(r.ttc), ht: fmt(r.ht) })),
    { label: "TOTAL 1", ttc: fmt(t1ttc), ht: fmt(t1ht), total: true },
    ...g2.map((r, i) => ({ label: SIEGE_G2_LABELS[i], ttc: fmt(r.ttc), ht: fmt(r.ht) })),
    { label: "TOTAL 2", ttc: fmt(t2ttc), ht: fmt(t2ht), total: true },
    { label: "TOTAL GÉNÉRAL", ttc: fmt(t1ttc + t2ttc), ht: fmt(t1ht + t2ht), total: true },
  ]
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Désignation", "TTC", "HT"].map(h => <TableHead key={h} className={h !== "Désignation" ? "text-right" : undefined}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {displayRows.map((r, i) => (
          <TableRow key={i} className={r.total ? "font-bold bg-muted" : ""}>
            <TableCell>{r.label}</TableCell>
            <TableCell className="text-right font-semibold">{r.ttc}</TableCell>
            <TableCell className="text-right font-semibold">{r.ht}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function IrgTable({ rows }: { rows: IrgRow[] }) {
  if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  const totalAssiette = rows.reduce((s, r) => s + num(r.assietteImposable), 0)
  const total = rows.reduce((s, r) => s + num(r.montant), 0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Désignation", "Assiette Imposable", "Montant"].map(h => <TableHead key={h} className={h !== "Désignation" ? "text-right" : undefined}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {IRG_LABELS.map((lbl, i) => (
          <TableRow key={i}>
            <TableCell>{lbl}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(rows[i]?.assietteImposable ?? "0")}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(rows[i]?.montant ?? "0")}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalAssiette)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function Taxe2Table({ rows }: { rows: Taxe2Row[] }) {
  if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  const totalBase = rows.reduce((s, r) => s + num(r.base), 0)
  const totalMont = rows.reduce((s, r) => s + num(r.montant), 0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Désignation", "Montant de la base", "Montant de la Taxe 2%"].map(h => <TableHead key={h} className={h !== "Désignation" ? "text-right" : undefined}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {TAXE2_LABELS.map((lbl, i) => (
          <TableRow key={i}>
            <TableCell>{lbl}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(rows[i]?.base ?? "0")}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(rows[i]?.montant ?? "0")}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalBase)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalMont)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function MastersTable({ rows }: { rows: MasterRow[] }) {
  if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  const totalHT   = rows.reduce((s,r)=>s+num(r.montantHT),0)
  const totalTaxe = rows.reduce((s,r)=>s+num(r.montantHT)*0.015,0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["#","Date","Nom du Master","N° Facture","Date Facture","Montant HT","Taxe 1,5%","Mois","Observation"].map(h=><TableHead key={h} className={["Montant HT","Taxe 1,5%"].includes(h) ? "text-right" : undefined}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r,i)=>(
          <TableRow key={i}>
            <TableCell className="text-center">{i+1}</TableCell>
            <TableCell>{r.date}</TableCell>
            <TableCell className="text-xs">{r.nomMaster}</TableCell>
            <TableCell>{r.numFacture}</TableCell>
            <TableCell>{r.dateFacture}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantHT)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(num(r.montantHT)*0.015)}</TableCell>
            <TableCell className="text-xs">{r.mois}</TableCell>
            <TableCell className="text-xs">{r.observation}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell colSpan={5}>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalHT)}</TableCell>
          <TableCell className="text-right font-bold">{fmt(totalTaxe)}</TableCell>
          <TableCell colSpan={2}/>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function Taxe11Table({ montant }: { montant: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Désignation","Montant"].map(h=><TableHead key={h} className={h !== "Désignation" ? "text-right" : undefined}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Taxe de véhicule</TableCell>
          <TableCell className="text-right font-semibold">{fmt(montant)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function Taxe12Table({ rows }: { rows: Taxe12Row[] }) {
  if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  const total = rows.reduce((s,r)=>s+num(r.montant),0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Désignation","Montant"].map(h=><TableHead key={h} className={h !== "Désignation" ? "text-right" : undefined}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {TAXE12_LABELS.map((lbl,i)=>(
          <TableRow key={i}>
            <TableCell>{lbl}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(rows[i]?.montant??"0")}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function AcompteTable({ months, annee }: { months: string[]; annee: string }) {
  if (!months || months.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  const yy = annee.slice(-2)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Désignation</TableHead>
          {MONTH_LABELS_SHORT.map(m=><TableHead key={m} className="text-center">{m} {yy}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Montant</TableCell>
          {months.map((v,i)=>(<TableCell key={i} className="text-right font-semibold">{fmt(v)}</TableCell>))}
        </TableRow>
      </TableBody>
    </Table>
  )
}

function Ibs14Table({ rows }: { rows: Ibs14Row[] }) {
  if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {[
            "NUMERO DE FACTURE",
            "MONTANT BRUT EN DEVISES",
            "TAUX DE CHANGE\nDATE DU CONTRAT",
            "MONTANT VRUT EN DINARS",
            "MONTANT NET\nTRANSFERABLE EN DEVISES",
            "MONTANT DE L'IBS (Taux ...%)",
            "MONTANT NET\nTRANSFERABLE EN DINARS",
          ].map(h => (
            <TableHead key={h} className={h.includes("MONTANT") ? "text-right" : undefined}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r,i)=>(
          <TableRow key={i}>
            <TableCell>{r.numFacture}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantBrutDevise)}</TableCell>
            <TableCell>{r.tauxChange}</TableCell>
            <TableCell>{r.dateContrat ?? ""}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantBrutDinars)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantNetDevise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantIBS)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantNetDinars)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantBrutDevise),0))}</TableCell>
          <TableCell/>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantBrutDinars),0))}</TableCell>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantNetDevise),0))}</TableCell>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantIBS),0))}</TableCell>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantNetDinars),0))}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function Taxe15Table({ rows }: { rows: Taxe15Row[] }) {
  if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["#","N° Facture","Date Facture","Raison Sociale","Mont. Net Devise","Monnaie","Taux Change","Mont. Dinars","Taux Taxe","Mont. A Payer"].map(h=><TableHead key={h} className={["Mont. Net Devise","Mont. Dinars","Mont. A Payer"].includes(h) ? "text-right" : undefined}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r,i)=>(
          <TableRow key={i}>
            <TableCell className="text-center">{i+1}</TableCell>
            <TableCell className="text-xs">{r.numFacture}</TableCell>
            <TableCell className="text-xs">{r.dateFacture}</TableCell>
            <TableCell className="text-xs">{r.raisonSociale}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantNetDevise)}</TableCell>
            <TableCell>{r.monnaie}</TableCell>
            <TableCell>{r.tauxChange}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantDinars)}</TableCell>
            <TableCell className="text-xs">{r.tauxTaxe}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantAPayer)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell colSpan={4}>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantNetDevise),0))}</TableCell>
          <TableCell/><TableCell/>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantDinars),0))}</TableCell>
          <TableCell/>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantAPayer),0))}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function Tva16Table({ rows }: { rows: Tva16Row[] }) {
  if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["#","N° Facture","Mont. Brut Devises","Taux Change","Mont. Brut Dinars","TVA 19%"].map(h=><TableHead key={h} className={["Mont. Brut Devises","Mont. Brut Dinars","TVA 19%"].includes(h) ? "text-right" : undefined}>{h}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r,i)=>(
          <TableRow key={i}>
            <TableCell className="text-center">{i+1}</TableCell>
            <TableCell>{r.numFacture}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantBrutDevise)}</TableCell>
            <TableCell>{r.tauxChange}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.montantBrutDinars)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.tva19)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell colSpan={2}>TOTAL</TableCell>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantBrutDevise),0))}</TableCell>
          <TableCell/>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.montantBrutDinars),0))}</TableCell>
          <TableCell className="text-right font-bold">{fmt(rows.reduce((s,r)=>s+num(r.tva19),0))}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function EPayementTable({ rows, title }: { rows: EPayementRow[]; title: string }) {
  const normalizedRows = EPAYEMENT_CHANNELS.map((rechargement, index) => ({
    rechargement,
    m: rows[index]?.m ?? "",
    m1: rows[index]?.m1 ?? "",
    evol: rows[index]?.evol ?? "",
  }))

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/60">
          <TableHead colSpan={4}>{title}</TableHead>
        </TableRow>
        <TableRow>
          {[
            "Rechargement",
            "M",
            "M+1",
            "Evol",
          ].map((header) => (
            <TableHead key={header} className={header !== "Rechargement" ? "text-right" : undefined}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {normalizedRows.map((row, index) => (
          <TableRow key={`e-payement-${index}`}>
            <TableCell>{row.rechargement}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.evol)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TotalEncaissementTable({ rows }: { rows: TotalEncaissementRow[] }) {
  const row = rows[0] ?? { mGp: "", mB2b: "", m1Gp: "", m1B2b: "", evol: "-" }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={3}>Encaissement (MDA)</TableHead>
          <TableHead colSpan={2} className="text-center">M</TableHead>
          <TableHead colSpan={2} className="text-center">M+1</TableHead>
          <TableHead rowSpan={3} className="text-center">Evol</TableHead>
        </TableRow>
        <TableRow>
          <TableHead colSpan={2} className="text-center">Sous-colonnes</TableHead>
          <TableHead colSpan={2} className="text-center">Sous-colonnes</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">GP</TableHead>
          <TableHead className="text-right">B2B</TableHead>
          <TableHead className="text-right">GP</TableHead>
          <TableHead className="text-right">B2B</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Encaissements</TableCell>
          <TableCell className="text-right font-semibold">{fmt(row.mGp)}</TableCell>
          <TableCell className="text-right font-semibold">{fmt(row.mB2b)}</TableCell>
          <TableCell className="text-right font-semibold">{fmt(row.m1Gp)}</TableCell>
          <TableCell className="text-right font-semibold">{fmt(row.m1B2b)}</TableCell>
          <TableCell className="text-center">{row.evol || "-"}</TableCell>
        </TableRow>
        <TableRow className="font-bold bg-muted">
          <TableCell>Total</TableCell>
          <TableCell className="text-right font-bold">{fmt(row.mGp || "0")}</TableCell>
          <TableCell className="text-right font-bold">{fmt(row.mB2b || "0")}</TableCell>
          <TableCell className="text-right font-bold">{fmt(row.m1Gp || "0")}</TableCell>
          <TableCell className="text-right font-bold">{fmt(row.m1B2b || "0")}</TableCell>
          <TableCell className="text-center">{row.evol || "-"}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function RecouvrementTable({ rows }: { rows: RecouvrementRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={3}>Recouvrement (MDA)</TableHead>
          <TableHead colSpan={2} className="text-center">M</TableHead>
          <TableHead colSpan={2} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead colSpan={2} className="text-center">Sous-colonnes</TableHead>
          <TableHead colSpan={2} className="text-center">Sous-colonnes</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">GP</TableHead>
          <TableHead className="text-right">B2B</TableHead>
          <TableHead className="text-right">GP</TableHead>
          <TableHead className="text-right">B2B</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`recouvrement-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mGp)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mB2b)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Gp)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1B2b)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RealisationTechniqueReseauTable({ rows }: { rows: RealisationTechniqueReseauRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Realisations techniques</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`realisation-technique-${index}`}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SituationReseauTable({ rows }: { rows: SituationReseauRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Situation Reseaux</TableHead>
          <TableHead>Equipements</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`situation-reseau-${index}`}>
            <TableCell>{row.situation}</TableCell>
            <TableCell className="whitespace-pre-line">{row.equipements}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TraficDataTable({ rows }: { rows: TraficDataRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Trafic Data (TB)</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`trafic-data-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AmeliorationQualiteTable({ rows }: { rows: AmeliorationQualiteRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Debit MBPS/wtilaya</TableHead>
          <TableHead colSpan={2} className="text-center">M</TableHead>
          <TableHead colSpan={2} className="text-center">M+1</TableHead>
          <TableHead rowSpan={2} className="text-center">ecart</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`amelioration-qualite-${index}`}>
            <TableCell>{row.wilaya}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mObjectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mRealise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Objectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Realise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.ecart)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CouvertureReseauTable({ rows }: { rows: CouvertureReseauRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Debit Couverture Resau/wtilaya</TableHead>
          <TableHead colSpan={2} className="text-center">M</TableHead>
          <TableHead colSpan={2} className="text-center">M+1</TableHead>
          <TableHead rowSpan={2} className="text-center">ecart</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`couverture-reseau-${index}`}>
            <TableCell>{row.wilaya}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mObjectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mRealise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Objectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Realise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.ecart)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ActionNotableReseauTable({ rows }: { rows: ActionNotableReseauRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Action</TableHead>
          <TableHead rowSpan={2}>Objectif 2025</TableHead>
          <TableHead colSpan={3} className="text-center">M</TableHead>
          <TableHead colSpan={3} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`action-notable-reseau-${index}`}>
            <TableCell>{row.action}</TableCell>
            <TableCell>{row.objectif2025}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mObjectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mRealise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mTaux)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Objectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Realise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Taux)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DisponibiliteReseauTable({ rows }: { rows: DisponibiliteReseauRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Designations</TableHead>
          <TableHead colSpan={3} className="text-center">M</TableHead>
          <TableHead colSpan={3} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`disponibilite-reseau-${index}`}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mObjectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mRealise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mTaux)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Objectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Realise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Taux)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DesactivationResiliationTable({ rows }: { rows: DesactivationResiliationRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Desactivation / Resiliation</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Evol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`desactivation-resiliation-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.evol)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ParcAbonnesB2BTable({ rows }: { rows: ParcAbonnesB2BRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Parc Abonnes B2B</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Evol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`parc-abonnes-b2b-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.evol)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MttrTable({ rows }: { rows: MttrRegionRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>MTTR / DR</TableHead>
          <TableHead colSpan={3} className="text-center">M</TableHead>
          <TableHead colSpan={3} className="text-center">M+1</TableHead>
          <TableHead rowSpan={2} className="text-right">Ecart</TableHead>
        </TableRow>
        <TableRow>
          <TableHead>Wilaya</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead>Wilaya</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((region, regionIndex) =>
          (region.cities ?? []).map((city, cityIndex) => (
            <TableRow key={`mttr-${regionIndex}-${cityIndex}`}>
              {cityIndex === 0 && <TableCell rowSpan={region.cities.length}>{region.region}</TableCell>}
              <TableCell>{city.wilayaM}</TableCell>
              <TableCell className="text-right font-semibold">{fmt(city.objectifM)}</TableCell>
              <TableCell className="text-right font-semibold">{fmt(city.realiseM)}</TableCell>
              <TableCell>{city.wilayaM1}</TableCell>
              <TableCell className="text-right font-semibold">{fmt(city.objectifM1)}</TableCell>
              <TableCell className="text-right font-semibold">{fmt(city.realiseM1)}</TableCell>
              <TableCell className="text-right font-semibold">{fmt(city.ecart)}</TableCell>
            </TableRow>
          )),
        )}
      </TableBody>
    </Table>
  )
}

function CreancesContentieusesTable({ rows }: { rows: CreancesContentieusesRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Creances Contentieuses</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Evol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`creances-contentieuses-${index}`}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.evol)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function FraisPersonnelTable({ rows }: { rows: FraisPersonnelRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Frais personnel (MDA)</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`frais-personnel-${index}`}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function EffectifGspTable({ rows }: { rows: EffectifGspRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>GSP</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Part %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`effectif-gsp-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.gsp}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.part)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AbsenteismeTable({ rows }: { rows: AbsenteismeRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Absenteisme (jours)</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Part %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`absenteisme-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.motif}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.part)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MouvementEffectifsTable({ rows }: { rows: MouvementEffectifsRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Mouvement des effectifs</TableHead>
          <TableHead rowSpan={2}>Type d'operation</TableHead>
          <TableHead colSpan={4} className="text-center">M</TableHead>
          <TableHead colSpan={4} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Cadres Sup</TableHead>
          <TableHead className="text-right">Cadres</TableHead>
          <TableHead className="text-right">Maitrise</TableHead>
          <TableHead className="text-right">Execution</TableHead>
          <TableHead className="text-right">Cadres Sup</TableHead>
          <TableHead className="text-right">Cadres</TableHead>
          <TableHead className="text-right">Maitrise</TableHead>
          <TableHead className="text-right">Execution</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`mouvement-effectifs-${index}`} className={row.operation === "TOTAL" ? "font-bold bg-muted" : ""}>
            {index === 0 && <TableCell rowSpan={6}>Arrives</TableCell>}
            {index === 6 && <TableCell rowSpan={10}>Departs</TableCell>}
            <TableCell>{row.operation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mCadresSup)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mCadres)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mMaitrise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mExecution)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1CadresSup)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Cadres)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Maitrise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Execution)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MouvementEffectifsDomaineTable({ rows }: { rows: MouvementEffectifsDomaineRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Mouvement des effectifs par Domaine</TableHead>
          <TableHead rowSpan={2}>Domaine</TableHead>
          <TableHead colSpan={3} className="text-center">M</TableHead>
          <TableHead colSpan={3} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">CDI</TableHead>
          <TableHead className="text-right">CDD</TableHead>
          <TableHead className="text-right">CTA</TableHead>
          <TableHead className="text-right">CDI</TableHead>
          <TableHead className="text-right">CDD</TableHead>
          <TableHead className="text-right">CTA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`mouvement-effectifs-domaine-${index}`} className={row.domaine === "TOTAL" ? "font-bold bg-muted" : ""}>
            {index === 0 && <TableCell rowSpan={5}>Recrutement</TableCell>}
            {index === 5 && <TableCell rowSpan={5}>Sortant</TableCell>}
            <TableCell>{row.domaine}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mCdi)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mCdd)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mCta)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Cdi)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Cdd)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Cta)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CompteResultatTable({ rows }: { rows: CompteResultatRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Designations</TableHead>
          <TableHead colSpan={3} className="text-center">M</TableHead>
          <TableHead colSpan={3} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`compte-resultat-${index}`}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mBudget)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mRealise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mTaux)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Budget)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Realise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Taux)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function EffectifsFormesGspTable({ rows }: { rows: EffectifsFormesGspRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Effectifs Formes par GSP</TableHead>
          <TableHead colSpan={3} className="text-center">M</TableHead>
          <TableHead colSpan={3} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`effectifs-formes-gsp-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.gsp}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mObjectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mRealise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mTaux)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Objectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Realise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Taux)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function FormationsDomainesTable({ rows }: { rows: FormationsDomainesRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Domaines</TableHead>
          <TableHead colSpan={3} className="text-center">M</TableHead>
          <TableHead colSpan={3} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`formations-domaines-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.domaine}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mObjectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mRealise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mTaux)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Objectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Realise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Taux)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ParcAbonnesGpTable({ rows }: { rows: ParcAbonnesGpRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Parc Abonnes GP</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Evol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`parc-abonnes-gp-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.evol)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TotalParcAbonnesTable({ rows }: { rows: TotalParcAbonnesRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Total Parc Abonnes</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Evol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`total-parc-abonnes-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.evol)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TotalParcAbonnesTechnologieTable({ rows }: { rows: TotalParcAbonnesTechnologieRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Total Parc Abonnes parc technologie</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Evol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`total-parc-abonnes-tech-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.evol)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ActivationTable({ rows }: { rows: ActivationRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Activation</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">M+1</TableHead>
          <TableHead className="text-right">Evol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`activation-${index}`} className={index === (rows.length - 1) ? "font-bold bg-muted" : ""}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.evol)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ChiffreAffairesMdaTable({ rows }: { rows: ChiffreAffairesMdaRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Chiffre d'Affaires (MDA)</TableHead>
          <TableHead colSpan={3} className="text-center">M</TableHead>
          <TableHead colSpan={3} className="text-center">M+1</TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
          <TableHead className="text-right">Objectif</TableHead>
          <TableHead className="text-right">Realise</TableHead>
          <TableHead className="text-right">Taux</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(rows ?? []).map((row, index) => (
          <TableRow key={`chiffre-affaires-mda-${index}`}>
            <TableCell>{row.designation}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mObjectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mRealise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.mTaux)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Objectif)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Realise)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(row.m1Taux)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TabDataView({ tabKey, decl, color }: { tabKey: string; decl: SavedDeclaration; color: string }) {
  switch (tabKey) {
    case "encaissement":  return <EncTable rows={decl.encRows ?? []} />
    case "tva_immo":      return <TvaTable rows={decl.tvaImmoRows ?? []} totalLabel="TOTAL TVA SUR IMMOBILISATION 445620" />
    case "tva_biens":     return <TvaTable rows={decl.tvaBiensRows ?? []} totalLabel="TOTAL TVA SUR BIENS ET SERVICES" />
    case "droits_timbre": return <TimbreTable rows={decl.timbreRows ?? []} />
    case "ca_tap":        return <CATable b12={decl.b12 ?? ""} b13={decl.b13 ?? ""} />
    case "etat_tap":      return <TAPTable rows={decl.tapRows ?? []} />
    case "ca_siege":      return <CaSiegeTable rows={decl.caSiegeRows ?? []} />
    case "irg":           return <IrgTable rows={decl.irgRows ?? []} />
    case "taxe2":         return <Taxe2Table rows={decl.taxe2Rows ?? []} />
    case "taxe_masters":  return <MastersTable rows={decl.masterRows ?? []} />
    case "taxe_vehicule": return <Taxe11Table montant={decl.taxe11Montant ?? ""} />
    case "taxe_formation":return <Taxe12Table rows={decl.taxe12Rows ?? []} />
    case "acompte":       return <AcompteTable months={decl.acompteMonths ?? []} annee={decl.annee} />
    case "ibs":           return <Ibs14Table rows={decl.ibs14Rows ?? []} />
    case "taxe_domicil":  return <Taxe15Table rows={decl.taxe15Rows ?? []} />
    case "tva_autoliq":   return <Tva16Table rows={decl.tva16Rows ?? []} />
    case "e_payement_pop": return <EPayementTable rows={decl.ePayementPopRows ?? []} title="E-PAYEMENT Pop (MDA)" />
    case "e_payement_prp": return <EPayementTable rows={decl.ePayementPrpRows ?? []} title="E-PAYEMENT Prp (MDA)" />
    case "e_payement":     return <EPayementTable rows={decl.ePayementPopRows ?? []} title="E-PAYEMENT Pop (MDA)" />
    case "total_encaissement": return <TotalEncaissementTable rows={decl.totalEncaissementRows ?? []} />
    case "recouvrement": return <RecouvrementTable rows={decl.recouvrementRows ?? []} />
    case "realisation_technique_reseau": return <RealisationTechniqueReseauTable rows={decl.realisationTechniqueReseauRows ?? []} />
    case "situation_reseau": return <SituationReseauTable rows={decl.situationReseauRows ?? []} />
    case "trafic_data": return <TraficDataTable rows={decl.traficDataRows ?? []} />
    case "amelioration_qualite": return <AmeliorationQualiteTable rows={decl.ameliorationQualiteRows ?? []} />
    case "couverture_reseau": return <CouvertureReseauTable rows={decl.couvertureReseauRows ?? []} />
    case "action_notable_reseau": return <ActionNotableReseauTable rows={decl.actionNotableReseauRows ?? []} />
    case "disponibilite_reseau": return <DisponibiliteReseauTable rows={decl.disponibiliteReseauRows ?? []} />
    case "desactivation_resiliation": return <DesactivationResiliationTable rows={decl.desactivationResiliationRows ?? []} />
    case "parc_abonnes_b2b": return <ParcAbonnesB2BTable rows={decl.parcAbonnesB2bRows ?? []} />
    case "mttr": return <MttrTable rows={decl.mttrRows ?? []} />
    case "creances_contentieuses": return <CreancesContentieusesTable rows={decl.creancesContentieusesRows ?? []} />
    case "frais_personnel": return <FraisPersonnelTable rows={decl.fraisPersonnelRows ?? []} />
    case "effectif_gsp": return <EffectifGspTable rows={decl.effectifGspRows ?? []} />
    case "absenteisme": return <AbsenteismeTable rows={decl.absenteismeRows ?? []} />
    case "mouvement_effectifs": return <MouvementEffectifsTable rows={decl.mouvementEffectifsRows ?? []} />
    case "mouvement_effectifs_domaine": return <MouvementEffectifsDomaineTable rows={decl.mouvementEffectifsDomaineRows ?? []} />
    case "compte_resultat": return <CompteResultatTable rows={decl.compteResultatRows ?? []} />
    case "effectifs_formes_gsp": return <EffectifsFormesGspTable rows={decl.effectifsFormesGspRows ?? []} />
    case "formations_domaines": return <FormationsDomainesTable rows={decl.formationsDomainesRows ?? []} />
    case "parc_abonnes_gp": return <ParcAbonnesGpTable rows={decl.parcAbonnesGpRows ?? []} />
    case "total_parc_abonnes": return <TotalParcAbonnesTable rows={decl.totalParcAbonnesRows ?? []} />
    case "total_parc_abonnes_technologie": return <TotalParcAbonnesTechnologieTable rows={decl.totalParcAbonnesTechnologieRows ?? []} />
    case "activation": return <ActivationTable rows={decl.activationRows ?? []} />
    case "chiffre_affaires_mda": return <ChiffreAffairesMdaTable rows={decl.chiffreAffairesMdaRows ?? []} />
    default:              return null
  }
}

// aaa Print Zone aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
function DashPrintZone({ decl, tabKey, tabTitle }: {
  decl: SavedDeclaration | null; tabKey: string; tabTitle: string; color: string
}) {
  if (!decl) return null
  const moisLabel = MONTHS[decl.mois] ?? decl.mois
  return (
    <div id="dash-print-zone" style={{ fontFamily: "Arial, sans-serif", color: "#000" }}>
      {/* aa Header aa */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 100 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" style={{ height: 64, objectFit: "contain" }} />
          <div style={{ width: 260, border: "3px solid #000", backgroundColor: "#fff" }}>
            <div
              style={{
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                textAlign: "left",
                direction: "ltr",
                padding: "0 10px",
                borderBottom: "3px solid #000",
                fontSize: 13,
                fontWeight: 700,
                color: "#000",
                textTransform: "uppercase",
              }}
            >
              ATM MOBILIS
            </div>
            <div
              style={{
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                textAlign: "left",
                direction: "ltr",
                padding: "0 10px",
                fontSize: 13,
                fontWeight: 700,
                color: "#000",
              }}
            >
              DR : {decl.direction || "a"}
            </div>
          </div>
        </div>
        <div
          style={{
            width: 260,
            border: "3px solid #000",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              textAlign: "left",
              direction: "ltr",
              padding: "0 10px",
              borderBottom: "3px solid #000",
              fontSize: 13,
              fontWeight: 700,
              color: "#000",
            }}
          >
            Déclaration Mois : {moisLabel}
          </div>
          <div
            style={{
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              textAlign: "left",
              direction: "ltr",
              padding: "0 10px",
              fontSize: 13,
              fontWeight: 700,
              color: "#000",
            }}
          >
            Annee : {decl.annee}
          </div>
        </div>
      </div>
      {/* aa Centered title aa */}
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#222", marginBottom: 160 }}>
        {tabTitle}
      </div>
      {/* aa Table aa */}
      <TabDataView tabKey={tabKey} decl={decl} color="#555" />
    </div>
  )
}

export default function FiscaDashboardPage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const router = useRouter()
  const { toast } = useToast()
  const [declarations, setDeclarations] = useState<SavedDeclaration[]>([])
  const [recaps, setRecaps] = useState<SavedRecap[]>([])
  const [viewDecl, setViewDecl] = useState<SavedDeclaration | null>(null)
  const [viewRecap, setViewRecap] = useState<SavedRecap | null>(null)
  const [printDecl, setPrintDecl] = useState<SavedDeclaration | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showRecapDialog, setShowRecapDialog] = useState(false)
  const [showRecapFilters, setShowRecapFilters] = useState(false)
  const [viewTabKey, setViewTabKey] = useState<string>("encaissement")
  const [filterType, setFilterType] = useState("")
  const [filterMois, setFilterMois] = useState("")
  const [filterAnnee, setFilterAnnee] = useState("")
  const [filterDirection, setFilterDirection] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [recapFilterMois, setRecapFilterMois] = useState("")
  const [recapFilterAnnee, setRecapFilterAnnee] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [sortCol, setSortCol] = useState<"type"|"direction"|"periode"|"date">("date")
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc")
  const [regions, setRegions] = useState<Array<{ id: number; name: string }>>([])
  const [refreshRevision, setRefreshRevision] = useState(0)
  const isAdminRole = true
  const canApproveRegionalDeclarations = true
  const canApproveFinanceDeclarations = true

  useEffect(() => {
    if (!user || status !== "authenticated") {
      setRecaps([])
      return
    }

    let cancelled = false

    const loadRecaps = async () => {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
        const response = await fetch(`${API_BASE}/api/fiscal-recaps`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })

        if (!response.ok) {
          if (!cancelled) setRecaps([])
          return
        }

        const payload = await response.json().catch(() => null)
        const nextRecaps: SavedRecap[] = Array.isArray(payload)
          ? (payload as ApiFiscalRecap[]).map((item) => {
              let rows: Record<string, string>[] = []
              try {
                const parsedRows = JSON.parse(item.rowsJson ?? "[]")
                rows = Array.isArray(parsedRows) ? (parsedRows as Record<string, string>[]) : []
              } catch {
                rows = []
              }

              return {
                id: String(item.id),
                key: String(item.key ?? ""),
                title: String(item.title ?? ""),
                mois: String(item.mois ?? ""),
                annee: String(item.annee ?? ""),
                createdAt: String(item.updatedAt ?? item.createdAt ?? new Date().toISOString()),
                rows,
              }
            })
          : []

        if (!cancelled) {
          setRecaps(nextRecaps)
        }
      } catch {
        if (!cancelled) setRecaps([])
      }
    }

    loadRecaps()

    return () => {
      cancelled = true
    }
  }, [status, user])

  useEffect(() => {
    if (!user || status !== "authenticated") {
      setDeclarations([])
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
          if (!cancelled) setDeclarations([])
          return
        }

        const payload = await response.json().catch(() => null)
        const nextDeclarations = Array.isArray(payload)
          ? (payload as ApiFiscalDeclaration[]).map(mapApiDeclarationToSaved)
          : []

        if (!cancelled) {
          setDeclarations(nextDeclarations)
          try {
            localStorage.setItem("fiscal_declarations", JSON.stringify(nextDeclarations))
          } catch {
            // Ignore storage errors.
          }
        }
      } catch {
        if (!cancelled) setDeclarations([])
      }
    }

    loadDeclarations()

    return () => {
      cancelled = true
    }
  }, [refreshRevision, status, user])

  useEffect(() => {
    if (!user || status !== "authenticated") {
      return
    }
  }, [status, user])

  useEffect(() => {
    if (!user || status !== "authenticated") {
      setRegions([])
      return
    }

    let cancelled = false

    const loadRegions = async () => {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
        const response = await fetch(`${API_BASE}/api/regions`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })

        if (!response.ok) {
          if (!cancelled) setRegions([])
          return
        }

        const payload = await response.json().catch(() => null)
        const nextRegions = Array.isArray(payload)
          ? payload
              .map((item) => ({
                id: Number((item as { id?: unknown }).id ?? 0),
                name: String((item as { name?: unknown }).name ?? "").trim(),
              }))
              .filter((item) => item.name.length > 0)
          : []

        if (!cancelled) {
          setRegions(nextRegions)
        }
      } catch {
        if (!cancelled) setRegions([])
      }
    }

    loadRegions()

    return () => {
      cancelled = true
    }
  }, [status, user])

  if (isLoading || !user || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  const isDeclarationLocked = (decl: SavedDeclaration) => isFiscalPeriodLocked(decl.mois, decl.annee, user.role)

  const showPeriodLockedToast = (decl: SavedDeclaration, actionLabel: "modifier" | "supprimer") => {
    toast({
      title: "Période clôturée",
      description: `${getFiscalPeriodLockMessage(decl.mois, decl.annee, user.role)} Impossible de ${actionLabel} cette déclaration.`,
      variant: "destructive",
    })
  }

  const handleDelete = async (decl: SavedDeclaration) => {
    if (isDeclarationLocked(decl)) {
      showPeriodLockedToast(decl, "supprimer")
      return
    }

    try {
      const declarationId = Number(decl.id)
      if (!Number.isFinite(declarationId)) {
        throw new Error("ID de déclaration invalide")
      }

      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      const response = await fetch(`${API_BASE}/api/fiscal/${declarationId}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message ?? "")
          : ""
        throw new Error(message || "Suppression impossible")
      }

      const updated = declarations.filter((d) => d.id !== decl.id)
      setDeclarations(updated)
      try {
        localStorage.setItem("fiscal_declarations", JSON.stringify(updated))
      } catch {
        // Ignore storage errors.
      }
      setRefreshRevision((prev) => prev + 1)

      toast({ title: "Déclaration supprimée" })
    } catch (error) {
      toast({
        title: "Erreur de suppression",
        description: error instanceof Error ? error.message : "Impossible de supprimer la déclaration.",
        variant: "destructive",
      })
    }
  }

  const handleView = (decl: SavedDeclaration, tabKey: string) => {
    setViewDecl(decl)
    setViewTabKey(tabKey)
    setShowDialog(true)
  }

  const handlePrint = (decl: SavedDeclaration, tabKey: string) => {
    setPrintDecl(decl)
    setViewTabKey(tabKey)
    setTimeout(async () => {
      const printZone = document.getElementById("dash-print-zone")
      const tableElement = printZone?.querySelector("table") as HTMLTableElement | null
      if (!printZone || !tableElement) return

      try {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
          import("jspdf"),
          import("jspdf-autotable"),
        ])

        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
        const periodText = `${MONTHS[decl.mois] ?? decl.mois} ${decl.annee}`
        const tableTitle = DASH_TABS.find((t) => t.key === tabKey)?.title ?? "TABLEAU FISCAL"
        const pdfTableTitle =
          tabKey === "ca_tap"
            ? "ETAT DU CHIFFRE D'AFFAIRES RECHARGEMENT HT (7%) et CHIFFRE D'AFFAIRES GLOBAL HT (1%)"
            : tableTitle
        const headerTitle = `${pdfTableTitle} ${periodText}`.trim()
        const layoutShiftY = tabKey === "ca_siege" ? -10 : 0

        if (tabKey === "tva_immo" || tabKey === "tva_biens") {
          const rows = tabKey === "tva_immo" ? (decl.tvaImmoRows ?? []) : (decl.tvaBiensRows ?? [])
          const totalLabel = tabKey === "tva_immo"
            ? "TOTAL TVA SUR\nIMMOBILISATION 445620"
            : "TOTAL TVA SUR\nBIENS ET SERVICES 445660"

          const tHT = rows.reduce((s, r) => s + num(r.montantHT), 0)
          const tTVA = rows.reduce((s, r) => s + getTvaAmount(r, true), 0)
          const tTTC = tHT + tTVA

          const drawBox = (x: number, y: number, w: number, h: number) => {
            pdf.setDrawColor(0, 0, 0)
            pdf.setLineWidth(0.5)
            pdf.rect(x, y, w, h)
          }

          const write = (
            text: string,
            x: number,
            y: number,
            style: "normal" | "bold" | "italic" | "bolditalic" = "normal",
            size = 10,
            align: "left" | "center" | "right" = "left",
          ) => {
            pdf.setFont("times", style)
            pdf.setFontSize(size)
            pdf.text(text, x, y, { align })
          }

          // Bloc gauche: Année / Mois / Direction
          drawBox(10, 10, 60, 22)
          write("Année:", 14, 16.8, "bold")
          write("Mois de :", 14, 22.6, "bold")
          write("Direction :", 14, 29.0, "bold")
          write(String(decl.annee ?? ""), 40, 16.8)
          write(String(MONTHS[decl.mois] ?? decl.mois ?? ""), 40, 22.6)
          write(String(decl.direction ?? ""), 40, 29.0)

          // Bloc droite: Identité entreprise
          drawBox(90, 15, 135, 40)
          write("M.", 93, 21.2, "bold")
          write("Activité:", 93, 26.8, "bold")
          write("Adresse:", 93, 32.4, "bold")
          write("NIF / NIS", 93, 38.0, "bold")
          write("TIN", 93, 43.6, "bold")
          write("AI", 93, 49.2, "bold")

          write("ATM MOBILIS", 155, 21.2, "bold", 10, "center")
          write("TELEPHONIE MOBILE", 155, 26.8, "bold", 9, "center")
          write("QUARTIER DES AFFAIRES GROUPE 05 ILOT 27,28 ET 29 BAB EZZOUAR", 162, 32.4, "bold", 8, "center")
          write("316096228742", 155, 38.0, "bold", 9, "center")
          write("67547", 155, 43.6, "bold", 9, "center")

          // Titre encadré
          drawBox(8, 72, 281, 20)
          write("Etat de déduction de la TVA", 148.5, 81.5, "bolditalic", 16, "center")
          write("(Conformément à l'article 29 tel modifié par l'article 42 de la Loi de Finances pour 2021)", 148.5, 88.5, "italic", 10, "center")

          const head = [[
            "Nom et prénoms /Raison sociale",
            "Adresse",
            "NIF",
            "Authentification du NIF",
            "RC n°",
            "Authentification du n°RC",
            "Facture n°",
            "Date",
            "Montant HT",
            "TVA",
            "Montant TTC",
          ]]

          const bodyRows = rows.map((r) => {
            const rowTva = getTvaAmount(r, true)
            return [
              textForPdf(r.nomRaisonSociale),
              textForPdf(r.adresse),
              textForPdf(r.nif),
              textForPdf(r.authNif),
              textForPdf(r.numRC),
              textForPdf(r.authRC),
              textForPdf(r.numFacture),
              textForPdf(r.dateFacture),
              fmt(r.montantHT),
              fmt(rowTva),
              fmt(num(r.montantHT) + rowTva),
            ]
          })

          const totalRow = [
            { content: "", colSpan: 6, styles: { fillColor: [227, 186, 186], textColor: [0, 0, 0] } },
            { content: totalLabel, colSpan: 2, styles: { fillColor: [19, 175, 229], textColor: [0, 0, 0], halign: "center", fontStyle: "bold", fontSize: 6.4 } },
            { content: fmt(tHT), styles: { fillColor: [255, 0, 0], textColor: [0, 0, 0], halign: "center", fontStyle: "bold" } },
            { content: fmt(tTVA), styles: { fillColor: [255, 0, 0], textColor: [0, 0, 0], halign: "center", fontStyle: "bold" } },
            { content: fmt(tTTC), styles: { fillColor: [255, 0, 0], textColor: [0, 0, 0], halign: "center", fontStyle: "bold" } },
          ]

          autoTable(pdf, {
            head,
            body: [...bodyRows, totalRow as unknown as (string | number)[]],
            startY: 104,
            theme: "grid",
            margin: { left: 8, right: 8, top: 104, bottom: 8 },
            styles: {
              font: "times",
              fontSize: 7.4,
              cellPadding: 0.8,
              lineColor: [0, 0, 0],
              lineWidth: 0.2,
              textColor: [0, 0, 0],
              overflow: "linebreak",
              valign: "middle",
            },
            headStyles: {
              fillColor: [208, 208, 208],
              textColor: [0, 0, 0],
              font: "times",
              fontStyle: "bold",
              fontSize: 8.2,
              cellPadding: 1.3,
              minCellHeight: 9,
              halign: "center",
            },
            columnStyles: {
              0: { halign: "left", cellWidth: 44 },
              1: { halign: "left", cellWidth: 30 },
              2: { halign: "center", cellWidth: 18 },
              3: { halign: "center", cellWidth: 31 },
              4: { halign: "center", cellWidth: 20 },
              5: { halign: "center", cellWidth: 36 },
              6: { halign: "center", cellWidth: 23 },
              7: { halign: "center", cellWidth: 20 },
              8: { halign: "center", cellWidth: 21 },
              9: { halign: "center", cellWidth: 18 },
              10: { halign: "center", cellWidth: 21 },
            },
            didParseCell: (data) => {
              data.cell.text = data.cell.text.map((line) =>
                line.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim(),
              )

              // Lignes normales: plus hautes que l'actuel, mais plus basses que l'entête
              if (data.section === "body" && data.row.index < bodyRows.length) {
                data.cell.styles.minCellHeight = 8.4
                data.cell.styles.cellPadding = 1.0
              }

              // Ligne de total (dernière ligne du body): hauteur renforcée
              if (data.section === "body" && data.row.index === bodyRows.length) {
                data.cell.styles.minCellHeight = 12
                data.cell.styles.cellPadding = 1.4
              }
            },
          })

          const blobUrl = URL.createObjectURL(pdf.output("blob"))
          window.open(blobUrl, "_blank")
          return
        }

        const drawUnderlinedText = (text: string, x: number, y: number) => {
          pdf.text(text, x, y)
          const width = pdf.getTextWidth(text)
          pdf.setLineWidth(0.2)
          pdf.line(x, y + 0.6, x + width, y + 0.6)
        }

        const logo = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
          img.src = "/logo_doc.png"
        })

        // Logo en haut à gauche
        if (logo) {
          pdf.addImage(logo, "PNG", 10, 12 + layoutShiftY, 40, 15)
        }

        pdf.setFont("times", "bold")
        pdf.setFontSize(11)
        drawUnderlinedText("ATM MOBILIS SPA", 10, 33 + layoutShiftY)
        drawUnderlinedText("DIRECTION DES FINANCES ET DE LA COMPTABILITE", 10, 38 + layoutShiftY)
        drawUnderlinedText("SOUS DIRECTION FISCALITE", 10, 43 + layoutShiftY)
        pdf.setFontSize(14)
        drawUnderlinedText(headerTitle, 10, 64 + layoutShiftY)

        const rawHeaders = Array.from(tableElement.querySelectorAll("thead th")).map((cell) =>
          String(cell.textContent ?? "").trim(),
        )
        const hideIndexColumn = rawHeaders[0] === "#"
        const tableHead = [hideIndexColumn ? rawHeaders.slice(1) : rawHeaders]

        // Tableau 14 (IBS): headers multilignes pour améliorer la lisibilité et tenir sur une seule feuille.
        if (tabKey === "ibs") {
          tableHead[0] = [
            "NUMERO DE\nFACTURE",
            "MONTANT BRUT\nEN DEVISES",
            "TAUX DE CHANGE\nDATE DU CONTRAT",
            "MONTANT BRUT\nEN DINARS",
            "MONTANT NET\nTRANSFERABLE\nEN DEVISES",
            "MONTANT DE L'IBS\n(Taux ...%)",
            "MONTANT NET\nTRANSFERABLE\nEN DINARS",
          ]
        }

        const tableBody = Array.from(tableElement.querySelectorAll("tbody tr, tfoot tr")).map((row) => {
          const rowCells = Array.from(row.querySelectorAll("td")).map((cell) => {
            let text = String(cell.textContent ?? "").trim()
            text = text.replace(/\u00A0/g, " ")
            text = text.replace(/\s+/g, " ")
            const colSpan = Number(cell.getAttribute("colspan") ?? "1")

            if (colSpan > 1) {
              return { content: text, colSpan }
            }

            return text
          })

          if (!hideIndexColumn) return rowCells

          const adjusted: Array<string | { content: string; colSpan: number }> = []
          let logicalCol = 0

          for (const cell of rowCells) {
            const span = typeof cell === "string" ? 1 : Math.max(1, cell.colSpan)
            const startsAtFirstCol = logicalCol === 0

            if (startsAtFirstCol) {
              if (span === 1) {
                // Drop the leading "#" cell.
              } else {
                const reducedSpan = span - 1
                if (reducedSpan > 1) {
                  adjusted.push({ content: typeof cell === "string" ? cell : cell.content, colSpan: reducedSpan })
                } else if (reducedSpan === 1) {
                  adjusted.push(typeof cell === "string" ? cell : cell.content)
                }
              }
            } else {
              adjusted.push(cell)
            }

            logicalCol += span
          }

          return adjusted
        })

        autoTable(pdf, {
          head: tableHead,
          body: tableBody,
          startY: 74 + layoutShiftY,
          theme: "grid",
          margin: { left: 10, right: 10, top: 74 + layoutShiftY, bottom: 10 },
          styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 1.2,
            minCellHeight: 8.5,
            lineColor: [51, 51, 51],
            lineWidth: 0.2,
            textColor: [0, 0, 0],
            overflow: "linebreak",
            valign: "middle",
          },
          headStyles: {
            fillColor: [45, 179, 75],
            textColor: [255, 255, 255],
            font: "helvetica",
            fontStyle: "bold",
            fontSize: tabKey === "ibs" ? 8 : 9,
            halign: "center",
            valign: "middle",
            cellPadding: tabKey === "ibs" ? 1.8 : 1.2,
            minCellHeight: tabKey === "ibs" ? 15 : 9,
          },
          bodyStyles: {
            textColor: [0, 0, 0],
            font: "helvetica",
            fontSize: 9,
          },
          columnStyles:
            tabKey === "ibs"
              ? {
                  0: { halign: "left", cellWidth: 33 },
                  1: { halign: "center", cellWidth: 35 },
                  2: { halign: "center", cellWidth: 40 },
                  3: { halign: "center", cellWidth: 34 },
                  4: { halign: "center", cellWidth: 45 },
                  5: { halign: "center", cellWidth: 38 },
                  6: { halign: "center", cellWidth: 42 },
                }
              : Array(tableHead[0]?.length ?? 0)
                  .fill(null)
                  .map((_, i) =>
                    i === 0
                      ? { halign: "left", cellWidth: "auto" }
                      : { halign: "center", cellWidth: "auto" }
                  ),
          didParseCell: (data) => {
            if (!(tabKey === "ibs" && data.section === "head")) {
              data.cell.text = data.cell.text.map((line) =>
                line
                  .replace(/\u00A0/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
              )
            }

            if (data.section === "body") {
              const rawText = String(data.cell.text?.[0] ?? data.cell.raw ?? "")
              const numericCandidate = rawText
                .replace(/\u00A0/g, " ")
                .trim()
                .replace(/\s+/g, "")
                .replace(/,/g, ".")
              const isAmount = /^-?\d+(\.\d+)?$/.test(numericCandidate)
              data.cell.styles.halign = isAmount ? "center" : "left"
              data.cell.styles.valign = "middle"
            }

            const rowValues = Array.isArray(data.row.raw)
              ? data.row.raw.map((value) => String(value ?? "").toLowerCase())
              : []
            const isTotalRow = data.section === "body" && rowValues.some((value) => value.includes("total"))

            if (isTotalRow) {
              data.cell.styles.fillColor = [45, 179, 75]
              data.cell.styles.textColor = [255, 255, 255]
              data.cell.styles.fontStyle = "bold"
            }
          },
          horizontalPageBreak: true,
          horizontalPageBreakRepeat: [0],
        })

        const blobUrl = URL.createObjectURL(pdf.output("blob"))
        window.open(blobUrl, "_blank")
      } catch (err) {
        console.error("PDF generation failed", err)
      }
    }, 200)
  }

  const handleEdit = (decl: SavedDeclaration, tabKey: string) => {
    if (isDeclarationLocked(decl)) {
      showPeriodLockedToast(decl, "modifier")
      return
    }

    router.push(`/declaration?editId=${encodeURIComponent(decl.id)}&tab=${encodeURIComponent(tabKey)}`)
  }

  const handleApprove = async (decl: SavedDeclaration) => {
    if (!isAdminRole && !canApproveRegionalDeclarations && !canApproveFinanceDeclarations) {
      toast({
        title: "Accès refusé",
        description: "Seuls les comptes admin ou approbateurs (régional/finance) peuvent valider les déclarations.",
        variant: "destructive",
      })
      return
    }

    const declarationId = Number(decl.id)
    if (!Number.isFinite(declarationId)) {
      toast({ title: "Erreur", description: "ID de déclaration invalide", variant: "destructive" })
      return
    }

    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      const response = await fetch(`${API_BASE}/api/fiscal/${declarationId}/approve`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message ?? "")
          : "Approbation impossible"
        throw new Error(message)
      }

      const nowIso = new Date().toISOString()
      const updated = declarations.map((item) =>
        item.id === decl.id
          ? {
              ...item,
              isApproved: true,
              approvedAt: typeof payload?.approvedAt === "string" ? payload.approvedAt : nowIso,
              approvedByUserId: typeof payload?.approvedByUserId === "number" ? payload.approvedByUserId : Number(user.id),
            }
          : item,
      )

      setDeclarations(updated)
      try {
        localStorage.setItem("fiscal_declarations", JSON.stringify(updated))
      } catch {
        // Ignore storage errors.
      }
      setRefreshRevision((prev) => prev + 1)

      toast({ title: "Déclaration approuvée" })
    } catch (error) {
      toast({
        title: "Erreur d'approbation",
        description: error instanceof Error ? error.message : "Impossible d'approuver la déclaration.",
        variant: "destructive",
      })
    }
  }

  const getDeclarationType = (decl: SavedDeclaration) => {
    if ((decl.encRows?.length ?? 0) > 0) return { key: "encaissement", label: "Encaissement", color: "#2db34b" }
    if ((decl.tvaImmoRows?.length ?? 0) > 0) return { key: "tva_immo", label: "TVA / IMMO", color: "#1d6fb8" }
    if ((decl.tvaBiensRows?.length ?? 0) > 0) return { key: "tva_biens", label: "TVA / Biens & Serv", color: "#7c3aed" }
    if ((decl.timbreRows?.length ?? 0) > 0) return { key: "droits_timbre", label: "Droits Timbre", color: "#0891b2" }
    if (decl.b12 || decl.b13) return { key: "ca_tap", label: "CA 7% & CA Glob 1%", color: "#ea580c" }
    if ((decl.tapRows?.length ?? 0) > 0) return { key: "etat_tap", label: "ETAT TAP", color: "#be123c" }
    if ((decl.caSiegeRows?.length ?? 0) > 0) return { key: "ca_siege", label: "CA Si\u00e8ge", color: "#854d0e" }
    if ((decl.irgRows?.length ?? 0) > 0) return { key: "irg", label: "Situation IRG", color: "#0f766e" }
    if ((decl.taxe2Rows?.length ?? 0) > 0) return { key: "taxe2", label: "Taxe 2%", color: "#6d28d9" }
    if ((decl.masterRows?.length ?? 0) > 0) return { key: "taxe_masters", label: "Taxe des Master 1,5%", color: "#0369a1" }
    if (decl.taxe11Montant) return { key: "taxe_vehicule", label: "Taxe Vehicule", color: "#92400e" }
    if ((decl.taxe12Rows?.length ?? 0) > 0) return { key: "taxe_formation", label: "Taxe Formation", color: "#065f46" }
    if ((decl.acompteMonths?.length ?? 0) > 0) return { key: "acompte", label: "Acompte Provisionnel", color: "#1e40af" }
    if ((decl.ibs14Rows?.length ?? 0) > 0) return { key: "ibs", label: "IBS Fournisseurs Etrangers", color: "#7c2d12" }
    if ((decl.taxe15Rows?.length ?? 0) > 0) return { key: "taxe_domicil", label: "Taxe Domiciliation", color: "#134e4a" }
    if ((decl.tva16Rows?.length ?? 0) > 0) return { key: "tva_autoliq", label: "TVA Auto Liquidation", color: "#312e81" }
    if ((decl.ePayementPopRows?.length ?? 0) > 0) return { key: "e_payement_pop", label: "E-PAYEMENT Pop", color: "#065f46" }
    if ((decl.ePayementPrpRows?.length ?? 0) > 0) return { key: "e_payement_prp", label: "E-PAYEMENT Prp", color: "#0f766e" }
    if ((decl.totalEncaissementRows?.length ?? 0) > 0) return { key: "total_encaissement", label: "Totale des encaissment", color: "#1e40af" }
    if ((decl.recouvrementRows?.length ?? 0) > 0) return { key: "recouvrement", label: "Recouvrement", color: "#166534" }
    if ((decl.realisationTechniqueReseauRows?.length ?? 0) > 0) return { key: "realisation_technique_reseau", label: "Realisation technique Reseau", color: "#1d4ed8" }
    if ((decl.situationReseauRows?.length ?? 0) > 0) return { key: "situation_reseau", label: "Situation Reseau", color: "#92400e" }
    if ((decl.traficDataRows?.length ?? 0) > 0) return { key: "trafic_data", label: "Trafic Data", color: "#075985" }
    if ((decl.ameliorationQualiteRows?.length ?? 0) > 0) return { key: "amelioration_qualite", label: "Amelioration qualite", color: "#be185d" }
    if ((decl.couvertureReseauRows?.length ?? 0) > 0) return { key: "couverture_reseau", label: "Couverture Reseau", color: "#7c3aed" }
    if ((decl.actionNotableReseauRows?.length ?? 0) > 0) return { key: "action_notable_reseau", label: "Action notable sur le reseau", color: "#a16207" }
    if ((decl.disponibiliteReseauRows?.length ?? 0) > 0) return { key: "disponibilite_reseau", label: "Disponibilite reseau", color: "#0f766e" }
    if ((decl.desactivationResiliationRows?.length ?? 0) > 0) return { key: "desactivation_resiliation", label: "Desactivation / Resiliation", color: "#be123c" }
    if ((decl.parcAbonnesB2bRows?.length ?? 0) > 0) return { key: "parc_abonnes_b2b", label: "Parc Abonnes B2B", color: "#0c4a6e" }
    if ((decl.mttrRows?.length ?? 0) > 0) return { key: "mttr", label: "MTTR", color: "#2db34b" }
    if ((decl.creancesContentieusesRows?.length ?? 0) > 0) return { key: "creances_contentieuses", label: "Creances Contentieuses", color: "#be123c" }
    if ((decl.fraisPersonnelRows?.length ?? 0) > 0) return { key: "frais_personnel", label: "Frais personnel", color: "#1d4ed8" }
    if ((decl.effectifGspRows?.length ?? 0) > 0) return { key: "effectif_gsp", label: "Effectif par GSP", color: "#0369a1" }
    if ((decl.absenteismeRows?.length ?? 0) > 0) return { key: "absenteisme", label: "Absenteisme", color: "#7c3aed" }
    if ((decl.mouvementEffectifsRows?.length ?? 0) > 0) return { key: "mouvement_effectifs", label: "Mouvement des effectifs", color: "#166534" }
    if ((decl.mouvementEffectifsDomaineRows?.length ?? 0) > 0) return { key: "mouvement_effectifs_domaine", label: "Mouvement des effectifs par domaine", color: "#0f766e" }
    if ((decl.compteResultatRows?.length ?? 0) > 0) return { key: "compte_resultat", label: "Compte de resultat", color: "#2db34b" }
    if ((decl.effectifsFormesGspRows?.length ?? 0) > 0) return { key: "effectifs_formes_gsp", label: "Effectifs formes par GSP", color: "#0369a1" }
    if ((decl.formationsDomainesRows?.length ?? 0) > 0) return { key: "formations_domaines", label: "Formations realisees par domaines", color: "#0f766e" }
    if ((decl.parcAbonnesGpRows?.length ?? 0) > 0) return { key: "parc_abonnes_gp", label: "Parc Abonnes GP", color: "#1d4ed8" }
    if ((decl.totalParcAbonnesRows?.length ?? 0) > 0) return { key: "total_parc_abonnes", label: "Total Parc Abonnes", color: "#0369a1" }
    if ((decl.totalParcAbonnesTechnologieRows?.length ?? 0) > 0) return { key: "total_parc_abonnes_technologie", label: "Total Parc Abonnes parc technologie", color: "#0f766e" }
    if ((decl.activationRows?.length ?? 0) > 0) return { key: "activation", label: "Activation", color: "#be123c" }
    if ((decl.chiffreAffairesMdaRows?.length ?? 0) > 0) return { key: "chiffre_affaires_mda", label: "Chiffre d'Affaires (MDA)", color: "#2db34b" }
    return { key: "encaissement", label: "Non défini", color: "#6b7280" }
  }

  const hasActiveFilters = !!(filterType || filterMois || filterAnnee || filterDirection || filterStatus || filterDateFrom || filterDateTo)

  const filteredDeclarations = declarations.filter((decl) => {
    const declType = getDeclarationType(decl)
    if (filterType && declType.key !== filterType) return false
    if (filterMois && decl.mois !== filterMois) return false
    if (filterAnnee && decl.annee !== filterAnnee) return false
    if (filterDirection && !(decl.direction ?? "").toLowerCase().includes(filterDirection.toLowerCase())) return false
    if (filterStatus === "approved" && !decl.isApproved) return false
    if (filterStatus === "pending" && !!decl.isApproved) return false
    if (filterDateFrom && new Date(decl.createdAt) < new Date(filterDateFrom)) return false
    if (filterDateTo && new Date(decl.createdAt) > new Date(filterDateTo + "T23:59:59")) return false
    return true
  })

  const recentDeclarations = [...filteredDeclarations].sort((a, b) => {
    let cmp = 0
    if (sortCol === "date") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    } else if (sortCol === "type") {
      cmp = getDeclarationType(a).label.localeCompare(getDeclarationType(b).label, "fr")
    } else if (sortCol === "direction") {
      cmp = (a.direction ?? "").localeCompare(b.direction ?? "", "fr")
    } else if (sortCol === "periode") {
      cmp = (a.annee + a.mois).localeCompare(b.annee + b.mois)
    }
    return sortDir === "asc" ? cmp : -cmp
  })

  const recentRecaps = [...recaps].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    return tb - ta
  })

  const hasActiveRecapFilters = !!(recapFilterMois || recapFilterAnnee)

  const filteredRecaps = recentRecaps.filter((recap) => {
    if (recapFilterMois && recap.mois !== recapFilterMois) return false
    if (recapFilterAnnee && recap.annee !== recapFilterAnnee) return false
    return true
  })

  const handleViewRecap = (recap: SavedRecap) => {
    setViewRecap(recap)
    setShowRecapDialog(true)
  }

  const handleEditRecap = (recap: SavedRecap) => {
    const params = new URLSearchParams({
      entryMode: "etats_sortie",
      recapTab: recap.key,
      mois: recap.mois,
      annee: recap.annee,
    })
    router.push(`/declaration?${params.toString()}`)
  }

  const handlePrintRecap = (recap: SavedRecap) => {
    const columns = Array.from(new Set((recap.rows ?? []).flatMap((row) => Object.keys(row))))
    const orderedColumns = [
      ...(columns.includes("designation") ? ["designation"] : []),
      ...columns.filter((column) => column !== "designation"),
    ]

    if (orderedColumns.length === 0) return

    void (async () => {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
        await fetch(`${API_BASE}/api/fiscal-recaps/${recap.id}/print`, {
          method: "POST",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }).catch(() => null)

        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
          import("jspdf"),
          import("jspdf-autotable"),
        ])

        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
        const period = `${MONTHS[recap.mois] ?? recap.mois} ${recap.annee}`
        const logo = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
          img.src = "/logo_doc.png"
        })

        const drawUnderlinedText = (text: string, x: number, y: number) => {
          pdf.text(text, x, y)
          const width = pdf.getTextWidth(text)
          pdf.setLineWidth(0.2)
          pdf.line(x, y + 0.6, x + width, y + 0.6)
        }

        // Logo en haut à gauche
        if (logo) {
          pdf.addImage(logo, "PNG", 10, 12, 40, 15)
        }

        pdf.setFont("times", "bold")
        pdf.setFontSize(11)
        drawUnderlinedText("ATM MOBILIS SPA", 10, 33)
        drawUnderlinedText("DIRECTION DES FINANCES ET DE LA COMPTABILITE", 10, 38)
        drawUnderlinedText("SOUS DIRECTION FISCALITE", 10, 43)
        pdf.setFontSize(14)
        drawUnderlinedText(`${recap.title} ${period}`.trim(), 10, 64)

        const tableHead = [orderedColumns.map((column) => column)]
        const tableBody = (recap.rows ?? []).map((row) =>
          orderedColumns.map((column) => String(row[column] ?? "")),
        )

        autoTable(pdf, {
          head: tableHead,
          body: tableBody,
          startY: 74,
          theme: "grid",
          margin: { left: 10, right: 10, top: 74, bottom: 22 },
          styles: {
            font: "times",
            fontSize: 10,
            cellPadding: 1.2,
            minCellHeight: 8.5,
            lineColor: [51, 51, 51],
            lineWidth: 0.2,
            textColor: [0, 0, 0],
            valign: "middle",
          },
          headStyles: {
            fillColor: [45, 179, 75],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
          },
          didParseCell: (data) => {
            data.cell.text = data.cell.text.map((line) =>
              line
                .replace(/\//g, " ")
                .replace(/\u00A0/g, " "),
            )

            if (data.section === "body") {
              const rawText = String(data.cell.text?.[0] ?? data.cell.raw ?? "")
              const numericCandidate = rawText
                .replace(/\u00A0/g, " ")
                .trim()
                .replace(/\s+/g, "")
                .replace(/,/g, ".")
              const isAmount = /^-?\d+(\.\d+)?$/.test(numericCandidate)
              data.cell.styles.halign = isAmount ? "center" : "left"
              data.cell.styles.valign = "middle"
            }

            const rowValues = Array.isArray(data.row.raw)
              ? data.row.raw.map((value) => String(value ?? "").toLowerCase())
              : []
            const isTotalRow = data.section === "body" && rowValues.some((value) => value.includes("total"))

            if (isTotalRow) {
              data.cell.styles.fillColor = [45, 179, 75]
              data.cell.styles.textColor = [255, 255, 255]
              data.cell.styles.fontStyle = "bold"
            }

          },
        })

        const blobUrl = URL.createObjectURL(pdf.output("blob"))
        window.open(blobUrl, "_blank")
      } catch (error) {
        console.error("Recap print failed", error)
      }
    })()
  }

  const handleDeleteRecap = async (recap: SavedRecap) => {
    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      await fetch(`${API_BASE}/api/fiscal-recaps/${recap.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
    } catch {
      // Ignore API errors and refresh local list anyway.
    }

    setRecaps((prev) => prev.filter((item) => item.id !== recap.id))
    if (viewRecap?.id === recap.id) {
      setShowRecapDialog(false)
      setViewRecap(null)
    }
  }

  const handleSort = (col: "type" | "direction" | "periode" | "date") => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortCol(col); setSortDir("asc") }
  }

  const SortIcon = ({ col }: { col: "type" | "direction" | "periode" | "date" }) =>
    sortCol === col
      ? sortDir === "asc" ? <ChevronUp size={13} className="inline ml-0.5" /> : <ChevronDown size={13} className="inline ml-0.5" />
      : <span className="inline-block w-3" />

  const viewTab = DASH_TABS.find((t) => t.key === viewTabKey)
  const viewTabColor = viewTab?.color ?? "#000"
  const viewTabTitle = viewTab?.title ?? ""

  return (
    <LayoutWrapper user={user}>
      {/* Off-screen zone for PDF generation */}
      <style>{`
        #dash-print-zone {
          position: fixed;
          left: -9999px;
          top: 0;
          width: max-content;
          min-width: 1280px;
          max-width: 2400px;
          background: #fff;
          padding: 44px 40px;
          font-family: Arial, sans-serif;
          pointer-events: none;
          z-index: -1;
          color: #000;
        }
        #dash-print-zone table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin-top: 50px !important;
          font-size: 14px !important;
        }
        #dash-print-zone th, #dash-print-zone td {
          border: 1.5px solid #333 !important;
          padding: 1px 4px !important;
          font-size: 14px !important;
          vertical-align: middle !important;
          line-height: 1.3 !important;
          color: #000 !important;
          direction: ltr !important;
        }
        #dash-print-zone th {
          font-weight: 700 !important;
          background: #2db34b !important;
          color: #fff !important;
          text-align: center !important;
          white-space: nowrap !important;
          font-size: 13px !important;
        }
        #dash-print-zone td { text-align: left !important; }
        #dash-print-zone tbody td { background: #fff !important; text-align: left !important; }
        #dash-print-zone tbody td:not(:first-child) { text-align: center !important; }
        #dash-print-zone tbody tr[style*="font-weight:700"] td,
        #dash-print-zone tbody tr[style*="font-weight: 700"] td,
        #dash-print-zone tbody tr[style*="font-weight:bold"] td,
        #dash-print-zone tbody tr[style*="font-weight: bold"] td {
          background: #2db34b !important;
          color: #fff !important;
          font-weight: 800 !important;
          text-align: center !important;
        }
        #dash-print-zone tbody tr.bg-muted td,
        #dash-print-zone tbody tr[class*="bg-muted"] td {
          background: #2db34b !important;
          color: #fff !important;
          font-weight: 800 !important;
          text-align: center !important;
        }
        #dash-print-zone tfoot td {
          font-weight: 700 !important;
          background: #2db34b !important;
          color: #fff !important;
          font-size: 14px !important;
          text-align: center !important;
        }
      `}</style>
      {/* Hidden print zone a content read by handlePrint via innerHTML */}
      <DashPrintZone
        decl={printDecl}
        tabKey={viewTabKey}
        tabTitle={viewTabTitle}
        color={viewTabColor}
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Déclarations fiscales récentes
          </p>
        </div>

        {/* Recent declarations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Déclarations récentes
                {declarations.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filteredDeclarations.length}{hasActiveFilters ? ` / ${declarations.length}` : ""})
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground hover:text-emerald-600"
                    onClick={() => { setFilterType(""); setFilterMois(""); setFilterAnnee(""); setFilterDirection(""); setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo("") }}
                  >
                    <X size={14} className="mr-1" /> Effacer filtres
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={showFilters ? "secondary" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={14} className="mr-1" /> Filtrer
                </Button>
              </div>
            </div>
            {showFilters && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">Tous</option>
                    <option value="encaissement">Encaissement</option>
                    <option value="tva_immo">TVA / IMMO</option>
                    <option value="tva_biens">TVA / Biens &amp; Serv</option>
                    <option value="droits_timbre">Droits Timbre</option>
                    <option value="ca_tap">CA 7% &amp; CA Glob 1%</option>
                    <option value="etat_tap">ETAT TAP</option>
                    <option value="ca_siege">CA Siège</option>
                    <option value="irg">Situation IRG</option>
                    <option value="taxe2">Taxe 2%</option>
                    <option value="taxe_masters">Taxe des Master 1,5%</option>
                    <option value="taxe_vehicule">Taxe Vehicule</option>
                    <option value="taxe_formation">Taxe Formation</option>
                    <option value="acompte">Acompte Provisionnel</option>
                    <option value="ibs">IBS Etrangers</option>
                    <option value="taxe_domicil">Taxe Domiciliation</option>
                    <option value="tva_autoliq">TVA Auto Liquidation</option>
                    <option value="e_payement_pop">E-PAYEMENT Pop</option>
                    <option value="e_payement_prp">E-PAYEMENT Prp</option>
                    <option value="total_encaissement">Totale des encaissment</option>
                    <option value="recouvrement">Recouvrement</option>
                    <option value="realisation_technique_reseau">Realisation technique Reseau</option>
                    <option value="situation_reseau">Situation Reseau</option>
                    <option value="trafic_data">Trafic Data</option>
                    <option value="amelioration_qualite">Amelioration qualite</option>
                    <option value="couverture_reseau">Couverture Reseau</option>
                    <option value="action_notable_reseau">Action notable sur le reseau</option>
                    <option value="disponibilite_reseau">Disponibilite reseau</option>
                    <option value="desactivation_resiliation">Desactivation / Resiliation</option>
                    <option value="parc_abonnes_b2b">Parc Abonnes B2B</option>
                    <option value="mttr">MTTR</option>
                    <option value="creances_contentieuses">Creances Contentieuses</option>
                    <option value="frais_personnel">Frais personnel</option>
                    <option value="effectif_gsp">Effectif par GSP</option>
                    <option value="absenteisme">Absenteisme</option>
                    <option value="mouvement_effectifs">Mouvement des effectifs</option>
                    <option value="mouvement_effectifs_domaine">Mouvement des effectifs par domaine</option>
                    <option value="compte_resultat">Compte de resultat</option>
                    <option value="effectifs_formes_gsp">Effectifs formes par GSP</option>
                    <option value="formations_domaines">Formations realisees par domaines</option>
                    <option value="parc_abonnes_gp">Parc Abonnes GP</option>
                    <option value="total_parc_abonnes">Total Parc Abonnes</option>
                    <option value="total_parc_abonnes_technologie">Total Parc Abonnes parc technologie</option>
                    <option value="activation">Activation</option>
                    <option value="chiffre_affaires_mda">Chiffre d'Affaires (MDA)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Mois</label>
                  <select value={filterMois} onChange={e => setFilterMois(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">Tous</option>
                    {Object.entries(MONTHS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Année</label>
                  <input type="number" placeholder="ex: 2025" value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Direction</label>
                  <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">Tous</option>
                    {reminderDirectionOptions.map((direction) => (
                      <option key={direction} value={direction}>{direction}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Statut</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">Tous</option>
                    <option value="approved">Approuvée</option>
                    <option value="pending">En attente</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Du</label>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Au</label>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" />
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {recentDeclarations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune déclaration fiscale enregistrée pour le moment.
              </p>
            ) : (
              <div className="max-h-[540px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("type")}>
                        Type de déclaration <SortIcon col="type" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("direction")}>
                        Direction <SortIcon col="direction" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("periode")}>
                        Période <SortIcon col="periode" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("date")}>
                        Date d&apos;enregistrement <SortIcon col="date" />
                      </TableHead>
                      <TableHead className="w-20 text-center">Statut</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentDeclarations.map((decl) => {
                      const declType = getDeclarationType(decl)
                      const isLocked = isDeclarationLocked(decl)
                      const declarationDirection = (decl.direction ?? "").trim().toLowerCase()
                      const isSiegeDeclaration = declarationDirection === "siège"
                        || declarationDirection === "siege"
                        || declarationDirection.includes("siège")
                        || declarationDirection.includes("siege")
                      const isOwnDeclaration = String(decl.userId ?? "") === String(user.id)
                      const canApproveAsRegional = canApproveRegionalDeclarations
                        && !decl.isApproved
                        && (isOwnDeclaration || (!!normalizedRegion && declarationDirection === normalizedRegion))
                      const canApproveAsFinance = canApproveFinanceDeclarations
                        && !decl.isApproved
                        && (isOwnDeclaration || isSiegeDeclaration)
                      const canApproveAsAdmin = isAdminRole && !decl.isApproved
                      const canApproveThisDeclaration = canApproveAsAdmin || canApproveAsRegional || canApproveAsFinance
                      return (
                        <TableRow
                          key={decl.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleView(decl, declType.key)}
                          title="Cliquer pour consulter"
                        >
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {declType.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{decl.direction || <span className="text-muted-foreground italic">a</span>}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {MONTHS[decl.mois] || decl.mois} {decl.annee}
                            </Badge>
                            {isLocked && (
                              <Badge variant="secondary" className="ml-2 text-[10px] text-emerald-700">
                                Clôturée
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(decl.createdAt).toLocaleString("fr-DZ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </TableCell>
                          <TableCell className="w-20 p-0 align-middle">
                            <div className="flex items-center justify-center">
                              {decl.isApproved ? (
                                <span className="inline-flex" title="Approuvée" aria-label="Approuvée">
                                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                                </span>
                              ) : (
                                <span className="inline-flex" title="En attente" aria-label="En attente">
                                  <Clock3 className="h-4 w-4 text-amber-600" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              {(isAdminRole || canApproveRegionalDeclarations || canApproveFinanceDeclarations) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={!canApproveThisDeclaration}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleApprove(decl)
                                  }}
                                  title={decl.isApproved ? "Déclaration déjà approuvée" : !canApproveThisDeclaration ? "Action non autorisée pour cette déclaration" : "Approuver"}
                                >
                                  <CheckCircle size={16} />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={isLocked}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleDelete(decl)
                                }}
                                title={isLocked ? "Période clôturée (suppression impossible)" : "Supprimer"}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Etats de sortie
                {recaps.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filteredRecaps.length}{hasActiveRecapFilters ? ` / ${recaps.length}` : ""})
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {hasActiveRecapFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground hover:text-emerald-600"
                    onClick={() => {
                      setRecapFilterMois("")
                      setRecapFilterAnnee("")
                    }}
                  >
                    <X size={14} className="mr-1" /> Effacer filtres
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={showRecapFilters ? "secondary" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setShowRecapFilters(!showRecapFilters)}
                >
                  <Filter size={14} className="mr-1" /> Filtrer
                </Button>
              </div>
            </div>
            {showRecapFilters && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Mois</label>
                  <select
                    value={recapFilterMois}
                    onChange={(event) => setRecapFilterMois(event.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  >
                    <option value="">Tous</option>
                    {Object.entries(MONTHS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Année</label>
                  <input
                    type="number"
                    placeholder="ex: 2026"
                    value={recapFilterAnnee}
                    onChange={(event) => setRecapFilterAnnee(event.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {recaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun etat de sortie pour le moment.
              </p>
            ) : filteredRecaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun etat de sortie ne correspond aux filtres.
              </p>
            ) : (
              <div className="max-h-[540px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type de recap</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Date de sauvegarde</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecaps.map((recap) => (
                      <TableRow
                        key={recap.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleViewRecap(recap)}
                        title="Cliquer pour consulter"
                      >
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{recap.title}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {MONTHS[recap.mois] || recap.mois} {recap.annee}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(recap.createdAt).toLocaleString("fr-DZ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDeleteRecap(recap)
                              }}
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* aa Consult Dialog aa */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="!w-[95vw] sm:!w-[90vw] xl:!w-[74vw] !max-w-[1200px] h-[82vh] p-0 overflow-hidden [&_[data-slot=table-head]]:border-r [&_[data-slot=table-head]]:border-border [&_[data-slot=table-head]:last-child]:border-r-0 [&_[data-slot=table-cell]]:border-r [&_[data-slot=table-cell]]:border-border [&_[data-slot=table-cell]:last-child]:border-r-0">
          <div className="border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4">
            <DialogHeader className="space-y-3">
              <DialogTitle className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold leading-tight" style={{ color: viewTabColor }}>
                    {viewTabTitle}
                  </p>
                </div>
              </DialogTitle>
              {viewDecl && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="gap-1.5 font-normal">
                    <Building2 size={12} /> {viewDecl.direction || "-"}
                  </Badge>
                  <Badge variant="secondary" className="gap-1.5 font-normal">
                    <CalendarDays size={12} /> {MONTHS[viewDecl.mois] ?? viewDecl.mois} {viewDecl.annee}
                  </Badge>
                </div>
              )}
            </DialogHeader>
          </div>
          {viewDecl && (
            <div className="h-[calc(82vh-140px)] overflow-auto bg-slate-50/60 px-6 py-5">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="overflow-x-auto">
                  <TabDataView tabKey={viewTabKey} decl={viewDecl} color={viewTabColor} />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {(() => {
                  const isLocked = isDeclarationLocked(viewDecl)

                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isLocked}
                      title={isLocked ? "Période clôturée (modification impossible)" : "Modifier"}
                      onClick={() => {
                        setShowDialog(false)
                        handleEdit(viewDecl, viewTabKey)
                      }}
                    >
                      <Pencil size={13} /> Modifier
                    </Button>
                  )
                })()}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => { setShowDialog(false); if (viewDecl) handlePrint(viewDecl, viewTabKey) }}
                >
                  <Printer size={13} /> Imprimer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRecapDialog} onOpenChange={setShowRecapDialog}>
        <DialogContent className="!w-[95vw] sm:!w-[90vw] xl:!w-[74vw] !max-w-[1200px] h-[82vh] p-0 overflow-hidden [&_[data-slot=table-head]]:border-r [&_[data-slot=table-head]]:border-border [&_[data-slot=table-head]:last-child]:border-r-0 [&_[data-slot=table-cell]]:border-r [&_[data-slot=table-cell]]:border-border [&_[data-slot=table-cell]:last-child]:border-r-0">
          <div className="border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4">
            <DialogHeader className="space-y-3">
              <DialogTitle className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold leading-tight">
                    {viewRecap?.title ?? "Recap"}
                  </p>
                </div>
              </DialogTitle>
              {viewRecap && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="gap-1.5 font-normal">
                    <CalendarDays size={12} /> {MONTHS[viewRecap.mois] ?? viewRecap.mois} {viewRecap.annee}
                  </Badge>
                </div>
              )}
            </DialogHeader>
          </div>

          {viewRecap && (
            <div className="h-[calc(82vh-140px)] overflow-auto bg-slate-50/60 px-6 py-5">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="overflow-x-auto">
                  {(() => {
                    const columns = Array.from(new Set(viewRecap.rows.flatMap((row) => Object.keys(row))))
                    const orderedColumns = [
                      ...(columns.includes("designation") ? ["designation"] : []),
                      ...columns.filter((column) => column !== "designation"),
                    ]

                    if (orderedColumns.length === 0) {
                      return <p className="text-sm text-muted-foreground">Aucune donnée pour ce recap.</p>
                    }

                    return (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {orderedColumns.map((column) => (
                              <TableHead key={column} className={column === "designation" ? "text-left" : "text-right"}>
                                {column}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewRecap.rows.map((row, index) => (
                            <TableRow key={`${viewRecap.id}-${index}`}>
                              {orderedColumns.map((column) => (
                                <TableCell key={column} className={column === "designation" ? "text-left" : "text-right font-semibold"}>
                                  {String(row[column] ?? "")}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  })()}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => {
                    setShowRecapDialog(false)
                    handlePrintRecap(viewRecap)
                  }}
                >
                  <Printer size={13} /> Imprimer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8 border-sky-300 text-sky-700 hover:bg-sky-50"
                  onClick={() => {
                    setShowRecapDialog(false)
                    handleEditRecap(viewRecap)
                  }}
                >
                  <Pencil size={13} /> Modifier
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </LayoutWrapper>
  )
}


