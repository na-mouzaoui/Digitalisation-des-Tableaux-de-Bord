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

// ?? Réalisation Technique Réseau ?????????????????????????????????????????????
type RealisationTechniqueReseauRow = { label: string; m: string; m1: string }
const REALISATION_TECHNIQUE_RESEAU_LABELS = ["sites acquis", "site en cours de construction", "sites construits"] as const
const DEFAULT_REALISATION_TECHNIQUE_RESEAU_ROWS: RealisationTechniqueReseauRow[] =
  REALISATION_TECHNIQUE_RESEAU_LABELS.map((label) => ({ label, m: "", m1: "" }))

// ?? Amélioration Qualité (Débit MBPS / WILAYA) ????????????????????????????????
type AmeliorationQualiteRow = { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }
const EMPTY_AMELIORATION_QUALITE_ROW: AmeliorationQualiteRow = { wilaya: "", mObjectif: "", mRealise: "", m1Objectif: "", m1Realise: "", ecart: "" }

// ?? MTTR ??????????????????????????????????????????????????????????????????????
type MttrCityRow = { wilayaM: string; objectifM: string; realiseM: string; wilayaM1: string; objectifM1: string; realiseM1: string; ecart: string }
type MttrRegionRow = { region: string; cities: MttrCityRow[] }
const MTTR_REGIONS = ["DR Alger", "DR Oran", "DR Constantine", "DR Setif", "DR Ouargla", "DR Bechar", "DR Annaba", "DR Chlef"] as const
const EMPTY_MTTR_CITY_ROW: MttrCityRow = { wilayaM: "", objectifM: "", realiseM: "", wilayaM1: "", objectifM1: "", realiseM1: "", ecart: "" }
const DEFAULT_MTTR_ROWS: MttrRegionRow[] = MTTR_REGIONS.map((region) => ({ region, cities: [{ ...EMPTY_MTTR_CITY_ROW }] }))


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

// ?? 6a. Réalisation Technique Réseau ?????????????????????????????????????????
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
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
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

// ?? 6b. Amélioration Qualité (Débit MBPS / WILAYA) ????????????????????????????
interface TabAmeliorationQualiteProps { rows: AmeliorationQualiteRow[]; setRows: React.Dispatch<React.SetStateAction<AmeliorationQualiteRow[]>>; onSave: () => void; isSubmitting: boolean }

// Composant générique pour tableau dynamique (wilaya + objectif/réalisé)
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
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
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

function TabAmeliorationQualite({ rows, setRows, onSave, isSubmitting }: TabAmeliorationQualiteProps) {
  const update = (i: number, field: keyof AmeliorationQualiteRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  return <DynamicWilayaTable colHeader="Debit MBPS/Wilaya" rows={rows} onAdd={() => setRows((p) => [...p, { ...EMPTY_AMELIORATION_QUALITE_ROW }])} onRemove={(i) => setRows((p) => p.filter((_, idx) => idx !== i))} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6c. MTTR ?????????????????????????????????????????????????????????????????
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
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
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


// ?????????????????????????????????????????????????????????????????????????????
// 7. CONFIGURATION DES ONGLETS (TABLEAUX CONSERVéS UNIQUEMENT)
// ?????????????????????????????????????????????????????????????????????????????
const TABS = [
  { key: "realisation_technique_reseau",   label: "Realisation technique Reseau",          color: PRIMARY_COLOR, title: "REALISATION TECHNIQUE RESEAU" },
  { key: "amelioration_qualite",           label: "Amelioration qualite",                  color: PRIMARY_COLOR, title: "AMELIORATION QUALITE (DEBIT MBPS/WILAYA)" },
  { key: "mttr",                           label: "MTTR",                                  color: PRIMARY_COLOR, title: "MTTR / DR" },
]

const CUSTOM_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type TabKey =
  | "realisation_technique_reseau"
  | "amelioration_qualite"
  | "mttr"

type CategoryKey = "all" | "reseau"

const CATEGORY_OPTIONS: Array<{ key: CategoryKey; label: string; tabKeys: TabKey[] }> = [
  { key: "all",    label: "Toutes les categories", tabKeys: [] },
  { key: "reseau", label: "Reseau",                 tabKeys: ["realisation_technique_reseau", "amelioration_qualite", "mttr"] },
]

const findCategoryKeyForTab = (tabKey: string): CategoryKey =>
  CATEGORY_OPTIONS.find((c) => c.key !== "all" && c.tabKeys.includes(tabKey as TabKey))?.key ?? "all"

const isTabKey = (value: string): value is TabKey =>
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
  realisationTechniqueReseauRows?: RealisationTechniqueReseauRow[]
  ameliorationQualiteRows?: AmeliorationQualiteRow[]
  mttrRows?: MttrRegionRow[]
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
const normalizeRealisationTechniqueReseauRows = (rows?: RealisationTechniqueReseauRow[]): RealisationTechniqueReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return REALISATION_TECHNIQUE_RESEAU_LABELS.map((label, i) => ({ label, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1) }))
}

