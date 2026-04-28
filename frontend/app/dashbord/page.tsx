"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { HubConnectionBuilder } from "@microsoft/signalr"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Trash2, Printer, Filter, ChevronUp, ChevronDown, X, Pencil, Clock3, CalendarDays, Building2, FileSpreadsheet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { API_BASE } from "@/lib/config"
import WILAYAS_COMMUNES, { type WilayaCommuneEntry } from "@/lib/wilayas-communes"

type EncRow = { designation: string; ht?: string; ttc?: string }
type TvaRate = "19" | "9"
type TvaRow = { nomRaisonSociale: string; adresse: string; nif: string; authNif: string; numRC: string; authRC: string; numFacture: string; dateFacture: string; montantHT: string; tva: string; tauxTVA?: TvaRate | "" }
type TimbreRow = { designation: string; caTTCEsp: string; droitTimbre: string }
type TAPRow = { wilayaCode: string; commune: string; tap2: string }
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
const MONTH_LABELS_SHORT = ["Janv","Fév","Mars","Avr","Mai","Juin","Juil","Aoét","Sept","Oct","Nov","Déc"]

interface Savedtableau {
  id: string
  tabKey?: string
  userId?: number
  createdAt: string
  direction: string
  mois: string
  annee: string
  isApproved?: boolean
  approvedByUserId?: number | null
  approvedAt?: string | null
  dataJson?: string
  // Original Financial Tables
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
  
  // DVDRS Tables (Réseau Technique)
  realisationTechniqueReseauRows?: { label: string; m: string; m1: string }[]
  situationReseauRows?: { situation: string; equipements: string; m: string; m1: string }[]
  traficDataRows?: { label: string; m: string; m1: string }[]
  ameliorationQualiteRows?: { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }[]
  couvertureReseauRows?: { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }[]
  actionNotableReseauRows?: { action: string; objectif2025: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }[]
  
  // DQRPC Tables (Qualité Réseau)
  disponibiliteReseauRows?: { label: string; m: string; m1: string }[]
  mttrRows?: { label: string; m: string; m1: string }[]
  
