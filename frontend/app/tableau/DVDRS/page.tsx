"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Save } from "lucide-react"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import { API_BASE } from "@/lib/config"

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

// ?? Situation Réseau ?????????????????????????????????????????????????????????
type SituationReseauRow = { situation: string; equipements: string; m: string; m1: string }
const DEFAULT_SITUATION_RESEAU_ROWS: SituationReseauRow[] = [
  { situation: "Reseau 2G", equipements: "BTS 900/1800 Mhz", m: "", m1: "" },
  { situation: "Reseau 3G", equipements: "NodeB", m: "", m1: "" },
  { situation: "Reseau 4G", equipements: "eNodeB (Evolved NodeB) (FDD+TDD)\neNodeB (Evolved NodeB) (FDD)", m: "", m1: "" },
]

// ?? Trafic Data ??????????????????????????????????????????????????????????????
type TraficDataRow = { label: string; m: string; m1: string }
const TRAFIC_DATA_LABELS = ["2G-3G Traffic Volume per day", "4G Traffic Volume per day", "Total daily traffic volume"] as const
const DEFAULT_TRAFIC_DATA_ROWS: TraficDataRow[] = TRAFIC_DATA_LABELS.map((label) => ({ label, m: "", m1: "" }))

// ?? Amélioration Qualité ??????????????????????????????????????????????????????
type AmeliorationQualiteRow = { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }
const EMPTY_AMELIORATION_QUALITE_ROW: AmeliorationQualiteRow = { wilaya: "", mObjectif: "", mRealise: "", m1Objectif: "", m1Realise: "", ecart: "" }

// ?? Couverture Réseau ?????????????????????????????????????????????????????????
type CouvertureReseauRow = { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }
const EMPTY_COUVERTURE_RESEAU_ROW: CouvertureReseauRow = { wilaya: "", mObjectif: "", mRealise: "", m1Objectif: "", m1Realise: "", ecart: "" }

