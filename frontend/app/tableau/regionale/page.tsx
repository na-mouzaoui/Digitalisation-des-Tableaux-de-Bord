"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Suspense } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { useTableauStepNavigation } from "@/hooks/use-tableau-step-navigation"
import { TableauHeader } from "@/components/tableau-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Save, ArrowRight, Pencil } from "lucide-react"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import { API_BASE } from "@/lib/config"
import { fetchKpiRowsMap } from "@/lib/kpi-rows"
import DynamicKpiTabs from "@/components/dynamic-kpi-tabs"
import { DomainAccessGuard } from "@/components/domain-access-guard"
// ?????????????????????????????????????????????????????????????????????????????
// 1. CONSTANTES GLOBALES
// ?????????????????????????????????????????????????????????????????????????????
const PRIMARY_COLOR = "#2db34b"


// ?????????????????????????????????????????????????????????????????????????????
// 2. STUBS POLITIQUE FISCALE
// ?????????????????????????????????????????????????????????????????????????????
const getCurrenttableauPeriod = (now: Date = new Date()) => ({
  mois: String(now.getMonth() + 1).padStart(2, "0"),
  annee: String(now.getFullYear()),
})
const gettableauPeriodLockMessage = (mois: string, annee: string, _role?: string | null) => `Période ${mois}/${annee}.`
const istableauPeriodLocked = (_mois: string, _annee: string, _role?: string | null) => false
const synctableauPolicy = async (_direction?: string | null) => null
const isAdmintableauRole = (_role?: string | null) => false
const isRegionaltableauRole = (_role?: string | null) => false
const isFinancetableauRole = (_role?: string | null) => false
const getManageabletableauTabKeysForDirection = (_role?: string | null, _direction?: string | null) => TABS.map((tab) => tab.key)
const istableauTabDisabledByPolicy = (_tabKey?: string) => false


// ?????????????????????????????????????????????????????????????????????????????
// 3. HELPERS DE FORMATAGE DES MONTANTS
// ?????????????????????????????????????????????????????????????????????????????
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


// ?????????????????????????????????????????????????????????????????????????????
// 4. COMPOSANT GéNéRIQUE : AmountInput
// ?????????????????????????????????????????????????????????????????????????????
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


// ?????????????????????????????????????????????????????????????????????????????
// 5. TYPES DE DONNéES (TABLEAUX CONSERVéS UNIQUEMENT)
// ?????????????????????????????????????????????????????????????????????????????

// ?? Commerciale DR ??????????????????????????????????????????????????
type CommercialeDrRow = { label: string; m1Realise: string; m1Objectif: string; mRealise: string; mTaux: string }
const COMMERCIALE_DR_LABELS = ["Chiffre d'Affaires", "Activation SIM", "Stock SIM", "Stock Carte de Recharge"] as const
const DEFAULT_COMMERCIALE_DR_ROWS: CommercialeDrRow[] =
  COMMERCIALE_DR_LABELS.map((label) => ({ label, m1Realise: "", m1Objectif: "", mRealise: "", mTaux: "" }))

// ?? Reseau de Distribution ??????????????????????????????????????????
type ReseauDistributionRow = { label: string; m1Recrute: string; m1Realise: string; mRecrute: string; mRealise: string; mEcart: string; situation: string }

// ?? Genie Civil & Environnement ??????????????????????????????????????
type GenieCivilRow = { label: string; m1Realise: string; m1Objectif: string; mRealise: string; mTaux: string }
const GENIE_CIVIL_LABELS = ["Acquisition des nouveaux sites", "Notes de calculs", "Acquisition des nouveaux sites SUCE", "Construction GC des nouveaux sites SUCES", "Construction GC de nouveaux sites", "Renforcement GC"] as const
const DEFAULT_GENIE_CIVIL_ROWS: GenieCivilRow[] =
  GENIE_CIVIL_LABELS.map((label) => ({ label, m1Realise: "", m1Objectif: "", mRealise: "", mTaux: "" }))

// ?? Maintenance & Equipements ????????????????????????????????????????
type MaintenanceEquipementRow = { label: string; m1Realise: string; m1Objectif: string; mRealise: string; mTaux: string }
const MAINTENANCE_EQUIPEMENT_LABELS = ["Maintenance curative des sites", "Maintenance preventive des sites", "Acquisition de 100 groupes electrogenes de differentes puissances", "Equipements electriques (transfos MT-BT)", "Alimentation des sites SUCE par une solution solaire", "Acquisition des climatiseurs split-systeme pour les sites techniques"] as const
const DEFAULT_MAINTENANCE_EQUIPEMENT_ROWS: MaintenanceEquipementRow[] =
  MAINTENANCE_EQUIPEMENT_LABELS.map((label) => ({ label, m1Realise: "", m1Objectif: "", mRealise: "", mTaux: "" }))

// ?? Nouveaux Sites & Extension Radio ?????????????????????????????????
type NouveauxSitesRow = { label: string; m1Realise: string; m1Objectif: string; mRealise: string; mTaux: string }
const NOUVEAUX_SITES_LABELS = ["Nouveaux Sites ON AIR", "Densification du LTE_30Mhz (1800_15+2100_15)", "Ajout de la couche LTE TDD 2300", "Modernisation Module RADIO", "Introduction de la nouvelle technologie 5G + Implementation de la couche LTE TDD 2600", "Ajout de la couche LTE 900", "Nouveaux sites SUCE"] as const
const DEFAULT_NOUVEAUX_SITES_ROWS: NouveauxSitesRow[] =
  NOUVEAUX_SITES_LABELS.map((label) => ({ label, m1Realise: "", m1Objectif: "", mRealise: "", mTaux: "" }))

const RESEAU_DISTRIBUTION_LABELS = ["Nombre Agence", "Nombre Point de vente Agree", "Nombre Point de Vente Arsseli", "Nombre Point de Presence VI"] as const
const DEFAULT_RESEAU_DISTRIBUTION_ROWS: ReseauDistributionRow[] =
  RESEAU_DISTRIBUTION_LABELS.map((label) => ({ label, m1Recrute: "", m1Realise: "", mRecrute: "", mRealise: "", mEcart: "", situation: "" }))

// ?? MTTR & Débit Internet ?????????????????????????????????????????
type MttrDebitRow = { wilaya: string; mttrObjectif: string; mttrRealise: string; mttrEcart: string; debitObjectif: string; debitRealise: string; debitEcart: string }
const EMPTY_MTTR_DEBIT_ROW: MttrDebitRow = { wilaya: "", mttrObjectif: "", mttrRealise: "", mttrEcart: "", debitObjectif: "", debitRealise: "", debitEcart: "" }

// ?? Acquisition Terrain & Location Immeuble ?????????????????????????
type AcquisitionTerrainRow = { wilaya: string; terrain: string; location: string }
const EMPTY_ACQUISITION_TERRAIN_ROW: AcquisitionTerrainRow = { wilaya: "", terrain: "", location: "" }

