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

// 1. CONSTANTES GLOBALES
// ?????????????????????????????????????????????????????????????????????????????
const PRIMARY_COLOR = "#2db34b"


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

const isTotalRow = (d: string) => /total/i.test(d)

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
type RealisationTechniqueReseauRow = { label: string; m1Realise: string; mObjectif: string; mRealise: string; mTaux: string }
const REALISATION_TECHNIQUE_RESEAU_LABELS = [
  "Acquisition des nouveaux sites",
  "Notes de calculs",
  "Acquisition des nouveaux sites SUCE",
  "Construction GC des nouveaux sites SUCE",
  "Construction GC de nouveaux sites",
  "Renforcement GC",
] as const
const DEFAULT_REALISATION_TECHNIQUE_RESEAU_ROWS: RealisationTechniqueReseauRow[] =
  REALISATION_TECHNIQUE_RESEAU_LABELS.map((label) => ({ label, m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" }))

// ?? Situation Réseau ?????????????????????????????????????????????????????????
type SituationReseauRow = { situation: string; equipements: string; m: string; m1: string }
const DEFAULT_SITUATION_RESEAU_ROWS: SituationReseauRow[] = [
  { situation: "Réseau 2G", equipements: "BTS 900/1800 Mhz", m: "", m1: "" },
  { situation: "Réseau 3G", equipements: "NodeB", m: "", m1: "" },
  { situation: "Réseau 4G", equipements: "eNodeB (Evolved NodeB) (FDD+TDD)", m: "", m1: "" },
  { situation: "Réseau 4G", equipements: "eNodeB (Evolved NodeB) (FDD)", m: "", m1: "" },
  { situation: "Réseaux 5G", equipements: "GNodeB", m: "", m1: "" },
]

// ?? Trafic Data ??????????????????????????????????????????????????????????????
type TraficDataRow = { label: string; m: string; m1: string }
const TRAFIC_DATA_LABELS = ["2G-3G Traffic Volume per day", "4G-5G Traffic Volume per day", "Total daily traffic volume"] as const
const DEFAULT_TRAFIC_DATA_ROWS: TraficDataRow[] = TRAFIC_DATA_LABELS.map((label) => ({ label, m: "", m1: "" }))

// ?? Action Notable Réseau ?????????????????????????????????????????????????????
type ActionNotableReseauRow = { action: string; objectif2025: string; m1Realise: string; mObjectif: string; mRealise: string; mTaux: string }
const DEFAULT_ACTION_NOTABLE_RESEAU_ROWS: ActionNotableReseauRow[] = [
  { action: "Projet Nouveaux Sites", objectif2025: "Mise en service de 1500 nouveaux sites", m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" },
  { action: "Densification du LTE_30Mhz (1800_15+2100_15)", objectif2025: "La mise à niveau de 500 sites avec la technologie 4G", m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" },
  { action: "Ajout de la couche LTE TDD 2300", objectif2025: "Implémentation de 1000 Sites LTE TDD (Massive MIMO & 8T8R)", m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" },
  { action: "Ajout de la nouvelle technologie 5G 3500 + LTE TDD 2600", objectif2025: "Implémentation de 2000 Sites Dual band (5G NR 3500 + LTE TDD 2600)", m1Realise: "", mObjectif: "", mRealise: "", mTaux: "" },
]

// ?? Amélioration Qualité 4G ???????????????????????????????????????????????????
type AmeliorationQualite4GRow = { dr: string; m1Realise: string; mObjectif: string; mRealise: string }
const EMPTY_QUALITE_4G_ROW: AmeliorationQualite4GRow = { dr: "", m1Realise: "", mObjectif: "", mRealise: "" }
const FALLBACK_DR_LIST = ["DR Alger", "DR Oran", "DR Constantine", "DR Setif", "DR Ouargla", "DR Bechar", "DR Annaba", "DR Chlef"]
const DEFAULT_QUALITE_4G_ROWS: AmeliorationQualite4GRow[] = FALLBACK_DR_LIST.map((dr) => ({ dr, m1Realise: "", mObjectif: "", mRealise: "" }))


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
interface TabRealisationTechniqueReseauProps { rows: RealisationTechniqueReseauRow[]; setRows: React.Dispatch<React.SetStateAction<RealisationTechniqueReseauRow[]>>; onSave: () => void; isSubmitting: boolean; mois: string }
function TabRealisationTechniqueReseau({ rows, setRows, onSave, isSubmitting, mois }: TabRealisationTechniqueReseauProps) {
  const update = (index: number, field: keyof RealisationTechniqueReseauRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Realisations techniques</th>
              <th colSpan={1} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, 0)}</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Réalisé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mObjectif} onChange={(e) => update(index, "mObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise}  onChange={(e) => update(index, "mRealise",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0" /></td>
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
interface TabSituationReseauProps { rows: SituationReseauRow[]; setRows: React.Dispatch<React.SetStateAction<SituationReseauRow[]>>; onSave: () => void; isSubmitting: boolean; mois: string }
function TabSituationReseau({ rows, setRows, onSave, isSubmitting, mois }: TabSituationReseauProps) {
  const update = (index: number, field: "m" | "m1", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  const rowSpanMap = rows.map((row, i) => {
    if (i > 0 && row.situation === rows[i - 1].situation) return 0
    let count = 1
    for (let j = i + 1; j < rows.length && rows[j].situation === row.situation; j++) count++
    return count
  })

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Situation Réseaux</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Équipements</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, -1)}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, 0)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.situation}-${index}`} className="bg-white">
                {rowSpanMap[index] !== 0 ? (
                  <td rowSpan={rowSpanMap[index]} className="px-3 py-2 border-b text-xs font-medium text-gray-800 align-middle text-center">{row.situation}</td>
                ) : null}
                <td className="px-3 py-2 border-b text-xs text-gray-700">{row.equipements}</td>
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
interface TabTraficDataProps { rows: TraficDataRow[]; setRows: React.Dispatch<React.SetStateAction<TraficDataRow[]>>; onSave: () => void; isSubmitting: boolean; mois: string }
function TabTraficData({ rows, setRows, onSave, isSubmitting, mois }: TabTraficDataProps) {
  const update = (index: number, field: "m" | "m1", value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  const nonTotalRows = rows.filter((r) => !isTotalRow(r.label))
  const sumM = nonTotalRows.reduce((s, r) => s + num(r.m), 0)
  const sumM1 = nonTotalRows.reduce((s, r) => s + num(r.m1), 0)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Trafic Data (TB)</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, -1)}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, 0)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isTtl = isTotalRow(row.label)
              const dM = isTtl ? fmt(sumM) : null
              const dM1 = isTtl ? fmt(sumM1) : null
              return (
                <tr key={row.label} className={isTtl ? "bg-green-100 font-semibold" : "bg-white"}>
                  <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                  <td className="px-1 py-1 border-b">
                    {isTtl ? <span className="block px-2 text-xs text-right">{dM}</span> : <AmountInput value={row.m} onChange={(e) => update(index, "m", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />}
                  </td>
                  <td className="px-1 py-1 border-b">
                    {isTtl ? <span className="block px-2 text-xs text-right">{dM1}</span> : <AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />}
                  </td>
                </tr>
              )
            })}
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
  mois: string
}
function DynamicWilayaTable<T extends { wilaya: string; mObjectif: string; mRealise: string; m1Objectif: string; m1Realise: string; ecart: string }>({
  colHeader, rows, onAdd, onRemove, update, onSave, isSubmitting, mois,
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
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, 0)}</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">Écart</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Action</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
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

// ?? Composant générique : tableau Objectif / Réalisé / Taux (M + M) ?????????
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
  const fields = ["mObjectif", "mRealise", "mTaux", "m1Objectif", "m1Realise", "m1Taux"]
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">{colHeader}</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, 0)}</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, -1)}</th>
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
interface TabActionNotableReseauProps { rows: ActionNotableReseauRow[]; setRows: React.Dispatch<React.SetStateAction<ActionNotableReseauRow[]>>; onSave: () => void; isSubmitting: boolean; mois: string; annee: string }
function TabActionNotableReseau({ rows, setRows, onSave, isSubmitting, mois, annee }: TabActionNotableReseauProps) {
  const update = (index: number, field: keyof ActionNotableReseauRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Action</th>
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Objectif {annee}</th>
              <th colSpan={1} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, 0)}</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              {["Objectif", "Réalisé (ON AIR)", "Taux"].map((h, i) => (
                <th key={i} className={`px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? "" : " border-r"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.action}</td>
                <td className="px-3 py-2 border-b text-xs text-gray-700">{row.objectif2025}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                {(["mObjectif", "mRealise", "mTaux"] as const).map((field) => (
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


// ?? 6g. Amélioration Qualité 4G ???????????????????????????????????????????????
interface TabAmeliorationQualiteProps {
  tech: string
  debitRows: AmeliorationQualite4GRow[]
  setDebitRows: React.Dispatch<React.SetStateAction<AmeliorationQualite4GRow[]>>
  couvertureRows: AmeliorationQualite4GRow[]
  setCouvertureRows: React.Dispatch<React.SetStateAction<AmeliorationQualite4GRow[]>>
  onSave: () => void
  isSubmitting: boolean
  mois: string
}
function TabAmeliorationQualite({ tech, debitRows, setDebitRows, couvertureRows, setCouvertureRows, onSave, isSubmitting, mois }: TabAmeliorationQualiteProps) {
  const updateRow = (setter: React.Dispatch<React.SetStateAction<AmeliorationQualite4GRow[]>>, index: number, field: keyof AmeliorationQualite4GRow, value: string) =>
    setter((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  const debitTitle = `Débit utilisateur moyen ${tech} (Mbps) / DR`
  const couvertureTitle = `% Population Couverture ${tech} / DR`

  const renderSection = (title: string, rows: AmeliorationQualite4GRow[], setter: React.Dispatch<React.SetStateAction<AmeliorationQualite4GRow[]>>, showHeader: boolean = true) => {
    const objectifLabel = `Objectif ${tech}`
    const realiseLabel = `Réalisé ${tech}`
    return (
      <>
        {showHeader && (
          <tr className="bg-gray-50">
            <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-gray-700 border-b">{title}</td>
          </tr>
        )}
        {rows.map((row, index) => (
          <tr key={`${title}-${index}`} className="bg-white">
            <td className="px-1 py-1 border-b text-xs font-medium text-gray-700">{row.dr}</td>
            <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise} onChange={(e) => updateRow(setter, index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
            <td className="px-1 py-1 border-b"><AmountInput value={row.mObjectif} onChange={(e) => updateRow(setter, index, "mObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
            <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise}  onChange={(e) => updateRow(setter, index, "mRealise",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
            <td className="px-1 py-1 border-b"></td>
          </tr>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">{debitTitle}</th>
              <th colSpan={1} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, 0)}</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Action</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">{`Objectif ${tech}`}</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">{`Réalisé ${tech}`}</th>
            </tr>
          </thead>
          <tbody>
            {renderSection(debitTitle, debitRows, setDebitRows, false)}
            {renderSection(couvertureTitle, couvertureRows, setCouvertureRows)}
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
  { key: "suivi_infrastructures_reseau", label: "Suivi des infrastructures Réseau 2G/3G/4G", color: PRIMARY_COLOR, title: "SUIVI DES INFRASTRUCTURES RÉSEAU 2G/3G/4G" },
  { key: "situation_reseau",            label: "Situation Réseau",                         color: PRIMARY_COLOR, title: "SITUATION RÉSEAU" },
  { key: "trafic_data",                 label: "Évolution du Trafic Data",                color: PRIMARY_COLOR, title: "ÉVOLUTION DU TRAFIC DATA" },
  { key: "action_notable_reseau",       label: "Action notable sur le Réseau",            color: PRIMARY_COLOR, title: "ACTION NOTABLE SUR LE RÉSEAU" },
  { key: "amelioration_qualite_4g",     label: "Amélioration Qualité 4G",                 color: PRIMARY_COLOR, title: "AMÉLIORATION QUALITÉ 4G" },
  { key: "amelioration_qualite_5g",     label: "Amélioration Qualité 5G",                 color: PRIMARY_COLOR, title: "AMÉLIORATION QUALITÉ 5G" },
]

const KPI_TAB_KEYS = [
  "suivi_infrastructures_reseau",
  "trafic_data",
  "action_notable_reseau",
  "situation_reseau",
  "amelioration_qualite_4g",
  "amelioration_qualite_5g",
  "amelioration_qualite",
  "couverture_reseau",
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey =
  | "suivi_infrastructures_reseau" | "trafic_data"
  | "action_notable_reseau" | "situation_reseau"
  | "amelioration_qualite_4g" | "amelioration_qualite_5g"

type tableauCategoryKey =
  | "all"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all", label: "Toutes les categories", tabKeys: ["suivi_infrastructures_reseau", "trafic_data", "action_notable_reseau", "situation_reseau", "amelioration_qualite_4g", "amelioration_qualite_5g"] },
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
  actionNotableReseauRows?: ActionNotableReseauRow[]
  debitQualite4GRows?: AmeliorationQualite4GRow[]
  couvertureQualite4GRows?: AmeliorationQualite4GRow[]
  debitQualite5GRows?: AmeliorationQualite4GRow[]
  couvertureQualite5GRows?: AmeliorationQualite4GRow[]
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
  return REALISATION_TECHNIQUE_RESEAU_LABELS.map((label, i) => ({ label, m1Realise: safeString(src[i]?.m1Realise), mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux) }))
}

const normalizeSituationReseauRows = (rows?: SituationReseauRow[]): SituationReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DEFAULT_SITUATION_RESEAU_ROWS.map((def, i) => ({ situation: def.situation, equipements: def.equipements, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1) }))
}

const normalizeTraficDataRows = (rows?: TraficDataRow[]): TraficDataRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return TRAFIC_DATA_LABELS.map((label, i) => ({ label, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1) }))
}

const normalizeActionNotableReseauRows = (rows?: ActionNotableReseauRow[]): ActionNotableReseauRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DEFAULT_ACTION_NOTABLE_RESEAU_ROWS.map((def, i) => ({ ...def, m1Realise: safeString(src[i]?.m1Realise), mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux) }))
}

const normalizeQualite4GRows = (rows?: AmeliorationQualite4GRow[]): AmeliorationQualite4GRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return src.length > 0
    ? src.map((r) => ({ dr: safeString(r.dr), m1Realise: safeString(r.m1Realise), mObjectif: safeString(r.mObjectif), mRealise: safeString(r.mRealise) }))
    : [{ ...EMPTY_QUALITE_4G_ROW }]
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.realisationTechniqueReseauRows?.length ?? 0) > 0) return "suivi_infrastructures_reseau"
  if ((decl.traficDataRows?.length ?? 0) > 0) return "trafic_data"
  if ((decl.actionNotableReseauRows?.length ?? 0) > 0) return "action_notable_reseau"
  if ((decl.debitQualite4GRows?.length ?? 0) > 0) return "amelioration_qualite_4g"
  if ((decl.couvertureQualite4GRows?.length ?? 0) > 0) return "amelioration_qualite_4g"
  if ((decl.debitQualite5GRows?.length ?? 0) > 0) return "amelioration_qualite_5g"
  if ((decl.couvertureQualite5GRows?.length ?? 0) > 0) return "amelioration_qualite_5g"
  return "suivi_infrastructures_reseau"
}


// 
// PAGE
function DVDRSPageContent() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
  useTableauStepNavigation("DVDRS")
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
  const [activeTab, setActiveTab] = useState("suivi_infrastructures_reseau")
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

  // Tab data (TABLEAUX CONSERVéS)
  const [realisationTechniqueReseauRows, setRealisationTechniqueReseauRows] = useState<RealisationTechniqueReseauRow[]>(DEFAULT_REALISATION_TECHNIQUE_RESEAU_ROWS.map((row) => ({ ...row })))
  const [situationReseauRows, setSituationReseauRows] = useState<SituationReseauRow[]>(DEFAULT_SITUATION_RESEAU_ROWS.map((row) => ({ ...row })))
  const [traficDataRows, setTraficDataRows] = useState<TraficDataRow[]>(DEFAULT_TRAFIC_DATA_ROWS.map((row) => ({ ...row })))
  const [actionNotableReseauRows, setActionNotableReseauRows] = useState<ActionNotableReseauRow[]>(DEFAULT_ACTION_NOTABLE_RESEAU_ROWS.map((row) => ({ ...row })))
  const [debitQualite4GRows, setDebitQualite4GRows] = useState<AmeliorationQualite4GRow[]>(DEFAULT_QUALITE_4G_ROWS.map((row) => ({ ...row })))
  const [couvertureQualite4GRows, setCouvertureQualite4GRows] = useState<AmeliorationQualite4GRow[]>(DEFAULT_QUALITE_4G_ROWS.map((row) => ({ ...row })))
  const [debitQualite5GRows, setDebitQualite5GRows] = useState<AmeliorationQualite4GRow[]>(DEFAULT_QUALITE_4G_ROWS.map((row) => ({ ...row })))
  const [couvertureQualite5GRows, setCouvertureQualite5GRows] = useState<AmeliorationQualite4GRow[]>(DEFAULT_QUALITE_4G_ROWS.map((row) => ({ ...row })))
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
      const map = await fetchKpiRowsMap(KPI_TAB_KEYS, "DVDRS")
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

    const realisationLabels = getLabels("suivi_infrastructures_reseau", REALISATION_TECHNIQUE_RESEAU_LABELS)
    setRealisationTechniqueReseauRows((prev) => realisationLabels.map((label, i) => ({
      label,
      m1Realise: safeString(prev[i]?.m1Realise),
      mObjectif: safeString(prev[i]?.mObjectif),
      mRealise: safeString(prev[i]?.mRealise),
      mTaux: safeString(prev[i]?.mTaux),
    })))

    setSituationReseauRows((prev) => DEFAULT_SITUATION_RESEAU_ROWS.map((def, i) => ({
      situation: def.situation,
      equipements: safeString(prev[i]?.equipements) || def.equipements,
      m: safeString(prev[i]?.m),
      m1: safeString(prev[i]?.m1),
    })))

    const traficLabels = getLabels("trafic_data", TRAFIC_DATA_LABELS)
    setTraficDataRows((prev) => traficLabels.map((label, i) => ({
      label,
      m: safeString(prev[i]?.m),
      m1: safeString(prev[i]?.m1),
    })))

    const actionLabels = getLabels("action_notable_reseau", DEFAULT_ACTION_NOTABLE_RESEAU_ROWS.map((row) => row.action))
    setActionNotableReseauRows((prev) => actionLabels.map((action, i) => ({
      action,
      objectif2025: safeString(prev[i]?.objectif2025) || DEFAULT_ACTION_NOTABLE_RESEAU_ROWS[i]?.objectif2025 || "",
      mObjectif: safeString(prev[i]?.mObjectif),
      mRealise: safeString(prev[i]?.mRealise),
      mTaux: safeString(prev[i]?.mTaux),
      m1Realise: safeString(prev[i]?.m1Realise),
    })))

    const drList = regions.length > 0 ? regions.map((r) => r.name) : FALLBACK_DR_LIST
    setDebitQualite4GRows((prev) => drList.map((dr, i) => ({
      dr,
      m1Realise: safeString(prev[i]?.m1Realise),
      mObjectif: safeString(prev[i]?.mObjectif),
      mRealise: safeString(prev[i]?.mRealise),
    })))
    setCouvertureQualite4GRows((prev) => drList.map((dr, i) => ({
      dr,
      m1Realise: safeString(prev[i]?.m1Realise),
      mObjectif: safeString(prev[i]?.mObjectif),
      mRealise: safeString(prev[i]?.mRealise),
    })))
    setDebitQualite5GRows((prev) => drList.map((dr, i) => ({
      dr,
      m1Realise: safeString(prev[i]?.m1Realise),
      mObjectif: safeString(prev[i]?.mObjectif),
      mRealise: safeString(prev[i]?.mRealise),
    })))
    setCouvertureQualite5GRows((prev) => drList.map((dr, i) => ({
      dr,
      m1Realise: safeString(prev[i]?.m1Realise),
      mObjectif: safeString(prev[i]?.mObjectif),
      mRealise: safeString(prev[i]?.mRealise),
    })))
  }, [kpiRows, regions])

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
  
  const allowedTabKeys = useDeclarationAccess("dvdrs", user?.allowedKpis)
  
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

    const autoPopulate = <T extends Record<string, string>>(
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

    autoPopulate("suivi_infrastructures_reseau", setRealisationTechniqueReseauRows)
    autoPopulate("situation_reseau", setSituationReseauRows)
    autoPopulate("trafic_data", setTraficDataRows)
    autoPopulate("action_notable_reseau", setActionNotableReseauRows)
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
      // Chargement des données des tableaux conservés
      setRealisationTechniqueReseauRows(normalizeRealisationTechniqueReseauRows(declaration.realisationTechniqueReseauRows))
      setSituationReseauRows(normalizeSituationReseauRows(declaration.situationReseauRows))
      setTraficDataRows(normalizeTraficDataRows(declaration.traficDataRows))
      setActionNotableReseauRows(normalizeActionNotableReseauRows(declaration.actionNotableReseauRows))
      setDebitQualite4GRows(normalizeQualite4GRows(declaration.debitQualite4GRows))
      setCouvertureQualite4GRows(normalizeQualite4GRows(declaration.couvertureQualite4GRows))
      setDebitQualite5GRows(normalizeQualite4GRows(declaration.debitQualite5GRows))
      setCouvertureQualite5GRows(normalizeQualite4GRows(declaration.couvertureQualite5GRows))
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
      case "suivi_infrastructures_reseau":
        if (realisationTechniqueReseauRows.some((row) => !row.m1Realise || !row.mObjectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Suivi des infrastructures Reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "trafic_data":
        if (traficDataRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Evolution du Trafic Data.", variant: "destructive" })
          validationError = true
        }
        break
      case "action_notable_reseau":
        if (actionNotableReseauRows.some((row) => !row.m1Realise || !row.mObjectif || !row.mRealise || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Action notable sur le reseau.", variant: "destructive" })
          validationError = true
        }
        break
      case "situation_reseau":
        if (situationReseauRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Situation Reseaux.", variant: "destructive" })
          validationError = true
        }
        break
      case "amelioration_qualite_4g":
        if (debitQualite4GRows.some((row) => !row.dr || !row.m1Realise || !row.mObjectif || !row.mRealise) ||
            couvertureQualite4GRows.some((row) => !row.dr || !row.m1Realise || !row.mObjectif || !row.mRealise)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Amelioration Qualite 4G.", variant: "destructive" })
          validationError = true
        }
        break
      case "amelioration_qualite_5g":
        if (debitQualite5GRows.some((row) => !row.dr || !row.m1Realise || !row.mObjectif || !row.mRealise) ||
            couvertureQualite5GRows.some((row) => !row.dr || !row.m1Realise || !row.mObjectif || !row.mRealise)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Amelioration Qualite 5G.", variant: "destructive" })
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
      actionNotableReseauRows: [],
      debitQualite4GRows: [],
      couvertureQualite4GRows: [],
      debitQualite5GRows: [],
      couvertureQualite5GRows: [],
    }
    
    switch (tabKey) {
      case "suivi_infrastructures_reseau":
        baseDecl.realisationTechniqueReseauRows = realisationTechniqueReseauRows
        break
      case "trafic_data":
        baseDecl.traficDataRows = traficDataRows
        break
      case "action_notable_reseau":
        baseDecl.actionNotableReseauRows = actionNotableReseauRows
        break
      case "amelioration_qualite_4g":
        baseDecl.debitQualite4GRows = debitQualite4GRows
        baseDecl.couvertureQualite4GRows = couvertureQualite4GRows
        break
      case "amelioration_qualite_5g":
        baseDecl.debitQualite5GRows = debitQualite5GRows
        baseDecl.couvertureQualite5GRows = couvertureQualite5GRows
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
        case "suivi_infrastructures_reseau": tabData = { realisationTechniqueReseauRows }; break
        case "trafic_data": tabData = { traficDataRows }; break
        case "action_notable_reseau": tabData = { actionNotableReseauRows }; break
        case "situation_reseau": tabData = { situationReseauRows }; break
        case "amelioration_qualite_4g": tabData = { debitQualite4GRows, couvertureQualite4GRows }; break
        case "amelioration_qualite_5g": tabData = { debitQualite5GRows, couvertureQualite5GRows }; break
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

  const getExistingDeclarationForTab = (tabKey: string): Savedtableau | null => {
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
      case "suivi_infrastructures_reseau":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Suivi des infrastructures Reseau 2G/3G/4G/5G</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabRealisationTechniqueReseau
                rows={realisationTechniqueReseauRows}
                setRows={setRealisationTechniqueReseauRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
                mois={mois}
              />

            </CardContent>
          </Card>
        )
      case "trafic_data":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Evolution du Trafic Data</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabTraficData rows={traficDataRows} setRows={setTraficDataRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} mois={mois} />

            </CardContent>
          </Card>
        )
      case "action_notable_reseau":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Action notable sur le reseau</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabActionNotableReseau rows={actionNotableReseauRows} setRows={setActionNotableReseauRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} mois={mois} annee={annee} />

            </CardContent>
          </Card>
        )
      case "situation_reseau":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Situation Reseaux</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabSituationReseau rows={situationReseauRows} setRows={setSituationReseauRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} mois={mois} />

            </CardContent>
          </Card>
        )
      case "amelioration_qualite_4g":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Amélioration Qualité 4G</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabAmeliorationQualite
                tech="4G"
                debitRows={debitQualite4GRows}
                setDebitRows={setDebitQualite4GRows}
                couvertureRows={couvertureQualite4GRows}
                setCouvertureRows={setCouvertureQualite4GRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
                mois={mois}
              />
            </CardContent>
          </Card>
        )
      case "amelioration_qualite_5g":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Amélioration Qualité 5G</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabAmeliorationQualite
                tech="5G"
                debitRows={debitQualite5GRows}
                setDebitRows={setDebitQualite5GRows}
                couvertureRows={couvertureQualite5GRows}
                setCouvertureRows={setCouvertureQualite5GRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
                mois={mois}
              />
            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <LayoutWrapper user={user}>
      <DomainAccessGuard user={user} domainKey="DVDRS">
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
              title="Tableaux DVDRS"
              domain="DVDRS"
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
                domain="dvdrs"
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
      <DVDRSPageContent />
    </Suspense>
  )
}