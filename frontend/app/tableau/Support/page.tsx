"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Suspense } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { useTableauStepNavigation } from "@/hooks/use-tableau-step-navigation"
import { getDomainProgressSteps } from "@/lib/tableau-progress"
import { TableauHeader } from "@/components/tableau-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Save, ArrowRight, Pencil } from "lucide-react"
import { API_BASE } from "@/lib/config"
import { fetchKpiRowsMap } from "@/lib/kpi-rows"
import DynamicKpiTabs from "@/components/dynamic-kpi-tabs"
import { DomainAccessGuard } from "@/components/domain-access-guard"
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

// ?? Frais Personnel ???????????????????????????????????????????????????????????
type FraisPersonnelRow = { designation: string; m: string; m1: string }
const FRAIS_PERSONNEL_LABELS = ["Objectif", "Réalisation", "Taux d'atteinte", "Salaire Moyen"] as const
const DEFAULT_FRAIS_PERSONNEL_ROWS: FraisPersonnelRow[] = FRAIS_PERSONNEL_LABELS.map((designation) => ({ designation, m: "", m1: "" }))

// ?? Effectif GSP ??????????????????????????????????????????????????????????????
type EffectifGspRow = { gsp: string; m: string; m1: string; part: string }
const EFFECTIF_GSP_LABELS = ["Cadres Sup", "Cadres", "Maîtrise", "Execution", "Total"] as const
const DEFAULT_EFFECTIF_GSP_ROWS: EffectifGspRow[] = EFFECTIF_GSP_LABELS.map((gsp) => ({ gsp, m: "", m1: "", part: "" }))

// ?? Absentéisme ???????????????????????????????????????????????????????????????
type AbsenteismeRow = { motif: string; m: string; m1: string; part: string }
const ABSENTEISME_LABELS = ["Irrégulières", "Cadre Disciplinaire", "Cadre Medical", "Autorisées", "TOTAL"] as const
const DEFAULT_ABSENTEISME_ROWS: AbsenteismeRow[] = ABSENTEISME_LABELS.map((motif) => ({ motif, m: "", m1: "", part: "" }))

// ?? Mouvement Effectifs ???????????????????????????????????????????????????????
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

// ?? Mouvement Effectifs par Domaine ???????????????????????????????????????????
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

// ?? Recouvrement Créances Contentieuses ???????????????????????????????????????
type RecouvrementRow = { designation: string; m1Montant: string; mObjectif: string; mMontant: string; mTaux: string }
const RECOUVREMENT_LABELS = ["N-2 (2024)", "N-1 (2025)", "Total"] as const
const RECOUVREMENT_ANTERIEUR_LABELS = ["Antérieur au 01/01/2024"] as const
const DEFAULT_RECOUVREMENT_ROWS: RecouvrementRow[] = RECOUVREMENT_LABELS.map((designation) => ({ designation, m1Montant: "", mObjectif: "", mMontant: "", mTaux: "" }))
const DEFAULT_RECOUVREMENT_ANTERIEUR_ROWS: RecouvrementRow[] = RECOUVREMENT_ANTERIEUR_LABELS.map((designation) => ({ designation, m1Montant: "", mObjectif: "", mMontant: "", mTaux: "" }))

// ?? Budget des Formations ???????????????????????????????????????????????????
type BudgetFormationRow = { designation: string; m1: string; m: string; evol: string }
const BUDGET_FORMATION_LABELS = ["Budget Annuel", "Objectif Mensuel", "Réalisation", "Reste à réaliser", "Taux de Réalisation"] as const
const DEFAULT_BUDGET_FORMATION_ROWS: BudgetFormationRow[] = BUDGET_FORMATION_LABELS.map((designation) => ({ designation, m1: "", m: "", evol: "" }))

// ?? Effectifs Formés GSP ??????????????????????????????????????????????????????
type EffectifsFormesGspRow = { gsp: string; mObjectif: string; mRealise: string; mTaux: string; m1Realise: string }
const EFFECTIFS_FORMES_GSP_LABELS = ["Cadres & cadres Superieures", "Execution", "Maitrise", "Total Personnes Formees"] as const
const DEFAULT_EFFECTIFS_FORMES_GSP_ROWS: EffectifsFormesGspRow[] = EFFECTIFS_FORMES_GSP_LABELS.map((gsp) => ({ gsp, mObjectif: "", mRealise: "", mTaux: "", m1Realise: "" }))

// ?? Formations par Domaines ???????????????????????????????????????????????????
type FormationsDomainesRow = { domaine: string; mObjectif: string; mRealise: string; mTaux: string; m1Realise: string }
const FORMATIONS_DOMAINES_LABELS = ["Commercial", "Technique", "Management", "Divers (Langue Anglaise)", "Total Formations effectuees"] as const
const DEFAULT_FORMATIONS_DOMAINES_ROWS: FormationsDomainesRow[] = FORMATIONS_DOMAINES_LABELS.map((domaine) => ({ domaine, mObjectif: "", mRealise: "", mTaux: "", m1Realise: "" }))


// ?????????????????????????????????????????????????????????????????????????????
// 6. COMPOSANTS DE TABLEAUX (CONSERVéS UNIQUEMENT)
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

// ?? Composant générique : tableau (clé | m | m1 | part%) ?????????????????????
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
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
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

// ?? Composant générique : tableau (designation | m | m1 | evol) ???????????????
//    Réutilisé par : Creances Contentieuses
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
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
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