  // Support Tables (RH + Formation + Créances)
  creancesContentieusesRows?: { designation: string; m: string; m1: string; evol: string }[]
  fraisPersonnelRows?: { designation: string; m: string; m1: string }[]
  effectifGspRows?: { gsp: string; m: string; m1: string; part: string }[]
  absenteismeRows?: { motif: string; m: string; m1: string; part: string }[]
  mouvementEffectifsRows?: { bloc: string; operation: string; [key: string]: string }[]
  formationRows?: {
    effectifsFormesGspRows?: { gsp: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }[]
    formationsDomainesRows?: { domaine: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }[]
    frequenceFormationRow?: { mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
  }
  
  // Commercial Tables
  reclamationRows?: { label: string; m: string; m1: string }[]
  ePayementRows?: { label: string; m: string; m1: string }[]
  rechargementRows?: { label: string; m: string; m1: string }[]
  encaissementCRows?: { label: string; m: string; m1: string }[]
  recouvrementRows?: { label: string; m: string; m1: string }[]
  parcAbonnesRows?: { label: string; m: string; m1: string }[]
  activationRows?: { label: string; m: string; m1: string }[]
  chiffreAffairesCRows?: { label: string; m: string; m1: string }[]
  
  // Regionale Tables
  regionaleRows?: { label: string; m: string; m1: string }[]
}

interface Apitableautableau {
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

interface ApitableauRecap {
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

interface ReminderData {
  direction: string
  mois: string
  annee: string
  deadline: string
  daysUntilDeadline: number
  totalTabs: number
  enteredTabs: number
  approvedTabs: number
  remainingToEnterTabs: number
  remainingToApproveTabs: number
}

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? "")) : []

const getStoredToken = () => {
  try {
    return localStorage.getItem("jwt")
  } catch {
    return null
  }
}

const mapApitableauToSaved = (item: Apitableautableau): Savedtableau => {
  const parsedData = (() => {
    try {
      const payload = JSON.parse(item.dataJson ?? "{}")
      return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  })()

  const tableau: Savedtableau = {
    id: String(item.id),
    tabKey: (item.tabKey ?? "").trim().toLowerCase(),
    userId: item.userId,
    createdAt: item.createdAt,
    direction: item.direction ?? "",
    mois: item.mois,
    annee: item.annee,
    isApproved: !!item.isApproved,
    approvedByUserId: item.approvedByUserId ?? null,
    approvedAt: item.approvedAt ?? null,
    dataJson: item.dataJson,
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
    // DVDRS
    realisationTechniqueReseauRows: [],
    traficDataRows: [],
    ameliorationQualiteRows: [],
    couvertureReseauRows: [],
    actionNotableReseauRows: [],
    // DQRPC
    disponibiliteReseauRows: [],
    mttrRows: [],
    // Support
    creancesContentieusesRows: [],
    fraisPersonnelRows: [],
    effectifGspRows: [],
    absenteismeRows: [],
    mouvementEffectifsRows: [],
    // Commercial
    reclamationRows: [],
    ePayementRows: [],
    rechargementRows: [],
    encaissementCRows: [],
    recouvrementRows: [],
    parcAbonnesRows: [],
    activationRows: [],
    chiffreAffairesCRows: [],
    // Regionale
    regionaleRows: [],
  }

  switch ((item.tabKey ?? "").trim().toLowerCase()) {
    case "encaissement":
      tableau.encRows = toArray<EncRow>(parsedData.encRows)
      break
    case "tva_immo":
      tableau.tvaImmoRows = toArray<TvaRow>(parsedData.tvaImmoRows)
      break
    case "tva_biens":
      tableau.tvaBiensRows = toArray<TvaRow>(parsedData.tvaBiensRows)
      break
    case "droits_timbre":
      tableau.timbreRows = toArray<TimbreRow>(parsedData.timbreRows)
      break
    case "ca_tap":
      tableau.b12 = String(parsedData.b12 ?? "")
      tableau.b13 = String(parsedData.b13 ?? "")
      break
    case "etat_tap":
      tableau.tapRows = toArray<TAPRow>(parsedData.tapRows)
      break
    case "ca_siege":
      tableau.caSiegeRows = toArray<SiegeEncRow>(parsedData.caSiegeRows)
      break
    case "irg":
      tableau.irgRows = toArray<IrgRow>(parsedData.irgRows)
      break
    case "taxe2":
      tableau.taxe2Rows = toArray<Taxe2Row>(parsedData.taxe2Rows)
      break
    case "taxe_masters":
      tableau.masterRows = toArray<MasterRow>(parsedData.masterRows)
      break
    case "taxe_vehicule":
      tableau.taxe11Montant = String(parsedData.taxe11Montant ?? "")
      break
    case "taxe_formation":
      tableau.taxe12Rows = toArray<Taxe12Row>(parsedData.taxe12Rows)
      break
    case "acompte":
      tableau.acompteMonths = toStringArray(parsedData.acompteMonths)
      break
    case "ibs":
      tableau.ibs14Rows = toArray<Ibs14Row>(parsedData.ibs14Rows)
      break
    case "taxe_domicil":
      tableau.taxe15Rows = toArray<Taxe15Row>(parsedData.taxe15Rows)
      break
    case "tva_autoliq":
      tableau.tva16Rows = toArray<Tva16Row>(parsedData.tva16Rows)
      break
    
    // DVDRS Tables (Réseau Technique)
    case "suivi_infrastructures_reseau":
      tableau.realisationTechniqueReseauRows = toArray(parsedData.realisationTechniqueReseauRows)
      break
    case "evolution_trafic_data":
      tableau.traficDataRows = toArray(parsedData.traficDataRows)
      break
    case "amelioration_qualite":
      tableau.ameliorationQualiteRows = toArray(parsedData.ameliorationQualiteRows)
      break
    case "couverture_reseau":
      tableau.couvertureReseauRows = toArray(parsedData.couvertureReseauRows)
      break
    case "action_notable_reseau":
      tableau.actionNotableReseauRows = toArray(parsedData.actionNotableReseauRows)
      break
    
    // DQRPC Tables (Qualité Réseau)
    case "disponibilite_reseau":
      tableau.disponibiliteReseauRows = toArray(parsedData.disponibiliteReseauRows)
      break
    case "mttr":
      tableau.mttrRows = toArray(parsedData.mttrRows)
      break
    
    // Support Tables (RH + Formation + Créances)
    case "creance_contentieuses":
      tableau.creancesContentieusesRows = toArray(parsedData.creancesContentieusesRows)
      break
    case "rh":
      tableau.fraisPersonnelRows = toArray(parsedData.fraisPersonnelRows)
      tableau.effectifGspRows = toArray(parsedData.effectifGspRows)
      tableau.absenteismeRows = toArray(parsedData.absenteismeRows)
      tableau.mouvementEffectifsRows = toArray(parsedData.mouvementEffectifsRows)
      break
    case "formation": {
      const formationData = parsedData.formationRows as Record<string, unknown> | undefined
      tableau.formationRows = {
        effectifsFormesGspRows: toArray(formationData?.effectifsFormesGspRows),
        formationsDomainesRows: toArray(formationData?.formationsDomainesRows),
        frequenceFormationRow: formationData?.frequenceFormationRow as { mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string } | undefined,
      }
      break
    }
    
    // Commercial Tables
    case "reclamation":
      tableau.reclamationRows = toArray(parsedData.reclamationRows)
      break
    case "e_payement":
      tableau.ePayementRows = toArray(parsedData.ePayementRows)
      break
    case "rechargement":
      tableau.rechargementRows = toArray(parsedData.rechargementRows)
      break
    case "encaissement_c":
      tableau.encaissementCRows = toArray(parsedData.encaissementCRows)
      break
    case "recouvrement":
      tableau.recouvrementRows = toArray(parsedData.recouvrementRows)
      break
    case "parc_abonnes":
      tableau.parcAbonnesRows = toArray(parsedData.parcAbonnesRows)
      break
    case "activation":
      tableau.activationRows = toArray(parsedData.activationRows)
      break
    case "chiffre_affaires_c":
      tableau.chiffreAffairesCRows = toArray(parsedData.chiffreAffairesCRows)
      break
    
    // Regionale Tables
    case "regionale":
      tableau.regionaleRows = toArray(parsedData.regionaleRows)
      break
    
    default:
      break
  }
  
  // Store raw dataJson for fallback rendering
  tableau.dataJson = item.dataJson

  return tableau
}

const MONTHS: Record<string, string> = {
  "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
  "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Aoét",
  "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre",
}

const DASH_TABS = [
  // Tableaux Financiers (Originaux)
  { key: "encaissement",  label: "1 - Encaissement",       color: "#2db34b", title: "ETAT DES ENCAISSEMENTS" },
  { key: "tva_immo",      label: "2 - TVA / IMMO",         color: "#1d6fb8", title: "ETAT TVA / IMMOBILISATIONS" },
  { key: "tva_biens",     label: "3 - TVA / Biens & Serv", color: "#7c3aed", title: "ETAT TVA / BIENS & SERVICES" },
  { key: "droits_timbre", label: "4 - Droits Timbre",      color: "#0891b2", title: "ETAT DROITS DE TIMBRE" },
  { key: "ca_tap",        label: "5 - CA 7% & CA Glob 1%", color: "#ea580c", title: "CA 7% & CA GLOBAL 1%" },
  { key: "etat_tap",      label: "6 - ETAT TAP",           color: "#be123c", title: "ETAT TAP" },
  { key: "ca_siege",      label: "7 a CA Siége",           color: "#854d0e", title: "CHIFFRE D'AFFAIRE ENCAISSÉ SIÉGE" },
  { key: "irg",           label: "8 a Situation IRG",      color: "#0f766e", title: "SITUATION IRG" },
  { key: "taxe2",         label: "9 a Taxe 2%",            color: "#6d28d9", title: "SITUATION DE LA TAXE 2%" },
  { key: "taxe_masters",  label: "10 a Taxe des Master 1,5%", color: "#0369a1", title: "ÉTAT DE LA TAXE 1,5% DES MASTERS" },
  { key: "taxe_vehicule", label: "11 a Taxe Vehicule",      color: "#92400e", title: "TAXE DE VEHICULE" },
  { key: "taxe_formation",label: "12 a Taxe Formation",     color: "#065f46", title: "TAXE DE FORMATION" },
  { key: "acompte",       label: "13 a Acompte Provisionnel", color: "#1e40af", title: "SITUATION DE L'ACOMPTE PROVISIONNEL" },
  { key: "ibs",           label: "14 a IBS Fournisseurs Etrangers", color: "#7c2d12", title: "IBS SUR FOURNISSEURS ETRANGERS" },
  { key: "taxe_domicil",  label: "15 a Taxe Domiciliation", color: "#134e4a", title: "TAXE DOMICILIATION BANCAIRE" },
  { key: "tva_autoliq",   label: "16 a TVA Auto Liquidation", color: "#312e81", title: "TVA AUTO LIQUIDATION" },
  
  // Tableaux DVDRS (Réseau Technique)
  { key: "suivi_infrastructures_reseau",  label: "17 - Suivi Infra Reseau 2G/3G/4G", color: "#2db34b", title: "SUIVI DES INFRASTRUCTURES RESEAU 2G/3G/4G" },
  { key: "evolution_trafic_data",        label: "18 - Evolution Trafic Data",       color: "#1d6fb8", title: "EVOLUTION DU TRAFIC DATA" },
  { key: "amelioration_qualite",        label: "19 - Amelioration qualité",          color: "#7c3aed", title: "AMELIORATION QUALITE" },
  { key: "couverture_reseau",           label: "20 - Couverture Réseau",             color: "#0891b2", title: "COUVERTURE RESEAU" },
  { key: "action_notable_reseau",       label: "21 - Action Notable Réseau",         color: "#ea580c", title: "ACTION NOTABLE SUR LE RESEAU" },
  
  // Tableaux DQRPC (Qualité Réseau)
  { key: "disponibilite_reseau",  label: "22 - Disponibilité Réseau", color: "#2db34b", title: "DISPONIBILITE RESEAU" },
  { key: "mttr",                label: "23 - MTTR",              color: "#1d6fb8", title: "MTTR / DR" },
  
  // Tableaux Support (RH + Formation + Créances)
  { key: "creance_contentieuses",      label: "24 - Creance contentieuses",    color: "#2db34b", title: "CREANCE CONTENTIEUSES" },
  { key: "rh",                      label: "25 - RH",                    color: "#1d6fb8", title: "RESSOURCES HUMAINES" },
  { key: "formation",               label: "26 - Formation",             color: "#7c3aed", title: "FORMATION" },
  
  // Tableaux Commercial
  { key: "reclamation",   label: "27 - Reclamation",                color: "#2db34b", title: "RECLAMATION" },
  { key: "e_payement",   label: "28 - E-payment",                  color: "#1d6fb8", title: "E-PAYMENT" },
  { key: "rechargement",label: "29 - Rechargement",               color: "#7c3aed", title: "RECHARGEMENT" },
  { key: "encaissement_c",label: "30 - Encaissement",                 color: "#0891b2", title: "ENCAISSEMENT" },
  { key: "recouvrement",label: "31 - Recouvrement",                color: "#ea580c", title: "RECOUVREMENT" },
  { key: "parc_abonnes", label: "32 - Parc Abonnes",                color: "#be123c", title: "PARC ABONNES" },
  { key: "activation",  label: "33 - Activation SIM",             color: "#854d0e", title: "ACTIVATION DESIM" },
  { key: "chiffre_affaires_c", label: "34 - Chiffre d'affaires",      color: "#0f766e", title: "CHIFFRE D'AFFAIRES" },
  
  // Tableaux Régionale
  { key: "regionale",     label: "35 - Regionale",          color: "#2db34b", title: "TABLEAU REGIONAL" },
  
  // Tableaux Autres
  { key: "commercial_autres", label: "36 - Commercial Autres", color: "#1d6fb8", title: "AUTRES TABLEAUX COMMERCIAUX" },
  { key: "finances_autres",   label: "37 - Finances Autres",   color: "#7c3aed", title: "AUTRES TABLEAUX FINANCES" },
]

// aaa Shared styles & helpers aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
const fmt = (v: number | string) => {
  if (v === "" || isNaN(Number(v))) return ""
  const num = Number(v)
  const [intPart, decPart] = num.toFixed(2).split(".")
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${formattedInt},${decPart}`
}

function RemindersCard({
  reminders,
  loading = false,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
}: {
  reminders: ReminderData[]
  loading?: boolean
  userRole?: string
  directionOptions?: string[]
  selectedMonth?: string
  selectedYear?: string
  onMonthChange?: (value: string) => void
  onYearChange?: (value: string) => void
}) {
  const currentPeriod = selectedMonth && selectedYear ? `${selectedMonth}/${selectedYear}` : "-"

  const totals = reminders.reduce(
    (acc, item) => {
      acc.total += item.totalTabs
      acc.entered += item.enteredTabs
      acc.approved += item.approvedTabs
      acc.pending += item.remainingToEnterTabs + item.remainingToApproveTabs
      return acc
    },
    { total: 0, entered: 0, approved: 0, pending: 0 },
  )

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays size={18} className="text-amber-700" />
            Rappels et delais tableauux
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth ?? ""}
              onChange={(event) => onMonthChange?.(event.target.value)}
              className="h-8 rounded border px-2 text-xs"
            >
              {Object.entries(MONTHS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              value={selectedYear ?? ""}
              onChange={(event) => onYearChange?.(event.target.value)}
              className="h-8 w-20 rounded border px-2 text-xs"
              maxLength={4}
              inputMode="numeric"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-amber-900">Chargement des rappels...</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-amber-900">
              Periode: <span className="font-semibold">{currentPeriod}</span>.
              Directions suivies: <span className="font-semibold">{reminders.length}</span>.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded border bg-white p-2"><span className="text-muted-foreground">Tableaux</span><div className="font-semibold">{totals.total}</div></div>
              <div className="rounded border bg-white p-2"><span className="text-muted-foreground">Saisis</span><div className="font-semibold">{totals.entered}</div></div>
              <div className="rounded border bg-white p-2"><span className="text-muted-foreground">Approuves</span><div className="font-semibold">{totals.approved}</div></div>
              <div className="rounded border bg-white p-2"><span className="text-muted-foreground">En attente</span><div className="font-semibold">{totals.pending}</div></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
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

  // Backward compatibility for tableaux saved with TTC as input.
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
          {["Nom et prénoms /Raison sociale","Adresse","NIF","Authentification du NIF","RC né","Authentification du néRC","Facture né","Date","Montant HT", "TVA","Montant TTC"].map((h) => (
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
  const getWilayaName = (code: string) =>
    WILAYAS_COMMUNES.find((entry: WilayaCommuneEntry) => entry.code === code)?.wilaya ?? "-"

  const totalImposable = rows.reduce((s, r) => s + num(r.tap2), 0)
  const totalTap = totalImposable * 0.015
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Code", "Wilaya", "Commune", "Montant Imposable", "TAP 1,5%"].map((h) => (
            <TableHead key={h} className={["Montant Imposable", "TAP 1,5%"].includes(h) ? "text-right" : undefined}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.wilayaCode || "-"}</TableCell>
            <TableCell>{getWilayaName(r.wilayaCode)}</TableCell>
            <TableCell>{r.commune || "-"}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(r.tap2)}</TableCell>
            <TableCell className="text-right font-semibold">{fmt(num(r.tap2) * 0.015)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold bg-muted">
          <TableCell colSpan={3}>TOTAL</TableCell>
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
    { label: "TOTAL GéNéRAL", ttc: fmt(t1ttc + t2ttc), ht: fmt(t1ht + t2ht), total: true },
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
          {["#","Date","Nom du Master","Né Facture","Date Facture","Montant HT","Taxe 1,5%","Mois","Observation"].map(h=><TableHead key={h} className={["Montant HT","Taxe 1,5%"].includes(h) ? "text-right" : undefined}>{h}</TableHead>)}
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
          {["#","Né Facture","Date Facture","Raison Sociale","Mont. Net Devise","Monnaie","Taux Change","Mont. Dinars","Taux Taxe","Mont. A Payer"].map(h=><TableHead key={h} className={["Mont. Net Devise","Mont. Dinars","Mont. A Payer"].includes(h) ? "text-right" : undefined}>{h}</TableHead>)}
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
          {["#","Né Facture","Mont. Brut Devises","Taux Change","Mont. Brut Dinars","TVA 19%"].map(h=><TableHead key={h} className={["Mont. Brut Devises","Mont. Brut Dinars","TVA 19%"].includes(h) ? "text-right" : undefined}>{h}</TableHead>)}
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

function TabDataView({ tabKey, decl, color }: { tabKey: string; decl: Savedtableau; color: string }) {
  //Helper to render any row array as a generic table
  const renderGenericTable = <T extends Record<string, string>>(rows: T[], keyFields: string[]) => {
    if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">Aucune donnée</div>
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {keyFields.map((field) => <TableHead key={field}>{field}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {keyFields.map((field) => (
                <TableCell key={field} className={typeof row[field] === 'number' || !isNaN(Number(row[field])) ? "text-right" : ""}>
                  {row[field]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  
  switch (tabKey) {
    // Tableaux Financiers (Originaux)
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
    
    // Tableaux DVDRS (Réseau Technique)
    case "suivi_infrastructures_reseau":
      return renderGenericTable(decl.realisationTechniqueReseauRows ?? [], ["label", "m", "m1"])
    case "evolution_trafic_data":
      return renderGenericTable(decl.traficDataRows ?? [], ["label", "m", "m1"])
    case "amelioration_qualite":
      return renderGenericTable(decl.ameliorationQualiteRows ?? [], ["wilaya", "mObjectif", "mRealise", "m1Objectif", "m1Realise", "ecart"])
    case "couverture_reseau":
      return renderGenericTable(decl.couvertureReseauRows ?? [], ["wilaya", "mObjectif", "mRealise", "m1Objectif", "m1Realise", "ecart"])
    case "action_notable_reseau":
      return renderGenericTable(decl.actionNotableReseauRows ?? [], ["action", "objectif2025", "mObjectif", "mRealise", "mTaux", "m1Objectif", "m1Realise", "m1Taux"])
    
    // Tableaux DQRPC (Qualité Réseau)
    case "disponibilite_reseau":
      return renderGenericTable(decl.disponibiliteReseauRows ?? [], ["label", "m", "m1"])
    case "mttr":
      return renderGenericTable(decl.mttrRows ?? [], ["label", "m", "m1"])
    
    // Tableaux Support (RH + Formation + Créances)
    case "creance_contentieuses":
      return renderGenericTable(decl.creancesContentieusesRows ?? [], ["designation", "m", "m1", "evol"])
    case "rh":
      return renderGenericTable(decl.fraisPersonnelRows ?? [], ["designation", "m", "m1"])
    case "formation":
      if (decl.formationRows?.effectifsFormesGspRows) {
        return renderGenericTable(decl.formationRows.effectifsFormesGspRows, ["gsp", "mObjectif", "mRealise", "mTaux", "m1Objectif", "m1Realise", "m1Taux"])
      }
      if (decl.formationRows?.formationsDomainesRows) {
        return renderGenericTable(decl.formationRows.formationsDomainesRows, ["domaine", "mObjectif", "mRealise", "mTaux", "m1Objectif", "m1Realise", "m1Taux"])
      }
      if (decl.formationRows?.frequenceFormationRow) {
        const f = decl.formationRows.frequenceFormationRow
        return renderGenericTable([f], ["mObjectif", "mRealise", "mTaux", "m1Objectif", "m1Realise", "m1Taux"])
      }
      return <div className="text-xs text-muted-foreground">Aucune donnée</div>
    
    // Tableaux Commercial
    case "reclamation":
      return renderGenericTable(decl.reclamationRows ?? [], ["label", "m", "m1"])
    case "e_payement":
      return renderGenericTable(decl.ePayementRows ?? [], ["label", "m", "m1"])
    case "rechargement":
      return renderGenericTable(decl.rechargementRows ?? [], ["label", "m", "m1"])
    case "encaissement_c":
      return renderGenericTable(decl.encaissementCRows ?? [], ["label", "m", "m1"])
    case "recouvrement":
      return renderGenericTable(decl.recouvrementRows ?? [], ["label", "m", "m1"])
    case "parc_abonnes":
      return renderGenericTable(decl.parcAbonnesRows ?? [], ["label", "m", "m1"])
    case "activation":
      return renderGenericTable(decl.activationRows ?? [], ["label", "m", "m1"])
    case "chiffre_affaires_c":
      return renderGenericTable(decl.chiffreAffairesCRows ?? [], ["label", "m", "m1"])
    
    // Tableaux Régionale
    case "regionale":
      return renderGenericTable(decl.regionaleRows ?? [], ["label", "m", "m1"])
    
    // Fallback pour les tableaux inconnus - afficher dataJson si disponible
    default:
      // Try to parse and display generic data
      if (decl.dataJson) {
        try {
          const parsed = JSON.parse(decl.dataJson)
          const keys = Object.keys(parsed)
          if (keys.length > 0) {
            // Check if it's an array of objects
            const firstValue = parsed[keys[0]]
            if (Array.isArray(firstValue) && firstValue.length > 0) {
              const fields = Object.keys(firstValue[0])
              return renderGenericTable(firstValue, fields)
            }
          }
        } catch {
          // Ignore parsing errors
        }
      }
      return <div className="text-xs text-muted-foreground">Tableau non reconnu: {tabKey}</div>
  }
}

// aaa Print Zone aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
function DashPrintZone({ decl, tabKey, tabTitle }: {
  decl: Savedtableau | null; tabKey: string; tabTitle: string; color: string
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
            tableau Mois : {moisLabel}
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

export default function tableauDashboardPage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const router = useRouter()
  const { toast } = useToast()
  const [tableaux, settableaux] = useState<Savedtableau[]>([])
  const [recaps, setRecaps] = useState<SavedRecap[]>([])
  const [viewDecl, setViewDecl] = useState<Savedtableau | null>(null)
  const [viewRecap, setViewRecap] = useState<SavedRecap | null>(null)
  const [printDecl, setPrintDecl] = useState<Savedtableau | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showRecapDialog, setShowRecapDialog] = useState(false)
  const [showRecapFilters, setShowRecapFilters] = useState(false)
  const consultTableContainerRef = useRef<HTMLDivElement | null>(null)
  const printZoneRef = useRef<HTMLDivElement | null>(null)
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
  const [reminders, setReminders] = useState<ReminderData[]>([])
  const [regions, setRegions] = useState<Array<{ id: number; name: string }>>([])
  const [refreshRevision, setRefreshRevision] = useState(0)
  const normalizedRole = (user?.role ?? "").trim().toLowerCase()
  const normalizedRegion = (user?.region ?? "").trim().toLowerCase()
  const isFinanceRole = normalizedRole === "finance" || normalizedRole === "comptabilite"
  const isAdminRole = normalizedRole === "admin"
  const canApproveRegionaltableaux = normalizedRole === "regionale" && !!user?.isRegionalApprover
  const canApproveFinancetableaux = isFinanceRole && !!user?.isFinanceApprover


  useEffect(() => {
    if (!user || status !== "authenticated") {
      settableaux([])
      return
    }

    let cancelled = false

    const loadtableaux = async () => {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
        const response = await fetch(`${API_BASE}/api/tableau`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })

        if (!response.ok) {
          if (!cancelled) settableaux([])
          return
        }

        const payload = await response.json().catch(() => null)
        const nexttableaux = Array.isArray(payload)
          ? (payload as Apitableautableau[]).map(mapApitableauToSaved)
          : []

        if (!cancelled) {
          settableaux(nexttableaux)
          try {
            localStorage.setItem("tableau_tableaux", JSON.stringify(nexttableaux))
          } catch {
            // Ignore storage errors.
          }
        }
      } catch {
        if (!cancelled) settableaux([])
      }
    }

    loadtableaux()

    return () => {
      cancelled = true
    }
  }, [refreshRevision, status, user])

  useEffect(() => {
    if (!user || status !== "authenticated") {
      return
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/check-updates`, {
        withCredentials: true,
        accessTokenFactory: () => getStoredToken() ?? "",
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build()

    const handletableautableauChanged = () => {
      setRefreshRevision((prev) => prev + 1)
    }

    connection.on("tableautableauChanged", handletableautableauChanged)

    const timeoutId = setTimeout(() => {
      connection.start().catch((error) => {
        console.error("SignalR tableau connection error:", error)
      })
    }, 500)

    return () => {
      clearTimeout(timeoutId)
      connection.off("tableautableauChanged", handletableautableauChanged)
      connection
        .stop()
        .catch((error) => console.error("SignalR tableau stop error:", error))
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

  const istableauLocked = (_decl: Savedtableau) => false

  const handleDelete = async (decl: Savedtableau) => {
    try {
      const tableauId = Number(decl.id)
      if (!Number.isFinite(tableauId)) {
        throw new Error("ID de tableau invalide")
      }

      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      const response = await fetch(`${API_BASE}/api/tableau/${tableauId}`, {
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

      const updated = tableaux.filter((d) => d.id !== decl.id)
      settableaux(updated)
      try {
        localStorage.setItem("tableau_tableaux", JSON.stringify(updated))
      } catch {
        // Ignore storage errors.
      }
      setRefreshRevision((prev) => prev + 1)

      toast({ title: "tableau supprimée" })
    } catch (error) {
      toast({
        title: "Erreur de suppression",
        description: error instanceof Error ? error.message : "Impossible de supprimer la tableau.",
        variant: "destructive",
      })
    }
  }

  const handleView = (decl: Savedtableau, tabKey: string) => {
    setViewDecl(decl)
    setViewTabKey(tabKey)
    setShowDialog(true)
  }

  const handlePrint = (decl: Savedtableau, tabKey: string) => {
    setPrintDecl(decl)
    setViewTabKey(tabKey)
    setTimeout(async () => {
      const printZone = printZoneRef.current ?? document.getElementById("dash-print-zone")
      const tableElement = printZone?.querySelector("table") as HTMLTableElement | null
      if (!printZone || !tableElement) return

      try {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
          import("jspdf"),
          import("jspdf-autotable"),
        ])

        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
        const periodText = `${MONTHS[decl.mois] ?? decl.mois} ${decl.annee}`
        const tableTitle = DASH_TABS.find((t) => t.key === tabKey)?.title ?? "TABLEAU tableau"
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
          write("(Conformément é l'article 29 tel modifié par l'article 42 de la Loi de Finances pour 2021)", 148.5, 88.5, "italic", 10, "center")

          const head = [[
            "Nom et prénoms /Raison sociale",
            "Adresse",
            "NIF",
            "Authentification du NIF",
            "RC né",
            "Authentification du néRC",
            "Facture né",
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

              // Lignes normales: plus hautes que l'actuel, mais plus basses que l'entéte
              if (data.section === "body" && data.row.index < bodyRows.length) {
                data.cell.styles.minCellHeight = 8.4
                data.cell.styles.cellPadding = 1.0
              }

              // Ligne de total (derniére ligne du body): hauteur renforcée
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

        // Logo en haut é gauche
        if (logo) {
          pdf.addImage(logo, "PNG", 10, 12 + layoutShiftY, 40, 15)
        }

        pdf.setFont("times", "bold")
        pdf.setFontSize(11)
        drawUnderlinedText("ATM MOBILIS SPA", 10, 33 + layoutShiftY)
        drawUnderlinedText("DIRECTION DES FINANCES ET DE LA COMPTABILITE", 10, 38 + layoutShiftY)
        drawUnderlinedText("SOUS DIRECTION tableauITE", 10, 43 + layoutShiftY)
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
              : Object.fromEntries(
                  Array.from({ length: tableHead[0]?.length ?? 0 }, (_, i) => [
                    String(i),
                    i === 0
                      ? { halign: "left", cellWidth: "auto" }
                      : { halign: "center", cellWidth: "auto" },
                  ]),
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

  const handleExportDialogToExcel = async () => {
    if (!viewDecl) {
      toast({ title: "Export impossible", description: "Aucun tableau a exporter.", variant: "destructive" })
      return
    }

    const tableElement = consultTableContainerRef.current?.querySelector("table") as HTMLTableElement | null
    if (!tableElement) {
      toast({ title: "Export impossible", description: "La structure du tableau est introuvable.", variant: "destructive" })
      return
    }

    try {
      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Consultation")

      const tabTitle = DASH_TABS.find((t) => t.key === viewTabKey)?.title ?? viewTabKey
      const periodLabel = `${MONTHS[viewDecl.mois] ?? viewDecl.mois} ${viewDecl.annee}`

      worksheet.getCell(1, 1).value = tabTitle
      worksheet.getCell(2, 1).value = `Direction: ${viewDecl.direction || "-"}`
      worksheet.getCell(3, 1).value = `Periode: ${periodLabel}`
      worksheet.getCell(5, 1).value = ""

      worksheet.getRow(1).font = { bold: true, size: 14 }
      worksheet.getRow(2).font = { bold: true, size: 11 }
      worksheet.getRow(3).font = { bold: true, size: 11 }

      const occupied = new Set<string>()
      const htmlRows = Array.from(tableElement.querySelectorAll("tr"))
      let excelRow = 6
      let maxCol = 1

      for (const htmlRow of htmlRows) {
        let excelCol = 1
        const cells = Array.from(htmlRow.querySelectorAll("th, td")) as HTMLTableCellElement[]

        for (const cell of cells) {
          while (occupied.has(`${excelRow}:${excelCol}`)) {
            excelCol += 1
          }

          const rowSpan = Math.max(1, Number(cell.getAttribute("rowspan") ?? "1"))
          const colSpan = Math.max(1, Number(cell.getAttribute("colspan") ?? "1"))
          const value = (cell.textContent ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim()
          const excelCell = worksheet.getCell(excelRow, excelCol)
          excelCell.value = value || "-"

          const isHeader = cell.tagName.toLowerCase() === "th"
          const isTotal = cell.parentElement?.className.includes("font-bold") || value.toLowerCase().includes("total")

          excelCell.alignment = { vertical: "middle", horizontal: isHeader ? "center" : "left", wrapText: true }
          excelCell.font = { bold: isHeader || isTotal }
          excelCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isHeader ? "FFE5E7EB" : isTotal ? "FFF1F5F9" : "FFFFFFFF" },
          }
          excelCell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          }

          if (rowSpan > 1 || colSpan > 1) {
            worksheet.mergeCells(excelRow, excelCol, excelRow + rowSpan - 1, excelCol + colSpan - 1)
          }

          for (let r = 0; r < rowSpan; r += 1) {
            for (let c = 0; c < colSpan; c += 1) {
              if (r === 0 && c === 0) continue
              occupied.add(`${excelRow + r}:${excelCol + c}`)
            }
          }

          excelCol += colSpan
          maxCol = Math.max(maxCol, excelCol - 1)
        }

        excelRow += 1
      }

      for (let col = 1; col <= maxCol; col += 1) {
        let maxLength = 12
        for (let row = 1; row <= worksheet.rowCount; row += 1) {
          const text = String(worksheet.getCell(row, col).value ?? "")
          maxLength = Math.max(maxLength, Math.min(48, text.length + 2))
        }
        worksheet.getColumn(col).width = maxLength
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const link = document.createElement("a")
      const safeTabKey = viewTabKey.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()
      link.href = URL.createObjectURL(blob)
      link.download = `tableau_${safeTabKey}_${viewDecl.mois}_${viewDecl.annee}.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)

      toast({ title: "Export Excel termine", description: "Le tableau a ete exporte avec sa structure." })
    } catch (error) {
      console.error("Excel export failed", error)
      toast({ title: "Erreur export", description: "Impossible d'exporter le tableau en Excel.", variant: "destructive" })
    }
  }

  const handleEdit = (decl: Savedtableau, tabKey: string) => {
    router.push(`/tableau?editId=${encodeURIComponent(decl.id)}&tab=${encodeURIComponent(tabKey)}`)
  }

  const handleApprove = async (decl: Savedtableau) => {
    if (!isAdminRole && !canApproveRegionaltableaux && !canApproveFinancetableaux) {
      toast({
        title: "Accés refusé",
        description: "Seuls les comptes admin ou approbateurs (régional/finance) peuvent valider les tableaux.",
        variant: "destructive",
      })
      return
    }

    const tableauId = Number(decl.id)
    if (!Number.isFinite(tableauId)) {
      toast({ title: "Erreur", description: "ID de tableau invalide", variant: "destructive" })
      return
    }

    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      const response = await fetch(`${API_BASE}/api/tableau/${tableauId}/approve`, {
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
      const updated = tableaux.map((item) =>
        item.id === decl.id
          ? {
              ...item,
              isApproved: true,
              approvedAt: typeof payload?.approvedAt === "string" ? payload.approvedAt : nowIso,
              approvedByUserId: typeof payload?.approvedByUserId === "number" ? payload.approvedByUserId : Number(user.id),
            }
          : item,
      )

      settableaux(updated)
      try {
        localStorage.setItem("tableau_tableaux", JSON.stringify(updated))
      } catch {
        // Ignore storage errors.
      }
      setRefreshRevision((prev) => prev + 1)

      toast({ title: "tableau approuvée" })
    } catch (error) {
      toast({
        title: "Erreur d'approbation",
        description: error instanceof Error ? error.message : "Impossible d'approuver la tableau.",
        variant: "destructive",
      })
    }
  }

  const gettableauType = (decl: Savedtableau) => {
    const declaredKey = (decl.tabKey ?? "").trim().toLowerCase()
    if (declaredKey) {
      const resolved = DASH_TABS.find((tab) => tab.key === declaredKey)
      return resolved
        ? { key: resolved.key, label: resolved.label.replace(/^\d+\s-\s/, ""), color: resolved.color }
        : { key: declaredKey, label: declaredKey, color: "#6b7280" }
    }
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
    return { key: "encaissement", label: "Non défini", color: "#6b7280" }
  }

  const hasActiveFilters = !!(filterType || filterMois || filterAnnee || filterDirection || filterStatus || filterDateFrom || filterDateTo)

  const filteredtableaux = tableaux.filter((decl) => {
    const declType = gettableauType(decl)
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

  const recenttableaux = [...filteredtableaux].sort((a, b) => {
    let cmp = 0
    if (sortCol === "date") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    } else if (sortCol === "type") {
      cmp = gettableauType(a).label.localeCompare(gettableauType(b).label, "fr")
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
    router.push(`/tableau?${params.toString()}`)
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
        await fetch(`${API_BASE}/api/tableau-recaps/${recap.id}/print`, {
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

        // Logo en haut é gauche
        if (logo) {
          pdf.addImage(logo, "PNG", 10, 12, 40, 15)
        }

        pdf.setFont("times", "bold")
        pdf.setFontSize(11)
        drawUnderlinedText("ATM MOBILIS SPA", 10, 33)
        drawUnderlinedText("DIRECTION DES FINANCES ET DE LA COMPTABILITE", 10, 38)
        drawUnderlinedText("SOUS DIRECTION tableauITE", 10, 43)
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
      await fetch(`${API_BASE}/api/tableau-recaps/${recap.id}`, {
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

  const reminderDirectionOptions = (() => {
    const normalizeDirection = (value: string) => {
      const normalized = value.trim().toLowerCase()
      if (!normalized) return ""
      if (normalized === "siege" || normalized === "siége" || normalized.includes("siege") || normalized.includes("siége")) {
        return "Siége"
      }
      return value.trim()
    }

    const tableauDirections = tableaux
      .map((tableau) => normalizeDirection(tableau.direction ?? ""))
      .filter(Boolean)

    if (tableauDirections.length > 0) {
      return Array.from(new Set(tableauDirections)).sort((a, b) => a.localeCompare(b, "fr"))
    }

    const fallbackDirections = [
      ...reminders.map((reminder) => normalizeDirection(reminder.direction ?? "")),
      ...regions.map((region) => normalizeDirection(region.name)),
      "Siége",
    ].filter(Boolean)

    return Array.from(new Set(fallbackDirections)).sort((a, b) => a.localeCompare(b, "fr"))
  })()

  const viewTab = DASH_TABS.find((t) => t.key === viewTabKey)
  const viewTabColor = viewTab?.color ?? "#000"
  const viewTabTitle = viewTab?.title ?? viewTabKey

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
      <div ref={printZoneRef}>
        <DashPrintZone
          decl={printDecl}
          tabKey={viewTabKey}
          tabTitle={viewTabTitle}
          color={viewTabColor}
        />
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard tableau</h1>
          <p className="text-sm text-muted-foreground mt-1">
            tableaux tableaus récentes
          </p>
        </div>

        {/* Recent tableaux */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                tableaux récentes
                {tableaux.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filteredtableaux.length}{hasActiveFilters ? ` / ${tableaux.length}` : ""})
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
                    <option value="ca_siege">CA Siége</option>
                    <option value="irg">Situation IRG</option>
                    <option value="taxe2">Taxe 2%</option>
                    <option value="taxe_masters">Taxe des Master 1,5%</option>
                    <option value="taxe_vehicule">Taxe Vehicule</option>
                    <option value="taxe_formation">Taxe Formation</option>
                    <option value="acompte">Acompte Provisionnel</option>
                    <option value="ibs">IBS Etrangers</option>
                    <option value="taxe_domicil">Taxe Domiciliation</option>
                    <option value="tva_autoliq">TVA Auto Liquidation</option>
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
            {recenttableaux.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune tableau tableau enregistrée pour le moment.
              </p>
            ) : (
              <div className="max-h-[540px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("type")}>
                        Type de tableau <SortIcon col="type" />
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
                    {recenttableaux.map((decl) => {
                      const declType = gettableauType(decl)
                      const isLocked = istableauLocked(decl)
                      const tableauDirection = (decl.direction ?? "").trim().toLowerCase()
                      const isSiegetableau = tableauDirection === "siége"
                        || tableauDirection === "siege"
                        || tableauDirection.includes("siége")
                        || tableauDirection.includes("siege")
                      const isOwntableau = String(decl.userId ?? "") === String(user.id)
                      const canApproveAsRegional = canApproveRegionaltableaux
                        && !decl.isApproved
                        && (isOwntableau || (!!normalizedRegion && tableauDirection === normalizedRegion))
                      const canApproveAsFinance = canApproveFinancetableaux
                        && !decl.isApproved
                        && (isOwntableau || isSiegetableau)
                      const canApproveAsAdmin = isAdminRole && !decl.isApproved
                      const canApproveThistableau = canApproveAsAdmin || canApproveAsRegional || canApproveAsFinance
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
                                Cléturée
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
                              {(isAdminRole || canApproveRegionaltableaux || canApproveFinancetableaux) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={!canApproveThistableau}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleApprove(decl)
                                  }}
                                  title={decl.isApproved ? "tableau déjé approuvée" : !canApproveThistableau ? "Action non autorisée pour cette tableau" : "Approuver"}
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
                                title={isLocked ? "Période cléturée (suppression impossible)" : "Supprimer"}
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

      </div>

      {/* aa Consult Dialog aa */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="!w-[96vw] sm:!w-[92vw] xl:!w-[86vw] !max-w-[1400px] h-[86vh] p-0 overflow-hidden">
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
            <div className="h-[calc(86vh-140px)] overflow-auto bg-slate-50/60 px-6 py-5">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div ref={consultTableContainerRef} className="overflow-x-auto [&_table]:w-max [&_table]:min-w-full [&_table]:border-collapse [&_th]:whitespace-normal [&_th]:align-middle [&_td]:align-middle">
                  <TabDataView tabKey={viewTabKey} decl={viewDecl} color={viewTabColor} />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {(() => {
                  const isLocked = istableauLocked(viewDecl)

                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isLocked}
                      title={isLocked ? "Période cléturée (modification impossible)" : "Modifier"}
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
                  onClick={handleExportDialogToExcel}
                >
                  <FileSpreadsheet size={13} /> Exporter Excel (.xlsx)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => { if (viewDecl) handlePrint(viewDecl, viewTabKey) }}
                >
                  <Printer size={13} /> Imprimer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </LayoutWrapper>
  )
}