const normalizeAmeliorationQualiteRows = (rows?: AmeliorationQualiteRow[]): AmeliorationQualiteRow[] => {
  const src = Array.isArray(rows) ? rows : []
  if (src.length === 0) return [{ ...EMPTY_AMELIORATION_QUALITE_ROW }]
  return src.map((r) => ({ wilaya: safeString(r.wilaya), mObjectif: safeString(r.mObjectif), mRealise: safeString(r.mRealise), m1Objectif: safeString(r.m1Objectif), m1Realise: safeString(r.m1Realise), ecart: safeString(r.ecart) }))
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

const resolveTabKey = (decl: SavedData): TabKey => {
  if ((decl.realisationTechniqueReseauRows?.length ?? 0) > 0) return "realisation_technique_reseau"
  if ((decl.ameliorationQualiteRows?.length ?? 0) > 0) return "amelioration_qualite"
  if ((decl.mttrRows?.length ?? 0) > 0) return "mttr"
  return "realisation_technique_reseau"
}


// 
// PAGE
export default function NouvelleDeclarationPage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
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
  }, [])

  // Global meta
  const [activeTab, setActiveTab] = useState("realisation_technique_reseau")
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<CategoryKey>("all")
  const [direction, setDirection] = useState("")
  const [mois, setMois] = useState(INITIAL_PERIOD.mois)
  const [annee, setAnnee] = useState(INITIAL_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [policyRevision, setPolicyRevision] = useState(0)

  // Tab data (3 tableaux conservés)
  const [realisationTechniqueReseauRows, setRealisationTechniqueReseauRows] = useState<RealisationTechniqueReseauRow[]>(DEFAULT_REALISATION_TECHNIQUE_RESEAU_ROWS.map((row) => ({ ...row })))
  const [ameliorationQualiteRows, setAmeliorationQualiteRows] = useState<AmeliorationQualiteRow[]>([{ ...EMPTY_AMELIORATION_QUALITE_ROW }])
  const [mttrRows, setMttrRows] = useState<MttrRegionRow[]>(DEFAULT_MTTR_ROWS.map((row) => ({ ...row, cities: row.cities.map((city) => ({ ...city })) })))
  const [declarations, setDeclarations] = useState<ApiData[]>([])

  const userRole = user?.role ?? ""
  const isAdminRole = isAdmintableauRole(userRole)
  const isRegionalRole = isRegionaltableauRole(userRole)
  const isFinanceRole = isFinancetableauRole(userRole)
  const adminSelectedDirection = safeString(direction).trim()
  
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
    if (selectedCategoryKey === "all") return declarationTabs
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
    if (selectedCategoryKey === "all") return
    if (categoryOptions.some((category) => category.key === selectedCategoryKey)) return
    setSelectedCategoryKey("all")
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
      const requestedTab = isTabKey(editQuery.tab) ? editQuery.tab : resolveTabKey(declaration)
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
      setRealisationTechniqueReseauRows(normalizeRealisationTechniqueReseauRows(declaration.realisationTechniqueReseauRows))
      setAmeliorationQualiteRows(normalizeAmeliorationQualiteRows(declaration.ameliorationQualiteRows))
      setMttrRows(normalizeMttrRows(declaration.mttrRows))
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

    let validationError = false
    switch (activeTab) {
      case "realisation_technique_reseau":
        if (realisationTechniqueReseauRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Realisation technique Reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "amelioration_qualite":
        if (ameliorationQualiteRows.some((row) => !row.wilaya || !row.mObjectif || !row.mRealise || !row.m1Objectif || !row.m1Realise || !row.ecart)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Amelioration qualite.", variant: "destructive" })
          validationError = true
        }
        break
      case "mttr":
        if (mttrRows.some((region) => region.cities.some((city) => !city.wilayaM || !city.objectifM || !city.realiseM || !city.wilayaM1 || !city.objectifM1 || !city.realiseM1 || !city.ecart))) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau MTTR.", variant: "destructive" })
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
    
    switch (activeTab) {
      case "realisation_technique_reseau":
        baseDecl.realisationTechniqueReseauRows = realisationTechniqueReseauRows
        break
      case "amelioration_qualite":
        baseDecl.ameliorationQualiteRows = ameliorationQualiteRows
        break
      case "mttr":
        baseDecl.mttrRows = mttrRows
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
        case "realisation_technique_reseau": tabData = { realisationTechniqueReseauRows }; break
        case "amelioration_qualite": tabData = { ameliorationQualiteRows }; break
        case "mttr": tabData = { mttrRows }; break
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
                    <Select value={selectedCategoryKey} onValueChange={(value) => setSelectedCategoryKey(value as CategoryKey)}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Selectionner une categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => (
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
                      setSelectedCategoryKey(findCategoryKeyForTab(value))
                    }}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Selectionner un tableau" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTabs.length === 0
                          ? <SelectItem value="no-tables" disabled>Aucun tableau disponible pour cette categorie</SelectItem>
                          : filteredTabs.map((t) => (
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
              {activeTab === "amelioration_qualite" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Amelioration qualite (Debit MBPS/Wilaya)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabAmeliorationQualite rows={ameliorationQualiteRows} setRows={setAmeliorationQualiteRows} onSave={handleSave} isSubmitting={isSubmitting} />
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
            </div>
          </div>
        </>
      )}
    </LayoutWrapper>
  )
}