// ?? Action Notable Réseau ?????????????????????????????????????????????????????
type ActionNotableReseauRow = { action: string; objectif2025: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const DEFAULT_ACTION_NOTABLE_RESEAU_ROWS: ActionNotableReseauRow[] = [
  { action: "Densification de couverture par des nouveaux sites", objectif2025: "Acquisition et Integration de 2000 nouveaux sites", mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" },
  { action: "Densification du LTE_30Mhz (1800_15+2100_15)", objectif2025: "La mise a niveau de 1000 sites avec la technologie 4G", mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" },
  { action: "Usage de la neutralite technologique sur la bande 2100Mhz en faveur de la LTE (0-15Mhz)", objectif2025: "Implementation et integration de 15Mhz de la bande passante 2100Mhz avec la technologie 4G sur 600 Sites", mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" },
  { action: "Implementation de la couche LTE TDD 2300", objectif2025: "Implementation et integration de 3000 Sites LTE TDD (Massive MIMO & 8T8R) pour les Sites 4G (1800/2100) sur les 58 wilaya", mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" },
]


// ?????????????????????????????????????????????????????????????????????????????
// 6. COMPOSANTS DE TABLEAUX (TABLEAUX CONSERVéS UNIQUEMENT)
// ?????????????????????????????????????????????????????????????????????????????

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

// ?? 6b. Situation Réseau ??????????????????????????????????????????????????????
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
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
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

// ?? 6c. Trafic Data ???????????????????????????????????????????????????????????
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
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
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

// ?? Composant générique pour tableaux avec lignes dynamiques (wilaya + objectif/réalisé) ??
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
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
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

// ?? 6d. Amélioration Qualité ??????????????????????????????????????????????????
interface TabAmeliorationQualiteProps { rows: AmeliorationQualiteRow[]; setRows: React.Dispatch<React.SetStateAction<AmeliorationQualiteRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabAmeliorationQualite({ rows, setRows, onSave, isSubmitting }: TabAmeliorationQualiteProps) {
  const update = (i: number, field: keyof AmeliorationQualiteRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  return <DynamicWilayaTable colHeader="Debit MBPS/Wilaya" rows={rows} onAdd={() => setRows((p) => [...p, { ...EMPTY_AMELIORATION_QUALITE_ROW }])} onRemove={(i) => setRows((p) => p.filter((_, idx) => idx !== i))} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6e. Couverture Réseau ?????????????????????????????????????????????????????
interface TabCouvertureReseauProps { rows: CouvertureReseauRow[]; setRows: React.Dispatch<React.SetStateAction<CouvertureReseauRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabCouvertureReseau({ rows, setRows, onSave, isSubmitting }: TabCouvertureReseauProps) {
  const update = (i: number, field: keyof CouvertureReseauRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  return <DynamicWilayaTable colHeader="Couverture Reseau/Wilaya" rows={rows} onAdd={() => setRows((p) => [...p, { ...EMPTY_COUVERTURE_RESEAU_ROW }])} onRemove={(i) => setRows((p) => p.filter((_, idx) => idx !== i))} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? Composant générique : tableau Objectif / Réalisé / Taux (M + M) ?????????
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
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
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

// ?? 6f. Action Notable Réseau ?????????????????????????????????????????????????
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
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
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


// ?????????????????????????????????????????????????????????????????????????????
// 7. CONFIGURATION DES ONGLETS (TABLEAUX CONSERVéS UNIQUEMENT)
// ?????????????????????????????????????????????????????????????????????????????
const TABS = [
  { key: "suivi_infrastructures_reseau",  label: "Suivi des infrastructures Reseau 2G/3G/4G", color: PRIMARY_COLOR, title: "SUIVI DES INFRASTRUCTURES RESEAU 2G/3G/4G" },
  { key: "evolution_trafic_data",          label: "Evolution du Trafic Data",            color: PRIMARY_COLOR, title: "EVOLUTION DU TRAFIC DATA" },
  { key: "amelioration_qualite",          label: "Amelioration qualité",              color: PRIMARY_COLOR, title: "AMELIORATION QUALITE" },
  { key: "couverture_reseau",             label: "Couverture Réseau",                  color: PRIMARY_COLOR, title: "COUVERTURE RESEAU" },
  { key: "action_notable_reseau",         label: "Action notable sur le Réseau",       color: PRIMARY_COLOR, title: "ACTION NOTABLE SUR LE RESEAU" },
  { key: "situation_reseaux",             label: "Situation Reseaux",                  color: PRIMARY_COLOR, title: "SITUATION RESEAUX" },
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey =
  | "suivi_infrastructures_reseau" | "evolution_trafic_data"
  | "amelioration_qualite" | "couverture_reseau" | "action_notable_reseau" | "situation_reseaux"

type tableauCategoryKey =
  | "all"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all", label: "Toutes les categories", tabKeys: ["suivi_infrastructures_reseau", "evolution_trafic_data", "amelioration_qualite", "couverture_reseau", "action_notable_reseau", "situation_reseaux"] },
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
const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_tableau_PERIOD = getCurrenttableauPeriod()
const YEARS = Array.from({ length: 101 }, (_, i) => (2000 + i).toString())


// ?????????????????????????????????????????????????????????????????????????????
// 8. TYPES & HELPERS D'API / STOCKAGE
// ?????????????????????????????????????????????????????????????????????????????

// ?? 8a. Type de la déclaration sauvegardée (localStorage + API) ??????????????
interface Savedtableau {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  realisationTechniqueReseauRows?: RealisationTechniqueReseauRow[]
  situationReseauRows?: SituationReseauRow[]
  traficDataRows?: TraficDataRow[]
  ameliorationQualiteRows?: AmeliorationQualiteRow[]
  couvertureReseauRows?: CouvertureReseauRow[]
  actionNotableReseauRows?: ActionNotableReseauRow[]
}

// ?? 8b. Type retourné par l'API ??????????????????????????????????????????????
type Apitableautableau = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

// ?? 8c. Helpers utilitaires ???????????????????????????????????????????????????
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

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.realisationTechniqueReseauRows?.length ?? 0) > 0) return "suivi_infrastructures_reseau"
  if ((decl.traficDataRows?.length ?? 0) > 0) return "evolution_trafic_data"
  if ((decl.ameliorationQualiteRows?.length ?? 0) > 0) return "amelioration_qualite"
  if ((decl.couvertureReseauRows?.length ?? 0) > 0) return "couverture_reseau"
  if ((decl.actionNotableReseauRows?.length ?? 0) > 0) return "action_notable_reseau"
  return "suivi_infrastructures_reseau"
}


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
  const [activeTab, setActiveTab] = useState("suivi_infrastructures_reseau")
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

  // Tab data (TABLEAUX CONSERVéS)
  const [realisationTechniqueReseauRows, setRealisationTechniqueReseauRows] = useState<RealisationTechniqueReseauRow[]>(DEFAULT_REALISATION_TECHNIQUE_RESEAU_ROWS.map((row) => ({ ...row })))
  const [situationReseauRows, setSituationReseauRows] = useState<SituationReseauRow[]>(DEFAULT_SITUATION_RESEAU_ROWS.map((row) => ({ ...row })))
  const [traficDataRows, setTraficDataRows] = useState<TraficDataRow[]>(DEFAULT_TRAFIC_DATA_ROWS.map((row) => ({ ...row })))
  const [ameliorationQualiteRows, setAmeliorationQualiteRows] = useState<AmeliorationQualiteRow[]>([{ ...EMPTY_AMELIORATION_QUALITE_ROW }])
  const [couvertureReseauRows, setCouvertureReseauRows] = useState<CouvertureReseauRow[]>([{ ...EMPTY_COUVERTURE_RESEAU_ROW }])
  const [actionNotableReseauRows, setActionNotableReseauRows] = useState<ActionNotableReseauRow[]>(DEFAULT_ACTION_NOTABLE_RESEAU_ROWS.map((row) => ({ ...row })))
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
    if (declarationTabs.length === 0) return
    const firstEnabledTab = declarationTabs.find((tab) => !tab.isDisabled)?.key ?? declarationTabs[0].key
    if (!declarationTabs.some((tab) => tab.key === activeTab) || disabledTabKeys.has(activeTab)) {
      setActiveTab(firstEnabledTab)
    }
  }, [activeTab, disabledTabKeys, declarationTabs])

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
      // Chargement des données des tableaux conservés
      setRealisationTechniqueReseauRows(normalizeRealisationTechniqueReseauRows(declaration.realisationTechniqueReseauRows))
      setSituationReseauRows(normalizeSituationReseauRows(declaration.situationReseauRows))
      setTraficDataRows(normalizeTraficDataRows(declaration.traficDataRows))
      setAmeliorationQualiteRows(normalizeAmeliorationQualiteRows(declaration.ameliorationQualiteRows))
      setCouvertureReseauRows(normalizeCouvertureReseauRows(declaration.couvertureReseauRows))
      setActionNotableReseauRows(normalizeActionNotableReseauRows(declaration.actionNotableReseauRows))
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

    // Validation des champs
    let validationError = false
    switch (activeTab) {
      case "suivi_infrastructures_reseau":
        if (realisationTechniqueReseauRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Suivi des infrastructures Reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "evolution_trafic_data":
        if (traficDataRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Evolution du Trafic Data.", variant: "destructive" })
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
          toast({ title: "Champs incomplets", description: "Veuillez renseign toutes les lignes du tableau Couverture Reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "action_notable_reseau":
        if (actionNotableReseauRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Action notable sur le reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "situation_reseaux":
        if (situationReseauRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Situation Reseaux.", variant: "destructive" })
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
      realisationTechniqueReseauRows: [],
      situationReseauRows: [],
      traficDataRows: [],
      ameliorationQualiteRows: [],
      couvertureReseauRows: [],
      actionNotableReseauRows: [],
    }
    
    switch (activeTab) {
      case "suivi_infrastructures_reseau":
        baseDecl.realisationTechniqueReseauRows = realisationTechniqueReseauRows
        break
      case "evolution_trafic_data":
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
        case "suivi_infrastructures_reseau": tabData = { realisationTechniqueReseauRows }; break
        case "evolution_trafic_data": tabData = { traficDataRows }; break
        case "amelioration_qualite": tabData = { ameliorationQualiteRows }; break
        case "couverture_reseau": tabData = { couvertureReseauRows }; break
        case "action_notable_reseau": tabData = { actionNotableReseauRows }; break
        case "situation_reseaux": tabData = { situationReseauRows }; break
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
    router.push("/dashbord")
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
          redirectTo="/dashbord"
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

            <Tabs value={activeTab} onValueChange={(value) => {
                      setActiveTab(value)
                    }} className="w-full">
              <TabsList className="flex w-full overflow-x-auto gap-1 h-auto flex-nowrap [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar]:bg-gray-200 [&::-webkit-scrollbar-thumb]:bg-gray-400 rounded">
                {declarationTabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key} className="text-xs px-3 py-2 whitespace-nowrap">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

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
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tableau</label>
                    <Select value={activeTab} onValueChange={(value) => {
                      if (disabledTabKeys.has(value)) return
                      setActiveTab(value)
                    }}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Selectionner un tableau" />
                      </SelectTrigger>
                      <SelectContent>
                        {declarationTabs.length === 0
                          ? <SelectItem value="no-tables" disabled>Aucun tableau disponible</SelectItem>
                          : declarationTabs.map((t) => (
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
              {activeTab === "suivi_infrastructures_reseau" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Suivi des infrastructures Reseau 2G/3G/4G</CardTitle>
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
              {activeTab === "evolution_trafic_data" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Evolution du Trafic Data</CardTitle>
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
              {activeTab === "situation_reseaux" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Situation Reseaux</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabSituationReseau rows={situationReseauRows} setRows={setSituationReseauRows} onSave={handleSave} isSubmitting={isSubmitting} />
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