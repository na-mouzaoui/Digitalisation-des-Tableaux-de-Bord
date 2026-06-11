"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { Suspense } from "react"
import { useTableauStepNavigation } from "@/hooks/use-tableau-step-navigation"
import { TableauHeader } from "@/components/tableau-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Save, ArrowRight, Pencil } from "lucide-react"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import { API_BASE } from "@/lib/config"
import { fetchKpiRowsMap } from "@/lib/kpi-rows"
import DynamicKpiTabs from "@/components/dynamic-kpi-tabs"
import { useDeclarationAccess } from "@/hooks/use-declaration-access"
import { DomainAccessGuard } from "@/components/domain-access-guard"
import { getPreviousPeriod, mapMtoM1 } from "@/lib/auto-populate-m1"
import { isAdmintableauRole, isRegionaltableauRole, isFinancetableauRole, getManageabletableauTabKeysForDirection, istableauTabDisabledByPolicy } from "@/lib/fiscal-tab-access"
import { getCurrenttableauPeriod, gettableauPeriodLockMessage, istableauPeriodLocked } from "@/lib/fiscal-period-deadline"
import { synctableauPolicy } from "@/lib/fiscal-policy"

// /////////?????
// 1. CONSTANTES GLOBALES
// /////////?????
const PRIMARY_COLOR = "#2db34b"


// /////////?????
// 3. HELPERS DE FORMATAGE DES MONTANTS
// /////////?????
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


// /////////?????
// 4. COMPOSANT GéNéRIQUE : AmountInput
// /////////?????
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


// /////////?????
// 5. TYPES DE DONNéES
// /////////?????