// ?? Composant générique : tableau Objectif / Réalisé / Taux (M-1 + M) ?????????
//    Réutilisé par : Effectifs Formés, Formations
interface OrtTableProps {
  colHeader: string
  rows: Array<Record<string, string>>
  labelKey: string
  onSave: () => void
  isSubmitting: boolean
  update: (index: number, field: string, value: string) => void
  m1Simple?: boolean
}
function OrtTable({ colHeader, rows, labelKey, onSave, isSubmitting, update, m1Simple }: OrtTableProps) {
  const m1Headers = m1Simple ? ["Réalisé"] : ["Objectif", "Réalisé", "Taux"]
  const mHeaders = ["Objectif", "Réalisé", "Taux"]
  const m1Fields = m1Simple ? ["m1Realise"] : ["m1Objectif", "m1Realise", "m1Taux"]
  const mFields = ["mObjectif", "mRealise", "mTaux"]
  const allFields = [...mFields, ...m1Fields]
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">{colHeader}</th>
              <th colSpan={m1Simple ? 1 : 3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              {m1Headers.map((h, i) => (
                <th key={i} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${m1Simple || i === m1Headers.length - 1 ? " border-r" : ""}`}>{h}</th>
              ))}
              {mHeaders.map((h, i) => (
                <th key={i + 3} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row[labelKey]}</td>
                {allFields.map((field) => (
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

// ?? 6a. Frais Personnel ???????????????????????????????????????????????????????
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
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
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

// ?? 6b. Effectif GSP ??????????????????????????????????????????????????????????
interface TabEffectifGspProps { rows: EffectifGspRow[]; setRows: React.Dispatch<React.SetStateAction<EffectifGspRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabEffectifGsp({ rows, setRows, onSave, isSubmitting }: TabEffectifGspProps) {
  const update = (i: number, f: "m" | "m1" | "part", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimplePartTable colHeader="GSP" rows={rows} labelKey="gsp" update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6c. Absentéisme ???????????????????????????????????????????????????????????
interface TabAbsenteismeProps { rows: AbsenteismeRow[]; setRows: React.Dispatch<React.SetStateAction<AbsenteismeRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabAbsenteisme({ rows, setRows, onSave, isSubmitting }: TabAbsenteismeProps) {
  const update = (i: number, f: "m" | "m1" | "part", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimplePartTable colHeader="Absenteisme (jours)" rows={rows} labelKey="motif" update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6d. Mouvement Effectifs ???????????????????????????????????????????????????
interface TabMouvementEffectifsProps { rows: MouvementEffectifsRow[]; setRows: React.Dispatch<React.SetStateAction<MouvementEffectifsRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabMouvementEffectifs({ rows, setRows, onSave, isSubmitting }: TabMouvementEffectifsProps) {
  type EditableField = keyof Pick<MouvementEffectifsRow, "mCadresSup" | "mCadres" | "mMaitrise" | "mExecution" | "m1CadresSup" | "m1Cadres" | "m1Maitrise" | "m1Execution">
  const update = (index: number, field: EditableField, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  const fields: EditableField[] = ["mCadresSup", "mCadres", "mMaitrise", "mExecution", "m1CadresSup", "m1Cadres", "m1Maitrise", "m1Execution"]
  const sumRows = (bloc: string, field: EditableField) =>
    rows.filter((r) => r.bloc === bloc && r.operation !== "TOTAL").reduce((acc, r) => acc + num(r[field]), 0)
  const sumBlocTotal = (bloc: string, fields: EditableField[]) =>
    fields.reduce((acc, f) => acc + sumRows(bloc, f), 0)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Mouvement des effectifs</th>
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Type d'operation</th>
              <th colSpan={4} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={4} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
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
                {row.operation === "TOTAL" ? (
                  <>
                    <td className="px-3 py-2 border-b"></td>
                    <td className="px-3 py-2 border-b text-xs font-bold text-gray-800">TOTAL</td>
                    <td colSpan={4} className="px-3 py-2 border-b text-center text-xs font-bold">{fmt(sumBlocTotal(row.bloc, ["mCadresSup", "mCadres", "mMaitrise", "mExecution"]))}</td>
                    <td colSpan={4} className="px-3 py-2 border-b text-center text-xs font-bold">{fmt(sumBlocTotal(row.bloc, ["m1CadresSup", "m1Cadres", "m1Maitrise", "m1Execution"]))}</td>
                  </>
                ) : (
                  <>
                    {index === 0  && <td rowSpan={5}  className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle text-center">Arrives</td>}
                    {index === 6  && <td rowSpan={9} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle text-center">Departs</td>}
                    <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.operation}</td>
                    {fields.map((field) => (
                      <td key={field} className="px-1 py-1 border-b">
                        <AmountInput value={row[field]} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                       </td>
                    ))}
                  </>
                )}
               </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? 6e. Mouvement Effectifs par Domaine ???????????????????????????????????????
interface TabMouvementEffectifsDomaineProps { rows: MouvementEffectifsDomaineRow[]; setRows: React.Dispatch<React.SetStateAction<MouvementEffectifsDomaineRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabMouvementEffectifsDomaine({ rows, setRows, onSave, isSubmitting }: TabMouvementEffectifsDomaineProps) {
  type EditableField = keyof Pick<MouvementEffectifsDomaineRow, "mCdi" | "mCdd" | "mCta" | "m1Cdi" | "m1Cdd" | "m1Cta">
  const update = (index: number, field: EditableField, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  const fields: EditableField[] = ["mCdi", "mCdd", "mCta", "m1Cdi", "m1Cdd", "m1Cta"]
  const sumRows = (bloc: string, field: EditableField) =>
    rows.filter((r) => r.bloc === bloc && r.domaine !== "TOTAL").reduce((acc, r) => acc + num(r[field]), 0)
  const sumBlocTotal = (bloc: string, flds: EditableField[]) =>
    flds.reduce((acc, f) => acc + sumRows(bloc, f), 0)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Mouvement des effectifs par Domaine</th>
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Domaine</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              {[["CDI", 0], ["CDD", 1], ["CTA", 2]].map(([h, i]) => (
                <th key={i as number} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
              {[["CDI", 3], ["CDD", 4], ["CTA", 5]].map(([h, i]) => (
                <th key={i as number} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.bloc}-${row.domaine}-${index}`} className={row.domaine === "TOTAL" ? "bg-green-100 font-semibold" : "bg-white"}>
                {row.domaine === "TOTAL" ? (
                  <>
                    <td className="px-3 py-2 border-b"></td>
                    <td className="px-3 py-2 border-b text-xs font-bold text-gray-800">TOTAL</td>
                    <td colSpan={3} className="px-3 py-2 border-b text-center text-xs font-bold">{fmt(sumBlocTotal(row.bloc, ["mCdi", "mCdd", "mCta"]))}</td>
                    <td colSpan={3} className="px-3 py-2 border-b text-center text-xs font-bold">{fmt(sumBlocTotal(row.bloc, ["m1Cdi", "m1Cdd", "m1Cta"]))}</td>
                  </>
                ) : (
                  <>
                    {index === 0 && <td rowSpan={4} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle text-center">Recrutement</td>}
                    {index === 5 && <td rowSpan={4} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle text-center">Sortant</td>}
                    <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.domaine}</td>
                    {fields.map((field) => (
                      <td key={field} className="px-1 py-1 border-b">
                        <AmountInput value={row[field]} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                      </td>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? 6f. Recouvrement Créances Contentieuses ??????????????????????????????????
function TabRecouvrement({ rows, setRows }: { rows: RecouvrementRow[]; setRows: React.Dispatch<React.SetStateAction<RecouvrementRow[]>> }) {
  const update = (i: number, f: keyof RecouvrementRow, v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 border-b border-r bg-transparent"></th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 border-b border-r bg-transparent"></th>
              <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Montant Recouvré (KDA)</th>
              <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">Objectif recouvrement (KDA)</th>
              <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">Montant Recouvré (KDA)</th>
              <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux de recouvrement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.designation}-${index}`} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.m1Montant} onChange={(e) => update(index, "m1Montant", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.mObjectif} onChange={(e) => update(index, "mObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.mMontant} onChange={(e) => update(index, "mMontant", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ?? 6e. Effectifs Formés GSP ?????????????????????????????????????????????????
interface TabEffectifsFormesGspProps { rows: EffectifsFormesGspRow[]; setRows: React.Dispatch<React.SetStateAction<EffectifsFormesGspRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabEffectifsFormesGsp({ rows, setRows, onSave, isSubmitting }: TabEffectifsFormesGspProps) {
  const update = (index: number, field: keyof EffectifsFormesGspRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Effectifs Formes par GSP" rows={rows as any} labelKey="gsp" update={(i, f, v) => update(i, f as keyof EffectifsFormesGspRow, v)} onSave={onSave} isSubmitting={isSubmitting} m1Simple />
}

// ?? 6f. Formations par Domaines ??????????????????????????????????????????????
interface TabFormationsDomainesProps { rows: FormationsDomainesRow[]; setRows: React.Dispatch<React.SetStateAction<FormationsDomainesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabFormationsDomaines({ rows, setRows, onSave, isSubmitting }: TabFormationsDomainesProps) {
  const update = (index: number, field: keyof FormationsDomainesRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Domaines" rows={rows as any} labelKey="domaine" update={(i, f, v) => update(i, f as keyof FormationsDomainesRow, v)} onSave={onSave} isSubmitting={isSubmitting} m1Simple />
}

// ?? 6g. Budget des Formations ????????????????????????????????????????????
interface TabBudgetFormationProps { rows: BudgetFormationRow[]; setRows: React.Dispatch<React.SetStateAction<BudgetFormationRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabBudgetFormation({ rows, setRows, onSave, isSubmitting }: TabBudgetFormationProps) {
  const update = (index: number, field: keyof BudgetFormationRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Budget des Formations</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Evolution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.designation}-${index}`} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.m} onChange={(e) => update(index, "m", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.evol} onChange={(e) => update(index, "evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
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


// ?????????????????????????????????????????????????????????????????????????????
// 7. CONFIGURATION DES ONGLETS (6 tableaux conservés)
// ?????????????????????????????????????????????????????????????????????????????
const TABS = [
  { key: "creances_contentieuses", label: "Créance contentieuses", color: PRIMARY_COLOR, title: "CRÉANCE CONTENTIEUSES" },
  { key: "rh", label: "RH", color: PRIMARY_COLOR, title: "RH" },
  { key: "formation", label: "Formation", color: PRIMARY_COLOR, title: "FORMATION" },
]

const KPI_TAB_KEYS = [
  "frais_personnel",
  "effectif_gsp",
  "absenteisme",
  "mouvement_effectifs",
  "mouvement_effectifs_domaine",
  "creances_contentieuses",
  "creances_contentieuses_anterieur",
  "effectifs_formes_gsp",
  "formations_domaines",
  "budget_formation",
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey =
  | "creances_contentieuses" | "rh" | "formation"
  | "frais_personnel" | "effectif_gsp" | "absenteisme" | "mouvement_effectifs" | "mouvement_effectifs_domaine"
  | "creances_contentieuses_anterieur"
  | "effectifs_formes_gsp" | "formations_domaines" | "budget_formation"

const SUPPORT_RH_TAB_KEYS = new Set<tableauTabKey>([
  "frais_personnel",
  "effectif_gsp",
  "absenteisme",
  "mouvement_effectifs",
  "mouvement_effectifs_domaine",
])

const SUPPORT_FORMATION_TAB_KEYS = new Set<tableauTabKey>([
  "effectifs_formes_gsp",
  "formations_domaines",
  "budget_formation",
])

type tableauCategoryKey = "all"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all", label: "All", tabKeys: ["creances_contentieuses", "rh", "formation"] },
]

const findtableauCategoryKeyForTab = (_tabKey: string): tableauCategoryKey => "all"

const istableauTabKey = (value: string): value is tableauTabKey =>
  TABS.some((tab) => tab.key === value) || KPI_TAB_KEYS.includes(value as tableauTabKey) || SUPPORT_RH_TAB_KEYS.has(value as tableauTabKey) || SUPPORT_FORMATION_TAB_KEYS.has(value as tableauTabKey)

const resolveSupportParentTabKey = (tabKey: string): "creances_contentieuses" | "rh" | "formation" => {
  if (SUPPORT_RH_TAB_KEYS.has(tabKey as tableauTabKey)) return "rh"
  if (SUPPORT_FORMATION_TAB_KEYS.has(tabKey as tableauTabKey)) return "formation"
  if (tabKey === "creances_contentieuses" || tabKey === "creances_contentieuses_anterieur" || tabKey === "creance_contentieuses") return "creances_contentieuses"
  return tabKey === "formation" ? "formation" : "rh"
}

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
  recouvrementRows?: RecouvrementRow[]
  recouvrementAnterieurRows?: RecouvrementRow[]
  fraisPersonnelRows?: FraisPersonnelRow[]
  effectifGspRows?: EffectifGspRow[]
  absenteismeRows?: AbsenteismeRow[]
  mouvementEffectifsRows?: MouvementEffectifsRow[]
  formationRows?: { effectifsFormesGspRows?: EffectifsFormesGspRow[]; formationsDomainesRows?: FormationsDomainesRow[]; budgetFormationRows?: BudgetFormationRow[] }
  mouvementEffectifsDomaineRows?: MouvementEffectifsDomaineRow[]
}

// ?? 8b. Type retourné par l'API (générique, ne change pas) ???????????????????
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

const normalizeRecouvrementRows = (rows?: RecouvrementRow[], labels?: readonly string[]): RecouvrementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  const l = labels ?? RECOUVREMENT_LABELS
  return l.map((designation, i) => ({ designation, m1Montant: safeString(src[i]?.m1Montant), mObjectif: safeString(src[i]?.mObjectif), mMontant: safeString(src[i]?.mMontant), mTaux: safeString(src[i]?.mTaux) }))
}

const normalizeEffectifsFormesGspRows = (rows?: EffectifsFormesGspRow[]): EffectifsFormesGspRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return EFFECTIFS_FORMES_GSP_LABELS.map((gsp, i) => ({ gsp, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Realise: safeString(src[i]?.m1Realise) }))
}

const normalizeFormationsDomainesRows = (rows?: FormationsDomainesRow[]): FormationsDomainesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return FORMATIONS_DOMAINES_LABELS.map((domaine, i) => ({ domaine, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Realise: safeString(src[i]?.m1Realise) }))
}

const normalizeBudgetFormationRows = (rows?: BudgetFormationRow[]): BudgetFormationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return BUDGET_FORMATION_LABELS.map((designation, i) => ({ designation, m1: safeString(src[i]?.m1), m: safeString(src[i]?.m), evol: safeString(src[i]?.evol) }))
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.fraisPersonnelRows?.length ?? 0) > 0) return "frais_personnel"
  if ((decl.effectifGspRows?.length ?? 0) > 0) return "effectif_gsp"
  if ((decl.absenteismeRows?.length ?? 0) > 0) return "absenteisme"
  if ((decl.mouvementEffectifsRows?.length ?? 0) > 0) return "mouvement_effectifs"
  if ((decl.mouvementEffectifsDomaineRows?.length ?? 0) > 0) return "mouvement_effectifs_domaine"
  if ((decl.recouvrementRows?.length ?? 0) > 0 || (decl.recouvrementAnterieurRows?.length ?? 0) > 0) return "creances_contentieuses"
  if ((decl.formationRows?.budgetFormationRows?.length ?? 0) > 0) return "budget_formation"
  if ((decl.formationRows?.formationsDomainesRows?.length ?? 0) > 0) return "formations_domaines"
  if ((decl.formationRows?.effectifsFormesGspRows?.length ?? 0) > 0) return "effectifs_formes_gsp"
  if (decl.formationRows) return "formation"
  return "rh"
}


// 
// PAGE
function SupportPageContent() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
  useTableauStepNavigation("Support")
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

    const requestedTab = safeString(params.get("tab")).trim()
    if (requestedTab) {
      setActiveTab(resolveSupportParentTabKey(requestedTab))
      if (requestedTab === "rh") {
        setActiveRhTab("frais_personnel")
      }
      if (requestedTab === "formation") {
        setActiveFormationTab("effectifs_formes_gsp")
      }
    }
  }, [])

  // Global meta
  const [activeTab, setActiveTab] = useState("creances_contentieuses")
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

  // Sub-tab for Formation
  const [activeFormationTab, setActiveFormationTab] = useState<"effectifs_formes_gsp" | "formations_domaines" | "budget_formation">("effectifs_formes_gsp")
  
  // Sub-tab for RH
  const [activeRhTab, setActiveRhTab] = useState<"frais_personnel" | "effectif_gsp" | "absenteisme" | "mouvement_effectifs" | "mouvement_effectifs_domaine">("frais_personnel")

  // Tab data (6 tableaux conservés)
  const [fraisPersonnelRows, setFraisPersonnelRows] = useState<FraisPersonnelRow[]>(DEFAULT_FRAIS_PERSONNEL_ROWS.map((row) => ({ ...row })))
  const [effectifGspRows, setEffectifGspRows] = useState<EffectifGspRow[]>(DEFAULT_EFFECTIF_GSP_ROWS.map((row) => ({ ...row })))
  const [absenteismeRows, setAbsenteismeRows] = useState<AbsenteismeRow[]>(DEFAULT_ABSENTEISME_ROWS.map((row) => ({ ...row })))
  const [mouvementEffectifsRows, setMouvementEffectifsRows] = useState<MouvementEffectifsRow[]>(DEFAULT_MOUVEMENT_EFFECTIFS_ROWS.map((row) => ({ ...row })))
  const [mouvementEffectifsDomaineRows, setMouvementEffectifsDomaineRows] = useState<MouvementEffectifsDomaineRow[]>(DEFAULT_MOUVEMENT_EFFECTIFS_DOMAINE_ROWS.map((row) => ({ ...row })))
  const [recouvrementRows, setRecouvrementRows] = useState<RecouvrementRow[]>(DEFAULT_RECOUVREMENT_ROWS.map((row) => ({ ...row })))
  const [recouvrementAnterieurRows, setRecouvrementAnterieurRows] = useState<RecouvrementRow[]>(DEFAULT_RECOUVREMENT_ANTERIEUR_ROWS.map((row) => ({ ...row })))
  const [effectifsFormesGspRows, setEffectifsFormesGspRows] = useState<EffectifsFormesGspRow[]>(DEFAULT_EFFECTIFS_FORMES_GSP_ROWS.map((row) => ({ ...row })))
  const [formationsDomainesRows, setFormationsDomainesRows] = useState<FormationsDomainesRow[]>(DEFAULT_FORMATIONS_DOMAINES_ROWS.map((row) => ({ ...row })))
  const [budgetFormationRows, setBudgetFormationRows] = useState<BudgetFormationRow[]>(DEFAULT_BUDGET_FORMATION_ROWS.map((row) => ({ ...row })))
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
        const map = await fetchKpiRowsMap(KPI_TAB_KEYS, "Support")
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

      const parseMouvementLabel = (label: string) => {
        const parts = label.split("-")
        const prefix = parts[0]?.trim().toLowerCase() ?? ""
        const bloc: MouvementEffectifsRow["bloc"] = prefix.startsWith("depart") ? "departs" : "arrives"
        const operation = parts.length > 1 ? parts.slice(1).join("-").trim() : label.trim()
        return { bloc, operation }
      }

      const parseDomaineLabel = (label: string) => {
        const parts = label.split("-")
        const prefix = parts[0]?.trim().toLowerCase() ?? ""
        const bloc: MouvementEffectifsDomaineRow["bloc"] = prefix.startsWith("sort") ? "sortant" : "recrutement"
        const domaine = parts.length > 1 ? parts.slice(1).join("-").trim() : label.trim()
        return { bloc, domaine }
      }

      const fraisLabels = getLabels("frais_personnel", FRAIS_PERSONNEL_LABELS)
      setFraisPersonnelRows((prev) => fraisLabels.map((designation, i) => ({
        designation,
        m: safeString(prev[i]?.m),
        m1: safeString(prev[i]?.m1),
      })))

      const effectifLabels = getLabels("effectif_gsp", EFFECTIF_GSP_LABELS)
      setEffectifGspRows((prev) => effectifLabels.map((gsp, i) => ({
        gsp,
        m: safeString(prev[i]?.m),
        m1: safeString(prev[i]?.m1),
        part: safeString(prev[i]?.part),
      })))

      const absenteismeLabels = getLabels("absenteisme", ABSENTEISME_LABELS)
      setAbsenteismeRows((prev) => absenteismeLabels.map((motif, i) => ({
        motif,
        m: safeString(prev[i]?.m),
        m1: safeString(prev[i]?.m1),
        part: safeString(prev[i]?.part),
      })))

      const mouvementFallback = MOUVEMENT_EFFECTIFS_TEMPLATE.map((item) => `${item.bloc === "arrives" ? "Arrives" : "Departs"} - ${item.operation}`)
      const mouvementLabels = getLabels("mouvement_effectifs", mouvementFallback)
      setMouvementEffectifsRows((prev) => mouvementLabels.map((label, i) => {
        const parsed = parseMouvementLabel(label)
        return {
          bloc: parsed.bloc,
          operation: parsed.operation,
          mCadresSup: safeString(prev[i]?.mCadresSup),
          mCadres: safeString(prev[i]?.mCadres),
          mMaitrise: safeString(prev[i]?.mMaitrise),
          mExecution: safeString(prev[i]?.mExecution),
          m1CadresSup: safeString(prev[i]?.m1CadresSup),
          m1Cadres: safeString(prev[i]?.m1Cadres),
          m1Maitrise: safeString(prev[i]?.m1Maitrise),
          m1Execution: safeString(prev[i]?.m1Execution),
        }
      }))

      const domaineFallback = MOUVEMENT_EFFECTIFS_DOMAINE_TEMPLATE.map((item) => `${item.bloc === "sortant" ? "Sortant" : "Recrutement"} - ${item.domaine}`)
      const domaineLabels = getLabels("mouvement_effectifs_domaine", domaineFallback)
      setMouvementEffectifsDomaineRows((prev) => domaineLabels.map((label, i) => {
        const parsed = parseDomaineLabel(label)
        return {
          bloc: parsed.bloc,
          domaine: parsed.domaine,
          mCdi: safeString(prev[i]?.mCdi),
          mCdd: safeString(prev[i]?.mCdd),
          mCta: safeString(prev[i]?.mCta),
          m1Cdi: safeString(prev[i]?.m1Cdi),
          m1Cdd: safeString(prev[i]?.m1Cdd),
          m1Cta: safeString(prev[i]?.m1Cta),
        }
      }))

      const creanceLabels = getLabels("creances_contentieuses", RECOUVREMENT_LABELS)
      setRecouvrementRows((prev) => creanceLabels.map((designation, i) => ({
        designation,
        m1Montant: safeString(prev[i]?.m1Montant),
        mObjectif: safeString(prev[i]?.mObjectif),
        mMontant: safeString(prev[i]?.mMontant),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const creanceAnterieurLabels = getLabels("creances_contentieuses_anterieur", RECOUVREMENT_ANTERIEUR_LABELS)
      setRecouvrementAnterieurRows((prev) => creanceAnterieurLabels.map((designation, i) => ({
        designation,
        m1Montant: safeString(prev[i]?.m1Montant),
        mObjectif: safeString(prev[i]?.mObjectif),
        mMontant: safeString(prev[i]?.mMontant),
        mTaux: safeString(prev[i]?.mTaux),
      })))

      const effectifsFormesLabels = getLabels("effectifs_formes_gsp", EFFECTIFS_FORMES_GSP_LABELS)
      setEffectifsFormesGspRows((prev) => effectifsFormesLabels.map((gsp, i) => ({
        gsp,
        mObjectif: safeString(prev[i]?.mObjectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
        m1Objectif: safeString(prev[i]?.m1Objectif),
        m1Realise: safeString(prev[i]?.m1Realise),
        m1Taux: safeString(prev[i]?.m1Taux),
      })))

      const formationsLabels = getLabels("formations_domaines", FORMATIONS_DOMAINES_LABELS)
      setFormationsDomainesRows((prev) => formationsLabels.map((domaine, i) => ({
        domaine,
        mObjectif: safeString(prev[i]?.mObjectif),
        mRealise: safeString(prev[i]?.mRealise),
        mTaux: safeString(prev[i]?.mTaux),
        m1Objectif: safeString(prev[i]?.m1Objectif),
        m1Realise: safeString(prev[i]?.m1Realise),
        m1Taux: safeString(prev[i]?.m1Taux),
      })))
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
  
  const selectableYears = useMemo(
    () => YEARS.filter((year) => MONTHS.some((month) => !istableauPeriodLocked(month.value, year, userRole))),
    [tableauPolicyRevision, userRole],
  )
  
  const selectableMonths = useMemo(
    () => MONTHS.filter((month) => !istableauPeriodLocked(month.value, annee, userRole)),
    [annee, tableauPolicyRevision, userRole],
  )
  
  const hasFiscalTabAccess = true
  const isSupportTabDisabled = (tabKey: tableauTabKey) => disabledTabKeys.has(resolveSupportParentTabKey(tabKey))

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
      return true
    },
    [tableauPolicyRevision, isAdminRole, userRole],
  )

  const supportTabOrder: tableauTabKey[] = [
    "frais_personnel",
    "effectif_gsp",
    "absenteisme",
    "mouvement_effectifs",
    "mouvement_effectifs_domaine",
    "creances_contentieuses",
    "effectifs_formes_gsp",
    "formations_domaines",
    "budget_formation",
  ]

  const progressSteps = getDomainProgressSteps("Support")
  const currentStepIndex = activeTab
    ? progressSteps.findIndex((step) => step.points.some((p) => p.key === activeTab) || step.key === activeTab)
    : Math.max(0, progressSteps.findIndex((step) => step.points.some((p) => p.key === supportTabOrder[0])))
  const filteredTabOrder = currentStepIndex >= 0
    ? supportTabOrder.filter((tabKey) =>
        progressSteps[currentStepIndex].points.some((p) => p.key === tabKey)
      )
    : supportTabOrder
  const handleStepClick = (pointKey: string) => {
    setActiveTab(pointKey)
  }

  useEffect(() => {
    if (declarationTabs.length === 0) return
    const parentKey = resolveSupportParentTabKey(activeTab)
    const isParentDisabled = disabledTabKeys.has(parentKey) || disabledTabKeys.has(activeTab)
    const isValidParent = declarationTabs.some((tab) => tab.key === parentKey)
    if (!isValidParent || isParentDisabled) {
      const firstEnabledTab = declarationTabs.find((tab) => !tab.isDisabled)?.key ?? declarationTabs[0].key
      const firstPoint = progressSteps.find((s) => s.key === firstEnabledTab)?.points[0].key ?? firstEnabledTab
      setActiveTab(firstPoint)
    }
  }, [activeTab, disabledTabKeys, declarationTabs, progressSteps])

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
      const requestedParentTab = resolveSupportParentTabKey(requestedTab)
      const loadedDirection = safeString(declaration.direction).trim()
      const scopedDirection = isAdminRole ? loadedDirection : resolveDirectionForRole(loadedDirection)
      setEditingDeclarationId(safeString(declaration.id) || editQuery.editId)
      setEditingCreatedAt(safeString(declaration.createdAt) || new Date().toISOString())
      setActiveTab(requestedParentTab)
      if (requestedParentTab === "rh") {
        setActiveRhTab(SUPPORT_RH_TAB_KEYS.has(requestedTab as tableauTabKey) ? (requestedTab as typeof activeRhTab) : "frais_personnel")
      }
      if (requestedParentTab === "formation") {
        setActiveFormationTab(SUPPORT_FORMATION_TAB_KEYS.has(requestedTab as tableauTabKey) ? (requestedTab as typeof activeFormationTab) : "effectifs_formes_gsp")
      }
      setDirection(scopedDirection)
      const loadedMois = normalizeMonthValue(safeString(declaration.mois))
      const loadedAnnee = normalizeYearValue(safeString(declaration.annee))
      setMois(loadedMois)
      setAnnee(loadedAnnee)
      setEditingSourceMois(loadedMois)
      setEditingSourceAnnee(loadedAnnee)
      // Chargement des données des tableaux conservés
      setFraisPersonnelRows(normalizeFraisPersonnelRows(declaration.fraisPersonnelRows))
      setEffectifGspRows(normalizeEffectifGspRows(declaration.effectifGspRows))
      setAbsenteismeRows(normalizeAbsenteismeRows(declaration.absenteismeRows))
      setMouvementEffectifsRows(normalizeMouvementEffectifsRows(declaration.mouvementEffectifsRows))
      setMouvementEffectifsDomaineRows(normalizeMouvementEffectifsDomaineRows(declaration.mouvementEffectifsDomaineRows))
      setRecouvrementRows(normalizeRecouvrementRows(declaration.recouvrementRows))
      setRecouvrementAnterieurRows(normalizeRecouvrementRows(declaration.recouvrementAnterieurRows, RECOUVREMENT_ANTERIEUR_LABELS))
      setEffectifsFormesGspRows(normalizeEffectifsFormesGspRows(declaration.formationRows?.effectifsFormesGspRows))
      setFormationsDomainesRows(normalizeFormationsDomainesRows(declaration.formationRows?.formationsDomainesRows))
      setBudgetFormationRows(normalizeBudgetFormationRows(declaration.formationRows?.budgetFormationRows))
    } catch {
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger la declaration a modifier.",
        variant: "destructive",
      })
    }
  }, [editQuery.editId, editQuery.tab, isAdminRole, isLoading, resolveDirectionForRole, router, status, user, toast])

  useEffect(() => {
    if (!activeTab || !mois || !annee || !effectiveDirection) return
    let cancelled = false
    const loadComment = async () => {
      try {
        const token = localStorage.getItem("jwt")
        const res = await fetch(`${API_BASE}/api/step-comment?tabKey=${encodeURIComponent(activeTab)}&mois=${encodeURIComponent(mois)}&annee=${encodeURIComponent(annee)}`, {
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
    const isAdminEditing = isAdminRole && !!editingDeclarationId
    const currentSupportTabKey = tabKey
    
    if (isSupportTabDisabled(tabKey)) {
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

    let validationError = false
    switch (tabKey) {
      case "frais_personnel":
        if (fraisPersonnelRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Frais Personnel.", variant: "destructive" })
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
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Mouvement des Effectifs.", variant: "destructive" })
          validationError = true
        }
        break
      case "mouvement_effectifs_domaine":
        if (mouvementEffectifsDomaineRows.some((row) => !row.mCdi || !row.mCdd || !row.mCta || !row.m1Cdi || !row.m1Cdd || !row.m1Cta)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Mouvement des Effectifs par Domaine.", variant: "destructive" })
          validationError = true
        }
        break
      case "effectifs_formes_gsp":
        if (effectifsFormesGspRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Realise)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Effectifs formes par GSP.", variant: "destructive" })
          validationError = true
        }
        break
      case "formations_domaines":
        if (formationsDomainesRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Realise)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Formations réalisées par domaines.", variant: "destructive" })
          validationError = true
        }
        break
      case "budget_formation":
        if (budgetFormationRows.some((row) => !row.m1 || !row.m || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Budget des Formations.", variant: "destructive" })
          validationError = true
        }
        break
      case "creances_contentieuses_anterieur":
        if (recouvrementAnterieurRows.some((row) => !row.m1Montant || !row.mObjectif || !row.mMontant || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Créances Contentieuses Antérieur.", variant: "destructive" })
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
      fraisPersonnelRows: [],
      effectifGspRows: [],
      absenteismeRows: [],
      mouvementEffectifsRows: [],
      recouvrementRows: [],
      recouvrementAnterieurRows: [],
      formationRows: { effectifsFormesGspRows: [], formationsDomainesRows: [], budgetFormationRows: [] },
      mouvementEffectifsDomaineRows: [],
    }
    
    switch (tabKey) {
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
      case "creances_contentieuses":
        baseDecl.recouvrementRows = recouvrementRows
        break
      case "creances_contentieuses_anterieur":
        baseDecl.recouvrementAnterieurRows = recouvrementAnterieurRows
        break
      case "effectifs_formes_gsp":
      case "formations_domaines":
      case "budget_formation":
        baseDecl.formationRows = {
          effectifsFormesGspRows: effectifsFormesGspRows,
          formationsDomainesRows: formationsDomainesRows,
          budgetFormationRows: budgetFormationRows,
        }
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
        case "frais_personnel":
          tabData = { fraisPersonnelRows }
          break
        case "effectif_gsp":
          tabData = { effectifGspRows }
          break
        case "absenteisme":
          tabData = { absenteismeRows }
          break
        case "mouvement_effectifs":
          tabData = { mouvementEffectifsRows }
          break
        case "mouvement_effectifs_domaine":
          tabData = { mouvementEffectifsDomaineRows: mouvementEffectifsDomaineRows }
          break
        case "creances_contentieuses":
          tabData = { recouvrementRows }
          break
        case "creances_contentieuses_anterieur":
          tabData = { recouvrementAnterieurRows }
          break
        case "effectifs_formes_gsp":
        case "formations_domaines":
        case "budget_formation":
          tabData = { formationRows: { effectifsFormesGspRows, formationsDomainesRows, budgetFormationRows } }
          break
      }
      const requestPayload = {
        tabKey: currentSupportTabKey,
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
    
    const tabLabel = SUPPORT_TAB_LABELS[tabKey] ?? tabKey
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

  const SUPPORT_TAB_LABELS: Partial<Record<tableauTabKey, string>> = {
    frais_personnel: "Frais Personnel (MDA)",
    effectif_gsp: "Effectif par GSP",
    absenteisme: "Absenteisme",
    mouvement_effectifs: "Mouvement des Effectifs",
    mouvement_effectifs_domaine: "Mouvement des Effectifs par Domaine",
    creances_contentieuses: "Créances contentieuses",
    effectifs_formes_gsp: "Effectifs formés par GSP",
    formations_domaines: "Formations réalisées par domaines",
    budget_formation: "Budget des Formations",
  }

  const renderDisabledNotice = (tabKey: tableauTabKey) =>
    isSupportTabDisabled(tabKey) ? (
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
      case "frais_personnel":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Frais Personnel (MDA)</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabFraisPersonnel rows={fraisPersonnelRows} setRows={setFraisPersonnelRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "effectif_gsp":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Effectif par GSP</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabEffectifGsp rows={effectifGspRows} setRows={setEffectifGspRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "absenteisme":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Absenteisme</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabAbsenteisme rows={absenteismeRows} setRows={setAbsenteismeRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "mouvement_effectifs":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Mouvement des Effectifs</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabMouvementEffectifs rows={mouvementEffectifsRows} setRows={setMouvementEffectifsRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "mouvement_effectifs_domaine":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Mouvement des Effectifs par Domaine</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabMouvementEffectifsDomaine rows={mouvementEffectifsDomaineRows} setRows={setMouvementEffectifsDomaineRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "creances_contentieuses":
        return (
          <div key={tabKey} className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Recouvrement des Créances Contentieuses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderExistingWarning("creances_contentieuses")}
                <TabRecouvrement rows={recouvrementRows} setRows={setRecouvrementRows} />
                <SaveButton onSave={() => handleSave("creances_contentieuses")} isSubmitting={isSubmitting} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Créances Contentieuses Antérieur</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderExistingWarning("creances_contentieuses_anterieur")}
                <TabRecouvrement rows={recouvrementAnterieurRows} setRows={setRecouvrementAnterieurRows} />
                <SaveButton onSave={() => handleSave("creances_contentieuses_anterieur")} isSubmitting={isSubmitting} />
              </CardContent>
            </Card>
          </div>
        )
      case "effectifs_formes_gsp":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Effectifs formes par GSP</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabEffectifsFormesGsp rows={effectifsFormesGspRows} setRows={setEffectifsFormesGspRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "formations_domaines":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Formations réalisées par domaines</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabFormationsDomaines rows={formationsDomainesRows} setRows={setFormationsDomainesRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "budget_formation":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Budget des Formations</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabBudgetFormation rows={budgetFormationRows} setRows={setBudgetFormationRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <LayoutWrapper user={user}>
      <DomainAccessGuard user={user} domainKey="Support">
      <>
          <div className="space-y-5 w-full" ref={printRef}>
            <TableauHeader
              title="Tableaux Support"
              domain="Support"
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
              {filteredTabOrder.map((tabKey) => (
              <div key={tabKey}>
                {renderTabCard(tabKey)}
              </div>
            ))}

              <DynamicKpiTabs
                domain="support"
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
      </DomainAccessGuard>
    </LayoutWrapper>
  )
}

export default function NouvelleDeclarationPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-sm text-muted-foreground">Chargement...</p></div>}>
      <SupportPageContent />
    </Suspense>
  )
}