// ?? Recouvrement Contentieux ??????????????????????????????????????
type RecouvrementContentieuxRow = { label: string; m1Realise: string; mObjectif: string; mRealise: string; mTaux: string }
const RECOUVREMENT_CONTENTIEUX_LABELS = ["Envoi LMD"] as const
const DEFAULT_RECOUVREMENT_CONTENTIEUX_ROWS: RecouvrementContentieuxRow[] =
  RECOUVREMENT_CONTENTIEUX_LABELS.map((label) => ({ label, m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" }))

// ?? Ressources Humaines ????????????????????????????????????????????
type RessourcesHumainesRow = { label: string; m1Realise: string; mObjectif: string; mRealise: string; mTaux: string }
const RESSOURCES_HUMAINES_LABELS = ["Personnel Technique", "Personnel Commerciale", "Personnel Support", "Effectifs Total", "Taux d'Absentéisme"] as const
const DEFAULT_RESSOURCES_HUMAINES_ROWS: RessourcesHumainesRow[] =
  RESSOURCES_HUMAINES_LABELS.map((label) => ({ label, m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" }))

// ?? Formation ??????????????????????????????????????????????????????
type FormationRow = { label: string; m1Realise: string; mObjectif: string; mRealise: string; mTaux: string }
const FORMATION_LABELS = ["Nombre Effectifs Formés", "Nombre de Formations Réalisées"] as const
const DEFAULT_FORMATION_ROWS: FormationRow[] =
  FORMATION_LABELS.map((label) => ({ label, m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" }))


// ?????????????????????????????????????????????????????????????????????????????
// 6. COMPOSANTS DE TABLEAUX
// ?????????????????????????????????????????????????????????????????????????????

// ?? Bouton Save réutilisable ??????????????????????????????????????????????????
function SaveButton({ onSave, isSubmitting }: { onSave: () => void; isSubmitting: boolean }) {
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={onSave} disabled={isSubmitting} className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
        <Save size={13} /> {isSubmitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  )
}

// ?? 6d. Commerciale DR ??????????????????????????????????????????????
interface TabCommercialeDrProps { rows: CommercialeDrRow[]; setRows: React.Dispatch<React.SetStateAction<CommercialeDrRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabCommercialeDr({ rows, setRows, onSave, isSubmitting }: TabCommercialeDrProps) {
  const update = (index: number, field: "m1Realise" | "m1Objectif" | "mRealise" | "mTaux", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Realisations Commerciales</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Objectif} onChange={(e) => update(index, "m1Objectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}


// ?? 6e. Reseau de Distribution ??????????????????????????????????????
interface TabReseauDistributionProps { rows: ReseauDistributionRow[]; setRows: React.Dispatch<React.SetStateAction<ReseauDistributionRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabReseauDistribution({ rows, setRows, onSave, isSubmitting }: TabReseauDistributionProps) {
  const update = (index: number, field: keyof ReseauDistributionRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Reseau de Distribution</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Situation Actuelle</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Recrute</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Recrute</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Ecart</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Recrute} onChange={(e) => update(index, "m1Recrute", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRecrute} onChange={(e) => update(index, "mRecrute", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mEcart} onChange={(e) => update(index, "mEcart", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.situation} onChange={(e) => update(index, "situation", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}


// ?? 6f. Genie Civil & Environnement ??????????????????????????????????
interface TabGenieCivilProps { rows: GenieCivilRow[]; setRows: React.Dispatch<React.SetStateAction<GenieCivilRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabGenieCivil({ rows, setRows, onSave, isSubmitting }: TabGenieCivilProps) {
  const update = (index: number, field: "m1Realise" | "m1Objectif" | "mRealise" | "mTaux", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Genie Civil & Environnement</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Objectif} onChange={(e) => update(index, "m1Objectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? 6g. Maintenance & Equipements ???????????????????????????????????
interface TabMaintenanceEquipementProps { rows: MaintenanceEquipementRow[]; setRows: React.Dispatch<React.SetStateAction<MaintenanceEquipementRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabMaintenanceEquipement({ rows, setRows, onSave, isSubmitting }: TabMaintenanceEquipementProps) {
  const update = (index: number, field: "m1Realise" | "m1Objectif" | "mRealise" | "mTaux", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Maintenance & Equipements</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Objectif} onChange={(e) => update(index, "m1Objectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}


// ?? 6h. Nouveaux Sites & Extension Radio ?????????????????????????????
interface TabNouveauxSitesProps { rows: NouveauxSitesRow[]; setRows: React.Dispatch<React.SetStateAction<NouveauxSitesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabNouveauxSites({ rows, setRows, onSave, isSubmitting }: TabNouveauxSitesProps) {
  const update = (index: number, field: "m1Realise" | "m1Objectif" | "mRealise" | "mTaux", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Nouveaux Sites & Extension Radio</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Realise</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Objectif} onChange={(e) => update(index, "m1Objectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}


// ?? 6i. MTTR & Débit Internet ?????????????????????????????????????
interface TabMttrDebitProps { rows: MttrDebitRow[]; setRows: React.Dispatch<React.SetStateAction<MttrDebitRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabMttrDebit({ rows, setRows, onSave, isSubmitting }: TabMttrDebitProps) {
  const update = (i: number, field: keyof MttrDebitRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_MTTR_DEBIT_ROW }])
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={addRow} className="gap-1"><Plus size={12} /> Ajouter une wilaya</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Wilaya</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">MTTR</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Débit Internet</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Action</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Écart</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Écart</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="bg-white">
                <td className="px-1 py-1 border-b"><Input value={row.wilaya} onChange={(e) => update(index, "wilaya", e.target.value)} className="h-7 px-2 text-xs" placeholder="Wilaya" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mttrObjectif} onChange={(e) => update(index, "mttrObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mttrRealise}  onChange={(e) => update(index, "mttrRealise",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mttrEcart}    onChange={(e) => update(index, "mttrEcart",    e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.debitObjectif} onChange={(e) => update(index, "debitObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.debitRealise}  onChange={(e) => update(index, "debitRealise",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.debitEcart}    onChange={(e) => update(index, "debitEcart",    e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b text-center">
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(index)} disabled={rows.length <= 1} className="h-7 w-7 text-red-600"><Trash2 size={12} /></Button>
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


// ?? 6j. Acquisition Terrain & Location Immeuble ?????????????????????
interface TabAcquisitionTerrainProps { rows: AcquisitionTerrainRow[]; setRows: React.Dispatch<React.SetStateAction<AcquisitionTerrainRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabAcquisitionTerrain({ rows, setRows, onSave, isSubmitting }: TabAcquisitionTerrainProps) {
  const update = (i: number, field: keyof AcquisitionTerrainRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ACQUISITION_TERRAIN_ROW }])
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={addRow} className="gap-1"><Plus size={12} /> Ajouter une wilaya</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Wilaya</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Situation Terrain</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Situation Location Immeuble</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="bg-white">
                <td className="px-1 py-1 border-b"><Input value={row.wilaya} onChange={(e) => update(index, "wilaya", e.target.value)} className="h-7 px-2 text-xs" placeholder="Wilaya" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.terrain} onChange={(e) => update(index, "terrain", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.location} onChange={(e) => update(index, "location", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b text-center">
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(index)} disabled={rows.length <= 1} className="h-7 w-7 text-red-600"><Trash2 size={12} /></Button>
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


// ?? 6k. Recouvrement Contentieux ??????????????????????????????????
interface TabRecouvrementContentieuxProps { rows: RecouvrementContentieuxRow[]; setRows: React.Dispatch<React.SetStateAction<RecouvrementContentieuxRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabRecouvrementContentieux({ rows, setRows, onSave, isSubmitting }: TabRecouvrementContentieuxProps) {
  const update = (index: number, field: "m1Realise" | "mObjectif" | "mRealise" | "mTaux", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Recouvrement Contentieux</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mObjectif} onChange={(e) => update(index, "mObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}


// ?? 6k. Ressources Humaines ?????????????????????????????????????????
interface TabRessourcesHumainesProps { rows: RessourcesHumainesRow[]; setRows: React.Dispatch<React.SetStateAction<RessourcesHumainesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabRessourcesHumaines({ rows, setRows, onSave, isSubmitting }: TabRessourcesHumainesProps) {
  const update = (index: number, field: "m1Realise" | "mObjectif" | "mRealise" | "mTaux", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Ressources Humaines</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mObjectif} onChange={(e) => update(index, "mObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}


// ?? 6l. Formation ???????????????????????????????????????????????????
interface TabFormationProps { rows: FormationRow[]; setRows: React.Dispatch<React.SetStateAction<FormationRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabFormation({ rows, setRows, onSave, isSubmitting }: TabFormationProps) {
  const update = (index: number, field: "m1Realise" | "mObjectif" | "mRealise" | "mTaux", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Formation</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mObjectif} onChange={(e) => update(index, "mObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}


// ?????????????????????????????????????????????????????????????????????????????
// 7. CONFIGURATION DES ONGLETS (TABLEAUX CONSERVéS UNIQUEMENT)
// ?????????????????????????????????????????????????????????????????????????????
const TABS = [
  { key: "genie_civil",                    label: "Genie Civil & Environnement",           color: PRIMARY_COLOR, title: "GENIE CIVIL & ENVIRONNEMENT" },
  { key: "maintenance_equipement",         label: "Maintenance & Equipements",              color: PRIMARY_COLOR, title: "MAINTENANCE & EQUIPEMENTS" },
  { key: "nouveaux_sites",                 label: "Nouveaux Sites & Extension Radio",       color: PRIMARY_COLOR, title: "NOUVEAUX SITES & EXTENSION RADIO" },
  { key: "mttr_debit",                     label: "MTTR & Debit Internet",                  color: PRIMARY_COLOR, title: "MTTR & DEBIT INTERNET" },
  { key: "recouvrement_contentieux",       label: "Recouvrement Contentieux",               color: PRIMARY_COLOR, title: "RECOUVREMENT CONTENTIEUX" },
  { key: "ressources_humaines",            label: "Ressources Humaines",                    color: PRIMARY_COLOR, title: "RESSOURCES HUMAINES" },
  { key: "formation",                      label: "Formation",                              color: PRIMARY_COLOR, title: "FORMATION" },
  { key: "acquisition_terrain",            label: "Acquisition Terrain & Location Immeuble", color: PRIMARY_COLOR, title: "ACQUISITION TERRAIN & LOCATION IMMEUBLE" },
  { key: "realisations_commerciales",                 label: "Commercial",                             color: PRIMARY_COLOR, title: "REALISATIONS COMMERCIALES" },
]

const CUSTOM_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type TabKey =
  | "genie_civil"
  | "maintenance_equipement"
  | "nouveaux_sites"
  | "mttr_debit"
  | "recouvrement_contentieux"
  | "ressources_humaines"
  | "formation"
  | "acquisition_terrain"
  | "realisations_commerciales"
  | "reseau_distribution"

type CategoryKey = "reseau" | "commerciale" | "support" | "csm" | "all"

const CATEGORY_OPTIONS: Array<{ key: CategoryKey; label: string; tabKeys: TabKey[] }> = [
  { key: "commerciale", label: "Commerciale", tabKeys: ["realisations_commerciales"] },
  { key: "reseau", label: "Technique",   tabKeys: ["genie_civil", "maintenance_equipement", "nouveaux_sites", "mttr_debit"] },
  { key: "support", label: "Support",    tabKeys: ["recouvrement_contentieux", "ressources_humaines", "formation"] },
  { key: "csm", label: "CSM",           tabKeys: ["acquisition_terrain"] },
  { key: "all", label: "Tous",        tabKeys: ["genie_civil", "maintenance_equipement", "nouveaux_sites", "mttr_debit", "recouvrement_contentieux", "ressources_humaines", "formation", "acquisition_terrain", "realisations_commerciales"] },
]

const KPI_TAB_KEYS = [
  "genie_civil",
  "maintenance_equipement",
  "nouveaux_sites",
  "mttr_debit",
  "recouvrement_contentieux",
  "ressources_humaines",
  "formation",
  "acquisition_terrain",
  "realisations_commerciales",
  "reseau_distribution",
]

const findCategoryKeyForTab = (tabKey: string): CategoryKey =>
  CATEGORY_OPTIONS.find((c) => c.tabKeys.includes(tabKey as TabKey))?.key ?? "reseau"

const isValidTabKey = (value: string): value is TabKey =>
  TABS.some((tab) => tab.key === value) || value === "reseau_distribution"

const MONTHS = [
  { value: "01", label: "Janvier" },  { value: "02", label: "Fevrier" },
  { value: "03", label: "Mars" },     { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },      { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },  { value: "08", label: "Aout" },
  { value: "09", label: "Septembre" },{ value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" }, { value: "12", label: "Decembre" },
]
const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_PERIOD = getCurrenttableauPeriod()
const YEARS = Array.from({ length: 101 }, (_, i) => (2000 + i).toString())


// ?????????????????????????????????????????????????????????????????????????????
// 8. TYPES & HELPERS D'API / STOCKAGE
// ?????????????????????????????????????????????????????????????????????????????

// ?? 8a. Type de la déclaration sauvegardée ???????????????????????????????????
interface SavedData {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  genieCivilRows?: GenieCivilRow[]
  maintenanceEquipementRows?: MaintenanceEquipementRow[]
  nouveauxSitesRows?: NouveauxSitesRow[]
  mttrDebitRows?: MttrDebitRow[]
  recouvrementContentieuxRows?: RecouvrementContentieuxRow[]
  ressourcesHumainesRows?: RessourcesHumainesRow[]
  formationRows?: FormationRow[]
  acquisitionTerrainRows?: AcquisitionTerrainRow[]
  commercialeDrRows?: CommercialeDrRow[]
  reseauDistributionRows?: ReseauDistributionRow[]
}

// ?? 8b. Type retourné par l'API ??????????????????????????????????????????????
type ApiData = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

// ?? 8c. Helpers utilitaires ??????????????????????????????????????????????????
const safeString = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

const normalizeMonthValue = (value: string) =>
  MONTHS.some((m) => m.value === value) ? value : String(new Date().getMonth() + 1).padStart(2, "0")

const normalizeYearValue = (value: string) =>
  YEARS.includes(value) ? value : String(CURRENT_YEAR)

// ?? 8d. Fonctions de normalisation par tableau ????????????????????????????????
const normalizeCommercialeDrRows = (rows?: CommercialeDrRow[]): CommercialeDrRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return COMMERCIALE_DR_LABELS.map((label, i) => ({
    label,
    m1Realise: safeString(src[i]?.m1Realise),
    m1Objectif: safeString(src[i]?.m1Objectif),
    mRealise: safeString(src[i]?.mRealise),
    mTaux: safeString(src[i]?.mTaux),
  }))
}

const normalizeReseauDistributionRows = (rows?: ReseauDistributionRow[]): ReseauDistributionRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return RESEAU_DISTRIBUTION_LABELS.map((label, i) => ({
    label,
    m1Recrute: safeString(src[i]?.m1Recrute),
    m1Realise: safeString(src[i]?.m1Realise),
    mRecrute: safeString(src[i]?.mRecrute),
    mRealise: safeString(src[i]?.mRealise),
    mEcart: safeString(src[i]?.mEcart),
    situation: safeString(src[i]?.situation),
  }))
}

const normalizeGenieCivilRows = (rows?: GenieCivilRow[]): GenieCivilRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return GENIE_CIVIL_LABELS.map((label, i) => ({
    label,
    m1Realise: safeString(src[i]?.m1Realise),
    m1Objectif: safeString(src[i]?.m1Objectif),
    mRealise: safeString(src[i]?.mRealise),
    mTaux: safeString(src[i]?.mTaux),
  }))
}

const normalizeMaintenanceEquipementRows = (rows?: MaintenanceEquipementRow[]): MaintenanceEquipementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return MAINTENANCE_EQUIPEMENT_LABELS.map((label, i) => ({
    label,
    m1Realise: safeString(src[i]?.m1Realise),
    m1Objectif: safeString(src[i]?.m1Objectif),
    mRealise: safeString(src[i]?.mRealise),
    mTaux: safeString(src[i]?.mTaux),
  }))
}

const normalizeMttrDebitRows = (rows?: MttrDebitRow[]): MttrDebitRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return src.length > 0 ? src.map((r) => ({ wilaya: safeString(r.wilaya), mttrObjectif: safeString(r.mttrObjectif), mttrRealise: safeString(r.mttrRealise), mttrEcart: safeString(r.mttrEcart), debitObjectif: safeString(r.debitObjectif), debitRealise: safeString(r.debitRealise), debitEcart: safeString(r.debitEcart) })) : [{ ...EMPTY_MTTR_DEBIT_ROW }]
}

const normalizeRecouvrementContentieuxRows = (rows?: RecouvrementContentieuxRow[]): RecouvrementContentieuxRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return RECOUVREMENT_CONTENTIEUX_LABELS.map((label, i) => ({
    label,
    m1Realise: safeString(src[i]?.m1Realise),
    mObjectif: safeString(src[i]?.mObjectif),
    mRealise: safeString(src[i]?.mRealise),
    mTaux: safeString(src[i]?.mTaux),
  }))
}

const normalizeRessourcesHumainesRows = (rows?: RessourcesHumainesRow[]): RessourcesHumainesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return RESSOURCES_HUMAINES_LABELS.map((label, i) => ({
    label,
    m1Realise: safeString(src[i]?.m1Realise),
    mObjectif: safeString(src[i]?.mObjectif),
    mRealise: safeString(src[i]?.mRealise),
    mTaux: safeString(src[i]?.mTaux),
  }))
}

const normalizeFormationRows = (rows?: FormationRow[]): FormationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return FORMATION_LABELS.map((label, i) => ({
    label,
    m1Realise: safeString(src[i]?.m1Realise),
    mObjectif: safeString(src[i]?.mObjectif),
    mRealise: safeString(src[i]?.mRealise),
    mTaux: safeString(src[i]?.mTaux),
  }))
}

const normalizeAcquisitionTerrainRows = (rows?: AcquisitionTerrainRow[]): AcquisitionTerrainRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return src.length > 0 ? src.map((r) => ({ wilaya: safeString(r.wilaya), terrain: safeString(r.terrain), location: safeString(r.location) })) : [{ ...EMPTY_ACQUISITION_TERRAIN_ROW }]
}

const normalizeNouveauxSitesRows = (rows?: NouveauxSitesRow[]): NouveauxSitesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return NOUVEAUX_SITES_LABELS.map((label, i) => ({
    label,
    m1Realise: safeString(src[i]?.m1Realise),
    m1Objectif: safeString(src[i]?.m1Objectif),
    mRealise: safeString(src[i]?.mRealise),
    mTaux: safeString(src[i]?.mTaux),
  }))
}

const resolveTabKey = (decl: SavedData): TabKey => {
  if ((decl.genieCivilRows?.length ?? 0) > 0) return "genie_civil"
  if ((decl.maintenanceEquipementRows?.length ?? 0) > 0) return "maintenance_equipement"
  if ((decl.nouveauxSitesRows?.length ?? 0) > 0) return "nouveaux_sites"
  if ((decl.mttrDebitRows?.length ?? 0) > 0) return "mttr_debit"
  if ((decl.recouvrementContentieuxRows?.length ?? 0) > 0) return "recouvrement_contentieux"
  if ((decl.ressourcesHumainesRows?.length ?? 0) > 0) return "ressources_humaines"
  if ((decl.formationRows?.length ?? 0) > 0) return "formation"
  if ((decl.acquisitionTerrainRows?.length ?? 0) > 0) return "acquisition_terrain"
  if ((decl.commercialeDrRows?.length ?? 0) > 0) return "realisations_commerciales"
  if ((decl.reseauDistributionRows?.length ?? 0) > 0) return "realisations_commerciales"
  return "genie_civil"
}


// 
// PAGE
function RegionalePageContent() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
  useTableauStepNavigation("regionale")
  const printRef = useRef<HTMLDivElement>(null)
  const [editQuery, setEditQuery] = useState<{ editId: string; tab: string }>({ editId: "", tab: "" })

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

    const requestedTab = safeString(params.get("tab")).trim()
    if (requestedTab) {
      setActiveTab(requestedTab)
      const category = CATEGORY_OPTIONS.find((c) => c.tabKeys.includes(requestedTab as TabKey))
      if (category) {
        setSelectedCategoryKey(category.key)
      }
    }
  }, [])

  // Global meta
  const [activeTab, setActiveTab] = useState("realisations_commerciales")
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<CategoryKey>("commerciale")
  const [direction, setDirection] = useState("")
  const [mois, setMois] = useState(INITIAL_PERIOD.mois)
  const [annee, setAnnee] = useState(INITIAL_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [policyRevision, setPolicyRevision] = useState(0)
  const [kpiRows, setKpiRows] = useState<Record<string, string[]>>({})

  // Tab data
  const [commercialeDrRows, setCommercialeDrRows] = useState<CommercialeDrRow[]>(DEFAULT_COMMERCIALE_DR_ROWS.map((row) => ({ ...row })))
  const [reseauDistributionRows, setReseauDistributionRows] = useState<ReseauDistributionRow[]>(DEFAULT_RESEAU_DISTRIBUTION_ROWS.map((row) => ({ ...row })))
  const [genieCivilRows, setGenieCivilRows] = useState<GenieCivilRow[]>(DEFAULT_GENIE_CIVIL_ROWS.map((row) => ({ ...row })))
  const [maintenanceEquipementRows, setMaintenanceEquipementRows] = useState<MaintenanceEquipementRow[]>(DEFAULT_MAINTENANCE_EQUIPEMENT_ROWS.map((row) => ({ ...row })))
  const [nouveauxSitesRows, setNouveauxSitesRows] = useState<NouveauxSitesRow[]>(DEFAULT_NOUVEAUX_SITES_ROWS.map((row) => ({ ...row })))
  const [mttrDebitRows, setMttrDebitRows] = useState<MttrDebitRow[]>([{ ...EMPTY_MTTR_DEBIT_ROW }])
  const [recouvrementContentieuxRows, setRecouvrementContentieuxRows] = useState<RecouvrementContentieuxRow[]>(DEFAULT_RECOUVREMENT_CONTENTIEUX_ROWS.map((row) => ({ ...row })))
  const [ressourcesHumainesRows, setRessourcesHumainesRows] = useState<RessourcesHumainesRow[]>(DEFAULT_RESSOURCES_HUMAINES_ROWS.map((row) => ({ ...row })))
  const [formationRows, setFormationRows] = useState<FormationRow[]>(DEFAULT_FORMATION_ROWS.map((row) => ({ ...row })))
  const [acquisitionTerrainRows, setAcquisitionTerrainRows] = useState<AcquisitionTerrainRow[]>([{ ...EMPTY_ACQUISITION_TERRAIN_ROW }])
  const [declarations, setDeclarations] = useState<ApiData[]>([])
  const [tabComment, setTabComment] = useState("")
  const [isEditingComment, setIsEditingComment] = useState(false)
  const [hasExistingComment, setHasExistingComment] = useState(false)
  const savedCommentRef = useRef("")

  const userRole = user?.role ?? ""
  const isAdminRole = isAdmintableauRole(userRole)
  const isRegionalRole = isRegionaltableauRole(userRole)
  const isFinanceRole = isFinancetableauRole(userRole)
  const adminSelectedDirection = safeString(direction).trim()

    useEffect(() => {
      let cancelled = false
      const loadKpis = async () => {
        const map = await fetchKpiRowsMap(KPI_TAB_KEYS, "Regionale")
        if (!cancelled) {
          setKpiRows(map)
        }
      }
      loadKpis()
      return () => { cancelled = true }
    }, [])

    useEffect(() => {
      const getLabels = (key: string, fallback: readonly string[]) => {
        const rows = kpiRows[key]
        return rows && rows.length > 0 ? rows : Array.from(fallback)
      }

      const commercialeDrLabels = getLabels("realisations_commerciales", COMMERCIALE_DR_LABELS)
      setCommercialeDrRows((prev) => commercialeDrLabels.map((label, i) => ({
        label,
        m1Realise: safeString(prev[i]?.m1Realise),
        m1Objectif: safeString(prev[i]?.m1Objectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const reseauDistributionLabels = getLabels("reseau_distribution", RESEAU_DISTRIBUTION_LABELS)
      setReseauDistributionRows((prev) => reseauDistributionLabels.map((label, i) => ({
        label,
        m1Recrute: safeString(prev[i]?.m1Recrute),
        m1Realise: safeString(prev[i]?.m1Realise),
        mRecrute: safeString(prev[i]?.mRecrute),
        mRealise: safeString(prev[i]?.mRealise),
        mEcart: safeString(prev[i]?.mEcart),
        situation: safeString(prev[i]?.situation),
      })))

      const genieCivilLabels = getLabels("genie_civil", GENIE_CIVIL_LABELS)
      setGenieCivilRows((prev) => genieCivilLabels.map((label, i) => ({
        label,
        m1Realise: safeString(prev[i]?.m1Realise),
        m1Objectif: safeString(prev[i]?.m1Objectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const maintenanceEquipementLabels = getLabels("maintenance_equipement", MAINTENANCE_EQUIPEMENT_LABELS)
      setMaintenanceEquipementRows((prev) => maintenanceEquipementLabels.map((label, i) => ({
        label,
        m1Realise: safeString(prev[i]?.m1Realise),
        m1Objectif: safeString(prev[i]?.m1Objectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const nouveauxSitesLabels = getLabels("nouveaux_sites", NOUVEAUX_SITES_LABELS)
      setNouveauxSitesRows((prev) => nouveauxSitesLabels.map((label, i) => ({
        label,
        m1Realise: safeString(prev[i]?.m1Realise),
        m1Objectif: safeString(prev[i]?.m1Objectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const recouvrementContentieuxLabels = getLabels("recouvrement_contentieux", RECOUVREMENT_CONTENTIEUX_LABELS)
      setRecouvrementContentieuxRows((prev) => recouvrementContentieuxLabels.map((label, i) => ({
        label,
        m1Realise: safeString(prev[i]?.m1Realise),
        mObjectif: safeString(prev[i]?.mObjectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const ressourcesHumainesLabels = getLabels("ressources_humaines", RESSOURCES_HUMAINES_LABELS)
      setRessourcesHumainesRows((prev) => ressourcesHumainesLabels.map((label, i) => ({
        label,
        m1Realise: safeString(prev[i]?.m1Realise),
        mObjectif: safeString(prev[i]?.mObjectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const formationLabels = getLabels("formation", FORMATION_LABELS)
      setFormationRows((prev) => formationLabels.map((label, i) => ({
        label,
        m1Realise: safeString(prev[i]?.m1Realise),
        mObjectif: safeString(prev[i]?.mObjectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const acquisitionTerrainLabels = kpiRows["acquisition_terrain"]
      if (acquisitionTerrainLabels && acquisitionTerrainLabels.length > 0) {
        setAcquisitionTerrainRows((prev) => acquisitionTerrainLabels.map((wilaya, i) => ({
          wilaya,
          terrain: safeString(prev[i]?.terrain),
          location: safeString(prev[i]?.location),
        })))
      }

      const mttrDebitLabels = kpiRows["mttr_debit"]
      if (mttrDebitLabels && mttrDebitLabels.length > 0) {
        setMttrDebitRows((prev) => mttrDebitLabels.map((wilaya, i) => ({
          wilaya,
          mttrObjectif: safeString(prev[i]?.mttrObjectif),
          mttrRealise: safeString(prev[i]?.mttrRealise),
          mttrEcart: safeString(prev[i]?.mttrEcart),
          debitObjectif: safeString(prev[i]?.debitObjectif),
          debitRealise: safeString(prev[i]?.debitRealise),
          debitEcart: safeString(prev[i]?.debitEcart),
        })))
      }
    }, [kpiRows])
  
  const manageableTabKeys = useMemo(
    () => new Set(getManageabletableauTabKeysForDirection(userRole, isAdminRole ? adminSelectedDirection : undefined)),
    [adminSelectedDirection, policyRevision, isAdminRole, userRole],
  )
  
  const availableTabs = useMemo(
    () => TABS.filter((tab) => manageableTabKeys.has(tab.key) || CUSTOM_TAB_KEYS.has(tab.key)),
    [manageableTabKeys],
  )
  
  const disabledTabKeys = useMemo(
    () => new Set(availableTabs.filter((tab) => istableauTabDisabledByPolicy(tab.key)).map((tab) => tab.key)),
    [availableTabs, policyRevision],
  )
  
  const selectableTabs = useMemo(
    () => availableTabs.map((tab) => ({ ...tab, isDisabled: disabledTabKeys.has(tab.key) })),
    [availableTabs, disabledTabKeys],
  )
  
  const declarationTabs = useMemo(
    () => selectableTabs.filter((tab) => CUSTOM_TAB_KEYS.has(tab.key)),
    [selectableTabs],
  )
  
  const categoryOptions = useMemo(() => {
    const availableKeys = new Set(declarationTabs.map((tab) => tab.key))
    return CATEGORY_OPTIONS.filter(
      (category) => category.key === "all" || category.tabKeys.some((tabKey) => availableKeys.has(tabKey)),
    )
  }, [declarationTabs])
  
  const filteredTabs = useMemo(() => {
    const selectedCategory = categoryOptions.find((category) => category.key === selectedCategoryKey)
    if (!selectedCategory) return declarationTabs
    const categoryTabKeys = new Set(selectedCategory.tabKeys)
    return declarationTabs.filter((tab) => categoryTabKeys.has(tab.key as TabKey))
  }, [categoryOptions, declarationTabs, selectedCategoryKey])
  
  const selectableYears = useMemo(
    () => YEARS.filter((year) => MONTHS.some((month) => !istableauPeriodLocked(month.value, year, userRole))),
    [policyRevision, userRole],
  )
  
  const selectableMonths = useMemo(
    () => MONTHS.filter((month) => !istableauPeriodLocked(month.value, annee, userRole)),
    [annee, policyRevision, userRole],
  )
  
  const hasFiscalTabAccess = declarationTabs.length > 0

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
        setPolicyRevision((prev) => prev + 1)
      }
    }
    syncPolicy()
    return () => { cancelled = true }
  }, [adminSelectedDirection, isAdminRole, userRole])

  const canManageTabForDirection = useCallback(
    (tabKey: string, directionValue: string) => {
      if (CUSTOM_TAB_KEYS.has(tabKey)) return true
      return getManageabletableauTabKeysForDirection(userRole, isAdminRole ? directionValue : undefined).includes(tabKey)
    },
    [policyRevision, isAdminRole, userRole],
  )

  useEffect(() => {
    if (filteredTabs.length === 0) return
    const firstEnabledTab = filteredTabs.find((tab) => !tab.isDisabled)?.key ?? filteredTabs[0].key
    if (!filteredTabs.some((tab) => tab.key === activeTab) || disabledTabKeys.has(activeTab)) {
      setActiveTab(firstEnabledTab)
    }
  }, [activeTab, disabledTabKeys, filteredTabs])

  useEffect(() => {
    if (categoryOptions.some((category) => category.key === selectedCategoryKey)) return
    setSelectedCategoryKey(categoryOptions[0]?.key ?? "reseau")
  }, [categoryOptions, selectedCategoryKey])

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
        const declarationsData = Array.isArray(payload)
          ? payload.map((item) => ({
              id: Number((item as { id?: unknown }).id ?? 0),
              tabKey: String((item as { tabKey?: unknown }).tabKey ?? "").trim().toLowerCase(),
              mois: String((item as { mois?: unknown }).mois ?? "").trim(),
              annee: String((item as { annee?: unknown }).annee ?? "").trim(),
              direction: String((item as { direction?: unknown }).direction ?? "").trim(),
              dataJson: String((item as { dataJson?: unknown }).dataJson ?? "{}"),
            }))
          : []
        if (!cancelled) setDeclarations(declarationsData)
      } catch {
        if (!cancelled) setDeclarations([])
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
      const declarationsStorage = Array.isArray(parsed) ? (parsed as SavedData[]) : []
      const declaration = declarationsStorage.find((item) => safeString(item.id) === editQuery.editId)
      if (!declaration) {
        toast({
          title: "Declaration introuvable",
          description: "La declaration demandee n'existe pas ou a deja ete supprimee.",
          variant: "destructive",
        })
        return
      }
      const requestedTab = isValidTabKey(editQuery.tab) ? editQuery.tab : 
resolveTabKey(declaration)
      const loadedDirection = safeString(declaration.direction).trim()
      const scopedDirection = isAdminRole ? loadedDirection : resolveDirectionForRole(loadedDirection)
      if (!isAdminRole && !canManageTabForDirection(requestedTab, scopedDirection)) {
        toast({
          title: "Acces refuse",
          description: "Votre profil n'est pas autorise a modifier ce tableau fiscal.",
          variant: "destructive",
        })
        router.push("/dashbord")
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
      setCommercialeDrRows(normalizeCommercialeDrRows(declaration.commercialeDrRows))
      setReseauDistributionRows(normalizeReseauDistributionRows(declaration.reseauDistributionRows))
      setGenieCivilRows(normalizeGenieCivilRows(declaration.genieCivilRows))
      setMaintenanceEquipementRows(normalizeMaintenanceEquipementRows(declaration.maintenanceEquipementRows))
      setNouveauxSitesRows(normalizeNouveauxSitesRows(declaration.nouveauxSitesRows))
      setMttrDebitRows(normalizeMttrDebitRows(declaration.mttrDebitRows))
      setRecouvrementContentieuxRows(normalizeRecouvrementContentieuxRows(declaration.recouvrementContentieuxRows))
      setRessourcesHumainesRows(normalizeRessourcesHumainesRows(declaration.ressourcesHumainesRows))
      setFormationRows(normalizeFormationRows(declaration.formationRows))
      setAcquisitionTerrainRows(normalizeAcquisitionTerrainRows(declaration.acquisitionTerrainRows))
    } catch {
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger la declaration a modifier.",
        variant: "destructive",
      })
    }
  }, [canManageTabForDirection, editQuery.editId, editQuery.tab, isAdminRole, isLoading, resolveDirectionForRole, router, status, user, toast])

  useEffect(() => {
    if (!activeTab || !mois || !annee || !effectiveDirection) return
    let cancelled = false
    const loadComment = async () => {
      try {
        const token = localStorage.getItem("jwt")
        const res = await fetch(`${API_BASE}/api/step-comment?tabKey=${encodeURIComponent(activeTab)}&mois=${encodeURIComponent(mois)}&annee=${encodeURIComponent(annee)}&direction=${encodeURIComponent(effectiveDirection)}`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setTabComment(data.comment ?? "")
          setHasExistingComment(!!data.comment)
          setIsEditingComment(false)
        }
      } catch { /* ignore */ }
    }
    loadComment()
    return () => { cancelled = true }
  }, [activeTab, mois, annee, effectiveDirection])

  const completedTabKeys = useMemo(() => {
    const keys = new Set<string>()
    const periodMois = safeString(mois).trim()
    const periodAnnee = safeString(annee).trim()
    const periodDirection = safeString(effectiveDirection).trim()

    declarations.forEach((decl) => {
      if (
        safeString(decl.mois).trim() === periodMois &&
        safeString(decl.annee).trim() === periodAnnee &&
        safeString(decl.direction).trim() === periodDirection &&
        isValidTabKey(decl.tabKey)
      ) {
        keys.add(decl.tabKey)
      }
    })

    return keys
  }, [annee, effectiveDirection, mois, declarations])

  if (isLoading || !user || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  const handleSave = async (tabKey: TabKey) => {
    const saveDirection = effectiveDirection
    const isAdminEditing = isAdminRole && !!editingDeclarationId
    
    if (!isAdminEditing && !canManageTabForDirection(tabKey, saveDirection)) {
      toast({
        title: "Acces refuse",
        description: "Votre profil n'est pas autorise a creer ou modifier ce tableau fiscal.",
        variant: "destructive",
      })
      return
    }

    if (disabledTabKeys.has(tabKey)) {
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

    let validationError = false
    switch (tabKey) {
      case "genie_civil":
        if (genieCivilRows.some((row) => !row.m1Realise || !row.m1Objectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Genie Civil.", variant: "destructive" })
          validationError = true
        }
        break
      case "maintenance_equipement":
        if (maintenanceEquipementRows.some((row) => !row.m1Realise || !row.m1Objectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Maintenance & Equipements.", variant: "destructive" })
          validationError = true
        }
        break
      case "nouveaux_sites":
        if (nouveauxSitesRows.some((row) => !row.m1Realise || !row.m1Objectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Nouveaux Sites & Extension Radio.", variant: "destructive" })
          validationError = true
        }
        break
      case "mttr_debit":
        if (mttrDebitRows.some((row) => !row.wilaya || !row.mttrObjectif || !row.mttrRealise || !row.mttrEcart || !row.debitObjectif || !row.debitRealise || !row.debitEcart)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau MTTR & Debit Internet.", variant: "destructive" })
          validationError = true
        }
        break
      case "recouvrement_contentieux":
        if (recouvrementContentieuxRows.some((row) => !row.m1Realise || !row.mObjectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Recouvrement Contentieux.", variant: "destructive" })
          validationError = true
        }
        break
      case "ressources_humaines":
        if (ressourcesHumainesRows.some((row) => !row.m1Realise || !row.mObjectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Ressources Humaines.", variant: "destructive" })
          validationError = true
        }
        break
      case "formation":
        if (formationRows.some((row) => !row.m1Realise || !row.mObjectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Formation.", variant: "destructive" })
          validationError = true
        }
        break
      case "acquisition_terrain":
        if (acquisitionTerrainRows.some((row) => !row.wilaya || !row.terrain || !row.location)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Acquisition Terrain & Location Immeuble.", variant: "destructive" })
          validationError = true
        }
        break
      case "realisations_commerciales":
        if (commercialeDrRows.some((row) => !row.m1Realise || !row.m1Objectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Realisations Commerciales.", variant: "destructive" })
          validationError = true
        }
        break
      case "reseau_distribution":
        if (reseauDistributionRows.some((row) => !row.m1Recrute || !row.m1Realise || !row.mRecrute || !row.mRealise || !row.mEcart || !row.situation)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Reseau de Distribution.", variant: "destructive" })
          validationError = true
        }
        break
    }
    if (validationError) return

    let existingDeclarations: SavedData[] = []
    try {
      const parsed = JSON.parse(localStorage.getItem("fiscal_declarations") ?? "[]")
      existingDeclarations = Array.isArray(parsed) ? (parsed as SavedData[]) : []
    } catch {
      existingDeclarations = []
    }

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 400))

    const declarationId = editingDeclarationId ?? Date.now().toString()
    const declarationCreatedAt = editingCreatedAt || new Date().toISOString()
    
    const baseDecl: SavedData = {
      id: declarationId,
      createdAt: declarationCreatedAt,
      direction: saveDirection,
      mois,
      annee,
    }
    
    switch (tabKey) {
      case "genie_civil":
        baseDecl.genieCivilRows = genieCivilRows
        break
      case "maintenance_equipement":
        baseDecl.maintenanceEquipementRows = maintenanceEquipementRows
        break
      case "nouveaux_sites":
        baseDecl.nouveauxSitesRows = nouveauxSitesRows
        break
      case "mttr_debit":
        baseDecl.mttrDebitRows = mttrDebitRows
        break
      case "recouvrement_contentieux":
        baseDecl.recouvrementContentieuxRows = recouvrementContentieuxRows
        break
      case "ressources_humaines":
        baseDecl.ressourcesHumainesRows = ressourcesHumainesRows
        break
      case "formation":
        baseDecl.formationRows = formationRows
        break
      case "acquisition_terrain":
        baseDecl.acquisitionTerrainRows = acquisitionTerrainRows
        break
      case "realisations_commerciales":
        baseDecl.commercialeDrRows = commercialeDrRows
        break
      case "reseau_distribution":
        baseDecl.reseauDistributionRows = reseauDistributionRows
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
      switch (tabKey) {
        case "genie_civil": tabData = { genieCivilRows }; break
        case "maintenance_equipement": tabData = { maintenanceEquipementRows }; break
        case "nouveaux_sites": tabData = { nouveauxSitesRows }; break
        case "mttr_debit": tabData = { mttrDebitRows }; break
        case "recouvrement_contentieux": tabData = { recouvrementContentieuxRows }; break
        case "ressources_humaines": tabData = { ressourcesHumainesRows }; break
        case "formation": tabData = { formationRows }; break
        case "acquisition_terrain": tabData = { acquisitionTerrainRows }; break
        case "realisations_commerciales": tabData = { commercialeDrRows }; break
        case "reseau_distribution": tabData = { reseauDistributionRows }; break
      }
      const requestPayload = {
        tabKey,
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

      await fetch(`${apiBase}/api/step-comment`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tabKey,
          mois,
          annee,
          direction: saveDirection,
          comment: tabComment,
        }),
      })

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
        const errorText = await createResponse.text().catch(() => "")
        const cleanText = errorText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        const details = cleanText.slice(0, 200)
        const message = details
          ? `Erreur lors de l'enregistrement: ${details}`
          : `Erreur lors de l'enregistrement (HTTP ${createResponse.status})`
        throw new Error(message)
      }

      const savedRecord = await createResponse.json().catch(() => null)
      const savedId = savedRecord?.id ?? 0
      if (savedId) {
        setDeclarations((prev) => {
          const filtered = editingDeclarationId ? prev.filter((d) => String(d.id) !== editingDeclarationId) : prev
          return [{
            id: savedId,
            tabKey,
            mois,
            annee,
            direction: saveDirection,
            dataJson: JSON.stringify(tabData),
          }, ...filtered]
        })
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
    
    const tabLabel = TABS.find((t) => t.key === tabKey)?.label ?? tabKey
    toast({
      title: editingDeclarationId ? "Declaration modifiee" : "Declaration enregistree",
      description: `La declaration "${tabLabel}" a ete sauvegardee avec succes.`,
    })
    setIsSubmitting(false)
    setActiveTab(tabKey)
  }

  const handleSaveComment = async () => {
    if (!activeTab || !mois || !annee || !effectiveDirection) return
    setIsCommentSubmitting(true)
    try {
      const apiBase = API_BASE
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      await fetch(`${apiBase}/api/step-comment`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tabKey: activeTab,
          mois,
          annee,
          direction: effectiveDirection,
          comment: tabComment,
        }),
      })
      setHasExistingComment(true)
      setIsEditingComment(false)
    } catch { /* ignore */ }
    setIsCommentSubmitting(false)
  }

  const handleDeleteComment = async () => {
    if (!activeTab || !mois || !annee || !effectiveDirection) return
    try {
      const apiBase = API_BASE
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      await fetch(`${apiBase}/api/step-comment?tabKey=${encodeURIComponent(activeTab)}&mois=${encodeURIComponent(mois)}&annee=${encodeURIComponent(annee)}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setTabComment("")
      setHasExistingComment(false)
      setIsEditingComment(false)
    } catch { /* ignore */ }
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

  const renderDisabledNotice = (tabKey: TabKey) =>
    disabledTabKeys.has(tabKey) ? (
      <p className="mb-3 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
        Ce tableau est desactive par l'administration. Il apparait en grise et ne peut pas etre enregistre.
      </p>
    ) : null

  const getExistingDeclarationForTab = (tabKey: TabKey): SavedData | null => {
    try {
      const parsed = JSON.parse(typeof localStorage !== "undefined" ? localStorage.getItem("regionale_declarations") ?? "[]" : "[]")
      const declarations: SavedData[] = Array.isArray(parsed) ? parsed : []
      return declarations.find(decl => {
        if (decl.mois !== mois || decl.annee !== annee || decl.direction !== effectiveDirection) return false
        if (editingDeclarationId && safeString(decl.id) === editingDeclarationId) return false
        return resolveTabKey(decl) === tabKey
      }) ?? null
    } catch {
      return null
    }
  }

  const renderExistingWarning = (tabKey: TabKey) => {
    const existing = getExistingDeclarationForTab(tabKey)
    return existing ? (
      <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
        Ce tableau a deja ete enregistre pour la periode {existing.mois}/{existing.annee}. Vous etes sur le point de le modifier.
      </p>
    ) : null
  }

  const handleStepClick = (pointKey: string) => {
    const category = CATEGORY_OPTIONS.find((c) => c.tabKeys.includes(pointKey as TabKey))
    if (category) {
      setSelectedCategoryKey(category.key)
    }
    const resolvedKey = pointKey === "reseau_distribution" ? "realisations_commerciales" : pointKey
    if (isValidTabKey(resolvedKey)) {
      setActiveTab(resolvedKey)
    }
  }

  const renderTabCard = (tabKey: TabKey) => {
    switch (tabKey) {
      case "genie_civil":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Genie Civil & Environnement</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabGenieCivil
                rows={genieCivilRows}
                setRows={setGenieCivilRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )
      case "maintenance_equipement":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Maintenance & Equipements</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabMaintenanceEquipement
                rows={maintenanceEquipementRows}
                setRows={setMaintenanceEquipementRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )
      case "nouveaux_sites":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Nouveaux Sites & Extension Radio</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabNouveauxSites
                rows={nouveauxSitesRows}
                setRows={setNouveauxSitesRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )
      case "mttr_debit":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>MTTR & Débit Internet</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabMttrDebit
                rows={mttrDebitRows}
                setRows={setMttrDebitRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )
      case "recouvrement_contentieux":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Recouvrement Contentieux</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabRecouvrementContentieux
                rows={recouvrementContentieuxRows}
                setRows={setRecouvrementContentieuxRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )
      case "ressources_humaines":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Ressources Humaines</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabRessourcesHumaines
                rows={ressourcesHumainesRows}
                setRows={setRessourcesHumainesRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )
      case "formation":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Formation</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabFormation
                rows={formationRows}
                setRows={setFormationRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )
      case "acquisition_terrain":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Acquisition Terrain & Location Immeuble</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabAcquisitionTerrain
                rows={acquisitionTerrainRows}
                setRows={setAcquisitionTerrainRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )
      case "realisations_commerciales":
        return (
          <div key={tabKey} className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Realisations Commerciales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderExistingWarning("realisations_commerciales")}
                <TabCommercialeDr
                  rows={commercialeDrRows}
                  setRows={setCommercialeDrRows}
                  onSave={() => handleSave("realisations_commerciales")}
                  isSubmitting={isSubmitting}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Reseau de Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderExistingWarning("reseau_distribution")}
                <TabReseauDistribution
                  rows={reseauDistributionRows}
                  setRows={setReseauDistributionRows}
                  onSave={() => handleSave("reseau_distribution")}
                  isSubmitting={isSubmitting}
                />
              </CardContent>
            </Card>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <LayoutWrapper user={user}>
      <DomainAccessGuard user={user} domainKey="regionale">
      {!hasFiscalTabAccess ? (
        <AccessDeniedDialog
          title="Acces refuse"
          message={user.role === "directeur"
            ? "Votre role ne vous permet pas de creer des declarations fiscales."
            : "Votre role ne vous permet pas de gerer les tableaux fiscaux."}
          redirectTo="/dashbord"
        />
      ) : (
        <>
          <div className="space-y-5 w-full" ref={printRef}>
            <TableauHeader
              title="Tableaux Regionale"
              domain="regionale"
              currentTabKey={activeTab}
              completedTabKeys={completedTabKeys}
              mois={mois}
              annee={annee}
              onBackClick={() => router.push("/dashbord")}
              onStepClick={handleStepClick}
              layout="horizontal"
              allowedSousDomaines={user.allowedSousDomaines}
            />

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
                  
                </div>
                {currentPeriodLockMessage && (
                  <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    {currentPeriodLockMessage}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {filteredTabs.map((tab) => {
                const key = tab.key as TabKey
                return (
                  <div key={key}>
                    {renderTabCard(key)}
                  </div>
                )
              })}

              <DynamicKpiTabs
                domain="regionale"
                excludeKeys={KPI_TAB_KEYS}
                mois={mois}
                annee={annee}
                direction={effectiveDirection}
                allowedKpis={user.allowedKpis}
                allowedSousDomaines={user.allowedSousDomaines}
              />
            </div>
            <div className="mt-4 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Commentaire</label>
              <textarea
                className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Ajouter un commentaire..."
                value={tabComment}
                onChange={(e) => setTabComment(e.target.value)}
                disabled={hasExistingComment && !isEditingComment}
              />
              <div className="flex justify-end gap-2">
                {hasExistingComment && !isEditingComment ? (
                  <>
                    <Button size="sm" onClick={() => { savedCommentRef.current = tabComment; setIsEditingComment(true) }} className="gap-1" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }} title="Modifier le commentaire">
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" onClick={handleDeleteComment} variant="destructive" className="gap-1" title="Supprimer le commentaire">
                      <Trash2 size={14} />
                    </Button>
                  </>
                ) : hasExistingComment && isEditingComment ? (
                  <>
                    <Button size="sm" onClick={handleSaveComment} disabled={isCommentSubmitting} className="gap-1" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }} title="Enregistrer le commentaire">
                      <Save size={14} />
                      Enregistrer
                    </Button>
                    <Button size="sm" onClick={() => { setTabComment(savedCommentRef.current); setIsEditingComment(false) }} variant="outline" className="gap-1" title="Annuler">
                      Annuler
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleSaveComment} disabled={isCommentSubmitting} className="gap-1" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }} title="Enregistrer le commentaire">
                    <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      </DomainAccessGuard>
    </LayoutWrapper>
  )
}

export default function NouvelleDeclarationPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-sm text-muted-foreground">Chargement...</p></div>}>
      <RegionalePageContent />
    </Suspense>
  )
}