// ?? Disponibilité Réseau //////??????
type DisponibiliteReseauRow = { designation: string; m1Realise: string; mObjectif: string; mRealise: string; mTaux: string }
const DISPONIBILITE_RESEAU_LABELS = ["Disponibilité des Services", "Disponibilité Cœur Réseau", "Disponibilité Accès Radio 2G", "Disponibilité Accès Radio 3G", "Disponibilité Accès Radio 4G", "Drop call 2G", "RAB Voice Drop 3G", "ERAB Drop 4G", "MTTR", "2G Congestion Rate", "Disponibilité Globale réseau"] as const
const DEFAULT_DISPONIBILITE_RESEAU_ROWS: DisponibiliteReseauRow[] = DISPONIBILITE_RESEAU_LABELS.map((designation) => ({ designation, m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" }))

// ?? MTTR ////////??????
type MttrCityRow = { wilayaM: string; objectifM: string; realiseM: string; realiseM1: string; ecart: string }
type MttrRegionRow = { region: string; cities: MttrCityRow[] }
const MTTR_REGIONS = ["DR Alger", "DR Oran", "DR Constantine", "DR Setif", "DR Ouargla", "DR Bechar", "DR Annaba", "DR Chlef"] as const
const EMPTY_MTTR_CITY_ROW: MttrCityRow = { wilayaM: "", objectifM: "", realiseM: "", realiseM1: "", ecart: "" }
const DEFAULT_MTTR_ROWS: MttrRegionRow[] = MTTR_REGIONS.map((region) => ({ region, cities: [{ ...EMPTY_MTTR_CITY_ROW }] }))

// ?? Impact MTTR ///////??????
type ImpactMttrCityRow = { wilayaM: string; differenceTemps: string; impactRevenuSite: string; montantWilayas: string }
type ImpactMttrRegionRow = { region: string; cities: ImpactMttrCityRow[] }
const IMPACT_MTTR_REGIONS = MTTR_REGIONS
const EMPTY_IMPACT_MTTR_CITY_ROW: ImpactMttrCityRow = { wilayaM: "", differenceTemps: "", impactRevenuSite: "", montantWilayas: "" }
const DEFAULT_IMPACT_MTTR_ROWS: ImpactMttrRegionRow[] = IMPACT_MTTR_REGIONS.map((region) => ({ region, cities: [{ ...EMPTY_IMPACT_MTTR_CITY_ROW }] }))



// ?? Situation Reseaux //////????
type SituationReseauRow = { situation: string; equipements: string; m: string; m1: string }
const DEFAULT_SITUATION_RESEAU_ROWS: SituationReseauRow[] = [
  { situation: "Réseau 2G", equipements: "BTS 900/1800 Mhz", m: "", m1: "" },
  { situation: "Réseau 3G", equipements: "NodeB", m: "", m1: "" },
  { situation: "Réseau 4G", equipements: "eNodeB (Evolved NodeB) (FDD+TDD)\neNodeB (Evolved NodeB) (FDD)", m: "", m1: "" },
]


// /////////?????
// 6. COMPOSANTS DE TABLEAUX
// /////////?????

// ?? Bouton Save réutilisable //////??
function SaveButton({ onSave, isSubmitting }: { onSave: () => void; isSubmitting: boolean }) {
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={onSave} disabled={isSubmitting} className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
        <Save size={13} /> {isSubmitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  )
}

// ?? Composant générique : tableau Objectif / Réalisé / Taux (M-1 + M) /?
interface OrtTableProps {
  colHeader: string
  rows: Array<Record<string, string>>
  labelKey: string
  onSave: () => void
  isSubmitting: boolean
  update: (index: number, field: string, value: string) => void
  mois: string
}
function OrtTable({ colHeader, rows, labelKey, onSave, isSubmitting, update, mois }: OrtTableProps) {
  const fields = ["m1Realise", "mObjectif", "mRealise"]
  const calcTaux = (r: Record<string, string>) => {
    const realise = parseFloat(r.mRealise ?? "0") || 0
    const objectif = parseFloat(r.mObjectif ?? "0") || 0
    return objectif ? ((realise / objectif) * 100).toFixed(1) : "0.0"
  }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">{colHeader}</th>
              <th colSpan={1} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, 0)}</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              {["Objectif", "Realise", "Taux"].map((h, i) => (
                <th key={i} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? "" : " border-r"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row[labelKey]}</td>
                {fields.map((field) => (
                  <td key={field} className="px-1 py-1 border-b">
                    <AmountInput value={row[field] ?? ""} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                  </td>
                ))}
                <td className="px-1 py-1 border-b text-xs text-right font-semibold">{calcTaux(row)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? Disponibilité Réseau //////??
interface TabDisponibiliteReseauProps { rows: DisponibiliteReseauRow[]; setRows: React.Dispatch<React.SetStateAction<DisponibiliteReseauRow[]>>; onSave: () => void; isSubmitting: boolean; mois: string }
function TabDisponibiliteReseau({ rows, setRows, onSave, isSubmitting, mois }: TabDisponibiliteReseauProps) {
  const update = (index: number, field: keyof DisponibiliteReseauRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  const filteredRows = rows.filter((r) => !/DR (Alger|Oran)/i.test(r.designation))
  return <OrtTable colHeader="Designations" rows={filteredRows as any} labelKey="designation" update={(i, f, v) => {
    const realIdx = rows.indexOf(filteredRows[i])
    if (realIdx >= 0) update(realIdx, f as keyof DisponibiliteReseauRow, v)
  }} onSave={onSave} isSubmitting={isSubmitting} mois={mois} />
}

// ?? MTTR ////////?
interface TabMttrProps { rows: MttrRegionRow[]; setRows: React.Dispatch<React.SetStateAction<MttrRegionRow[]>>; onSave: () => void; isSubmitting: boolean; mois: string }
function TabMttr({ rows, setRows, onSave, isSubmitting, mois }: TabMttrProps) {
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
              <th colSpan={1} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, 0)}</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Écart</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Action</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              {["WILAYA", "Objectif", "Realise"].map((h, i) => (
                <th key={i} className={`px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
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
                  <td className="px-1 py-1 border-b"><AmountInput value={city.realiseM1} onChange={(e) => updateCity(regionIndex, cityIndex, "realiseM1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b"><Input value={city.wilayaM}  onChange={(e) => updateCity(regionIndex, cityIndex, "wilayaM",  e.target.value)} className="h-7 px-2 text-xs" placeholder="Wilaya" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.objectifM} onChange={(e) => updateCity(regionIndex, cityIndex, "objectifM", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.realiseM}  onChange={(e) => updateCity(regionIndex, cityIndex, "realiseM",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b text-xs text-right font-semibold">{fmt((num(city.realiseM) - num(city.objectifM)).toFixed(2))}</td>
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


// ?? Impact MTTR ///////??
interface TabImpactMttrProps { rows: ImpactMttrRegionRow[]; setRows: React.Dispatch<React.SetStateAction<ImpactMttrRegionRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabImpactMttr({ rows, setRows, onSave, isSubmitting }: TabImpactMttrProps) {
  const updateCity = (regionIndex: number, cityIndex: number, field: keyof ImpactMttrCityRow, value: string) =>
    setRows((prev) => prev.map((region, rIdx) => rIdx !== regionIndex ? region : {
      ...region,
      cities: region.cities.map((city, cIdx) => (cIdx === cityIndex ? { ...city, [field]: value } : city)),
    }))
  const addCity = (regionIndex: number) =>
    setRows((prev) => prev.map((region, rIdx) => rIdx === regionIndex ? { ...region, cities: [...region.cities, { ...EMPTY_IMPACT_MTTR_CITY_ROW }] } : region))
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
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Wilaya</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Différence de temps</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Impact sur le revenu par site (DA)</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Montant par wilayas (DA)</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Action</th>
            </tr>
            <tr className="bg-gray-50"></tr>
          </thead>
          <tbody>
            {rows.map((region, regionIndex) =>
              region.cities.map((city, cityIndex) => (
                <tr key={`impact-mttr-${regionIndex}-${cityIndex}`} className="bg-white">
                  {cityIndex === 0 && (
                    <td rowSpan={region.cities.length} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-top">
                      <div className="flex items-center justify-between gap-2">
                        <span>{region.region}</span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => addCity(regionIndex)} className="h-6 w-6 text-green-700"><Plus size={11} /></Button>
                      </div>
                    </td>
                  )}
                  <td className="px-1 py-1 border-b"><Input value={city.wilayaM}  onChange={(e) => updateCity(regionIndex, cityIndex, "wilayaM",  e.target.value)} className="h-7 px-2 text-xs" placeholder="Wilaya" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.differenceTemps} onChange={(e) => updateCity(regionIndex, cityIndex, "differenceTemps", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.impactRevenuSite} onChange={(e) => updateCity(regionIndex, cityIndex, "impactRevenuSite", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-1 py-1 border-b"><AmountInput value={city.montantWilayas}  onChange={(e) => updateCity(regionIndex, cityIndex, "montantWilayas",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
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

// /////////?????
// 7. CONFIGURATION DES ONGLETS
// /////////?????
const TABS = [
  { key: "disponibilite_reseau",           label: "Disponibilité réseau",                  color: PRIMARY_COLOR, title: "DISPONIBILITÉ RÉSEAU" },
  { key: "mttr",                           label: "MTTR",                                  color: PRIMARY_COLOR, title: "MTTR / DR" },
  { key: "impact_mttr",                    label: "Impact de l'amélioration/Dégradation du MTTR", color: PRIMARY_COLOR, title: "IMPACT MTTR / DR" },
]

const KPI_TAB_KEYS = [
  "disponibilite_reseau",
  "mttr",
  "impact_mttr",
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey = "disponibilite_reseau" | "mttr" | "impact_mttr"

type tableauCategoryKey = "all"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all", label: "Toutes les categories", tabKeys: ["disponibilite_reseau", "mttr", "impact_mttr"] },
]

const findtableauCategoryKeyForTab = (_tabKey: string): tableauCategoryKey => "all"

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
const getMonthLabel = (mois: string, diff: number = 0): string => {
  const monthNum = Number.parseInt(mois, 10)
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return `M${diff === 0 ? "" : diff}`
  let targetMonth = monthNum + diff
  if (targetMonth < 1) targetMonth += 12
  if (targetMonth > 12) targetMonth -= 12
  const key = String(targetMonth).padStart(2, "0")
  return MONTHS.find((m) => m.value === key)?.label ?? key
}
const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_tableau_PERIOD = getCurrenttableauPeriod()
const YEARS = Array.from({ length: 101 }, (_, i) => (2000 + i).toString())


// /////////?????
// 8. TYPES & HELPERS D'API / STOCKAGE
// /////////?????

// ?? 8a. Type de la déclaration sauvegardée ///??????
interface Savedtableau {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  disponibiliteReseauRows?: DisponibiliteReseauRow[]
  mttrRows?: MttrRegionRow[]
  impactMttrRows?: ImpactMttrRegionRow[]
}

// ?? 8b. Type retourné par l'API ////???????
type Apitableautableau = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

// ?? 8c. Helpers utilitaires /////???
const safeString = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

const normalizeMonthValue = (value: string) =>
  MONTHS.some((m) => m.value === value) ? value : String(new Date().getMonth() + 1).padStart(2, "0")

const normalizeYearValue = (value: string) =>
  YEARS.includes(value) ? value : String(CURRENT_YEAR)

// ?? 8d. Fonctions de normalisation par tableau ///

const normalizeDisponibiliteReseauRows = (rows?: DisponibiliteReseauRow[]): DisponibiliteReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DEFAULT_DISPONIBILITE_RESEAU_ROWS.map((def, i) => ({ designation: def.designation, m1Realise: safeString(src[i]?.m1Realise), mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux) }))
}

const normalizeMttrRows = (rows?: MttrRegionRow[]): MttrRegionRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return MTTR_REGIONS.map((regionName, i) => {
    const sourceCities = Array.isArray(src[i]?.cities) ? src[i].cities : []
    return {
      region: regionName,
      cities: sourceCities.length > 0
        ? sourceCities.map((city) => ({ wilayaM: safeString(city.wilayaM), objectifM: safeString(city.objectifM), realiseM: safeString(city.realiseM), realiseM1: safeString(city.realiseM1), ecart: safeString(city.ecart) }))
        : [{ ...EMPTY_MTTR_CITY_ROW }],
    }
  })
}

const normalizeImpactMttrRows = (rows?: ImpactMttrRegionRow[]): ImpactMttrRegionRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return IMPACT_MTTR_REGIONS.map((regionName, i) => {
    const sourceCities = Array.isArray(src[i]?.cities) ? src[i].cities : []
    return {
      region: regionName,
      cities: sourceCities.length > 0
        ? sourceCities.map((city) => ({ wilayaM: safeString(city.wilayaM), differenceTemps: safeString(city.differenceTemps), impactRevenuSite: safeString(city.impactRevenuSite), montantWilayas: safeString(city.montantWilayas) }))
        : [{ ...EMPTY_IMPACT_MTTR_CITY_ROW }],
    }
  })
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.disponibiliteReseauRows?.length ?? 0) > 0) return "disponibilite_reseau"
  if ((decl.mttrRows?.length ?? 0) > 0) return "mttr"
  if ((decl.impactMttrRows?.length ?? 0) > 0) return "impact_mttr"
  return "disponibilite_reseau"
}


// PAGE
function DQRPCPageContent() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  useTableauStepNavigation("DQRPC")
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
      .then((data: { id: number; nom: string }[]) => setRegions(data.map((r) => ({ id: r.id, name: r.nom }))))
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

    const requestedTab = safeString(params.get("tab")).trim()
    if (requestedTab && istableauTabKey(requestedTab)) {
      setActiveTab(requestedTab)
    }
  }, [])

  // Global meta
  const [activeTab, setActiveTab] = useState("disponibilite_reseau")
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<tableauCategoryKey>("all")
  const [direction, setDirection] = useState("")
  const [mois, setMois] = useState(INITIAL_tableau_PERIOD.mois)
  const [annee, setAnnee] = useState(INITIAL_tableau_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [tableauPolicyRevision, settableauPolicyRevision] = useState(0)
  const [kpiRows, setKpiRows] = useState<Record<string, string[]>>({})

  // Tab data
  const [disponibiliteReseauRows, setDisponibiliteReseauRows] = useState<DisponibiliteReseauRow[]>(DEFAULT_DISPONIBILITE_RESEAU_ROWS.map((row) => ({ ...row })))
  const [mttrRows, setMttrRows] = useState<MttrRegionRow[]>(DEFAULT_MTTR_ROWS.map((row) => ({ ...row, cities: row.cities.map((city) => ({ ...city })) })))
  const [impactMttrRows, setImpactMttrRows] = useState<ImpactMttrRegionRow[]>(DEFAULT_IMPACT_MTTR_ROWS.map((row) => ({ ...row, cities: row.cities.map((city) => ({ ...city })) })))
  const [tableauDeclarations, settableauDeclarations] = useState<Apitableautableau[]>([])
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
      const map = await fetchKpiRowsMap(KPI_TAB_KEYS, "DQRPC")
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

    const dispoLabels = getLabels("disponibilite_reseau", DISPONIBILITE_RESEAU_LABELS)
    setDisponibiliteReseauRows((prev) => dispoLabels.map((designation, i) => ({
      designation,
      m1Realise: safeString(prev[i]?.m1Realise),
      mObjectif: safeString(prev[i]?.mObjectif),
      mRealise: safeString(prev[i]?.mRealise),
      mTaux: safeString(prev[i]?.mTaux),
    })))

    const mttrLabels = getLabels("mttr", MTTR_REGIONS)
    setMttrRows((prev) => mttrLabels.map((regionName, i) => {
      const sourceCities = Array.isArray(prev[i]?.cities) ? prev[i].cities : []
      return {
        region: regionName,
        cities: sourceCities.length > 0
          ? sourceCities.map((city) => ({
              wilayaM: safeString(city.wilayaM),
              objectifM: safeString(city.objectifM),
              realiseM: safeString(city.realiseM),
              realiseM1: safeString(city.realiseM1),
              ecart: safeString(city.ecart),
            }))
          : [{ ...EMPTY_MTTR_CITY_ROW }],
      }
    }))

    const impactMttrLabels = getLabels("impact_mttr", IMPACT_MTTR_REGIONS)
    setImpactMttrRows((prev) => impactMttrLabels.map((regionName, i) => {
      const sourceCities = Array.isArray(prev[i]?.cities) ? prev[i].cities : []
      return {
        region: regionName,
        cities: sourceCities.length > 0
          ? sourceCities.map((city) => ({
              wilayaM: safeString(city.wilayaM),
              differenceTemps: safeString(city.differenceTemps),
              impactRevenuSite: safeString(city.impactRevenuSite),
              montantWilayas: safeString(city.montantWilayas),
            }))
          : [{ ...EMPTY_IMPACT_MTTR_CITY_ROW }],
      }
    }))
  }, [kpiRows])

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
  
  const allowedTabKeys = useDeclarationAccess("dqrpc", user?.allowedKpis)
  
  const accessibleDeclarationTabs = useMemo(() => {
    if (!allowedTabKeys) return filteredDeclarationTabs
    return filteredDeclarationTabs.filter((tab) => allowedTabKeys.has(tab.key))
  }, [filteredDeclarationTabs, allowedTabKeys])
  
  const selectableYears = useMemo(
    () => YEARS.filter((year) => MONTHS.some((month) => !istableauPeriodLocked(month.value, year, userRole))),
    [tableauPolicyRevision, userRole],
  )
  
  const selectableMonths = useMemo(
    () => MONTHS.filter((month) => !istableauPeriodLocked(month.value, annee, userRole)),
    [annee, tableauPolicyRevision, userRole],
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
    if (!kpiRows || Object.keys(kpiRows).length === 0) return
    if (!tableauDeclarations || tableauDeclarations.length === 0) return
    if (!effectiveDirection) return

    const prevPeriod = getPreviousPeriod(mois, annee)

    const autoPopulate = <T extends Record<string, unknown>>(
      tabKey: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
    ) => {
      const hasExisting = tableauDeclarations.some(
        (d) => d.tabKey === tabKey && d.mois === mois && d.annee === annee && d.direction === effectiveDirection,
      )
      if (hasExisting) return

      const prevDecl = tableauDeclarations.find(
        (d) => d.tabKey === tabKey && d.mois === prevPeriod.mois && d.annee === prevPeriod.annee && d.direction === effectiveDirection,
      )
      if (!prevDecl) return

      try {
        const data = JSON.parse(prevDecl.dataJson)
        const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]))
        if (!arrayKey) return
        const prevRows: Record<string, string>[] = data[arrayKey]

        setter((prev) =>
          prev.map((row, i) => {
            const prevRow = prevRows[i]
            if (!prevRow) return row
            const m1Values = mapMtoM1(prevRow)
            return { ...row, ...m1Values } as unknown as T
          }),
        )
      } catch {

      }
    }

    autoPopulate("disponibilite_reseau", setDisponibiliteReseauRows)
    autoPopulate("mttr", setMttrRows)
    autoPopulate("impact_mttr", setImpactMttrRows)
  }, [kpiRows, tableauDeclarations, mois, annee, effectiveDirection])

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
    const tabs = accessibleDeclarationTabs
    if (tabs.length === 0) return
    const firstEnabledTab = tabs.find((tab) => !tab.isDisabled)?.key ?? tabs[0].key
    if (!tabs.some((tab) => tab.key === activeTab) || disabledTabKeys.has(activeTab)) {
      setActiveTab(firstEnabledTab)
    }
  }, [activeTab, disabledTabKeys, filteredDeclarationTabs])

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
          description: "La déclaration demandée n'existe pas ou a déjà été supprimée.",
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
      setDisponibiliteReseauRows(normalizeDisponibiliteReseauRows(declaration.disponibiliteReseauRows))
      setMttrRows(normalizeMttrRows(declaration.mttrRows))
      setImpactMttrRows(normalizeImpactMttrRows(declaration.impactMttrRows))
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

    tableauDeclarations.forEach((decl) => {
      if (
        safeString(decl.mois).trim() === periodMois &&
        safeString(decl.annee).trim() === periodAnnee &&
        safeString(decl.direction).trim() === periodDirection &&
        istableauTabKey(decl.tabKey)
      ) {
        keys.add(decl.tabKey)
      }
    })

    return keys
  }, [annee, effectiveDirection, mois, tableauDeclarations])

  if (isLoading || !user || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  const handleSave = async (tabKey: tableauTabKey) => {
    const saveDirection = effectiveDirection
    if (!isAdminRole && !canManageTabForDirection(tabKey, saveDirection)) {
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
        title: "Période clôturée",
        description: "Le mois ou l'année sélectionné(e) est hors délai.",
        variant: "destructive",
      })
      return
    }

    if (!mois) {
      toast({ title: "Mois requis", description: "Veuillez sélectionner le mois avant d'enregistrer.", variant: "destructive" })
      return
    }
    if (!annee) {
      toast({ title: "Année requise", description: "Veuillez sélectionner l'année avant d'enregistrer.", variant: "destructive" })
      return
    }

    const isSourcePeriodLocked = !!editingDeclarationId && !!editingSourceMois && !!editingSourceAnnee && istableauPeriodLocked(editingSourceMois, editingSourceAnnee, userRole)
    if (isSourcePeriodLocked) {
      toast({
        title: "Période clôturée",
        description: `${gettableauPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification n'est autorisée.`,
        variant: "destructive",
      })
      return
    }

    if (istableauPeriodLocked(mois, annee, userRole)) {
      toast({
        title: "Période clôturée",
        description: `${gettableauPeriodLockMessage(mois, annee, userRole)} Aucune création ou modification n'est autorisée.`,
        variant: "destructive",
      })
      return
    }

    // Validation des champs
    let validationError = false
    switch (tabKey) {
      case "disponibilite_reseau":
        if (disponibiliteReseauRows.some((row) => !row.m1Realise || !row.mObjectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Disponibilite reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "mttr":
        if (mttrRows.some((region) => region.cities.some((city) => !city.wilayaM || !city.objectifM || !city.realiseM || !city.realiseM1 || !city.ecart))) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau MTTR.", variant: "destructive" })
          validationError = true
        }
        break
      case "impact_mttr":
        if (impactMttrRows.some((region) => region.cities.some((city) => !city.wilayaM || !city.differenceTemps || !city.impactRevenuSite || !city.montantWilayas))) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Impact MTTR.", variant: "destructive" })
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
      disponibiliteReseauRows: [],
      mttrRows: [],
      impactMttrRows: [],
    }
    
    switch (tabKey) {
      case "disponibilite_reseau":
        baseDecl.disponibiliteReseauRows = disponibiliteReseauRows
        break
      case "mttr":
        baseDecl.mttrRows = mttrRows
        break
      case "impact_mttr":
        baseDecl.impactMttrRows = impactMttrRows
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
        case "disponibilite_reseau": tabData = { disponibiliteReseauRows }; break
        case "mttr": tabData = { mttrRows }; break
        case "impact_mttr": tabData = { impactMttrRows }; break
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
        settableauDeclarations((prev) => {
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
      title: editingDeclarationId ? "Déclaration modifiée" : "Déclaration enregistrée",
      description: `La déclaration "${tabLabel}" a été sauvegardée avec succès.`,
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

  const renderDisabledNotice = (tabKey: tableauTabKey) =>
    disabledTabKeys.has(tabKey) ? (
      <p className="mb-3 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
        Ce tableau est desactive par l'administration. Il apparait en grise et ne peut pas etre enregistre.
      </p>
    ) : null

  const getExistingDeclarationForTab = (tabKey: tableauTabKey): Savedtableau | null => {
    try {
      const decl = tableauDeclarations.find(d =>
        d.mois === mois &&
        d.annee === annee &&
        d.direction === effectiveDirection &&
        d.tabKey === tabKey
      )
      if (!decl) return null
      const parsedData = JSON.parse(decl.dataJson)
      return {
        id: String(decl.id),
        createdAt: "",
        direction: decl.direction,
        mois: decl.mois,
        annee: decl.annee,
        ...parsedData,
      } as Savedtableau
    } catch {
      return null
    }
  }

  const renderExistingWarning = (tabKey: tableauTabKey) => {
    const existing = getExistingDeclarationForTab(tabKey)
    return existing ? (
      <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
        Ce tableau a deja ete enregistre pour la periode {existing.mois}/{existing.annee}. Vous etes sur le point de le modifier.
      </p>
    ) : null
  }

  const renderTabCard = (tabKey: tableauTabKey) => {
    switch (tabKey) {
      case "disponibilite_reseau":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Disponibilité réseau</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabDisponibiliteReseau rows={disponibiliteReseauRows} setRows={setDisponibiliteReseauRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} mois={mois} />

            </CardContent>
          </Card>
        )
      case "mttr":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>MTTR / DR</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabMttr rows={mttrRows} setRows={setMttrRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} mois={mois} />

            </CardContent>
          </Card>
        )
      case "impact_mttr":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Impact de l'amélioration/Dégradation du MTTR sur le revenu</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabImpactMttr rows={impactMttrRows} setRows={setImpactMttrRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <LayoutWrapper user={user}>
      <DomainAccessGuard user={user} domainKey="DQRPC">
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
              title="Tableaux DQRPC"
              domain="DQRPC"
              currentTabKey={activeTab}
              completedTabKeys={completedTabKeys}
              mois={mois}
              annee={annee}
              onBackClick={() => router.push("/dashbord")}
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
              {filteredDeclarationTabs.map((tab) => {
              const key = tab.key as tableauTabKey
              const isLocked = allowedTabKeys && !allowedTabKeys.has(tab.key)
              return (
                <div key={key} className={isLocked ? "opacity-50 pointer-events-none select-none" : ""}>
                  {isLocked && (
                    <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                      Accès refusé — vous n'avez pas les droits pour modifier ce tableau.
                    </div>
                  )}
                  {renderTabCard(key)}
                </div>
              )
            })}

              <DynamicKpiTabs
                domain="dqrpc"
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
      <DQRPCPageContent />
    </Suspense>
  )
}