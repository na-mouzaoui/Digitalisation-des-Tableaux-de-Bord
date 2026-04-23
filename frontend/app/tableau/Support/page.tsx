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
// 1. CONSTANTES GLOBALES
// ─────────────────────────────────────────────────────────────────────────────
const PRIMARY_COLOR = "#2db34b"


// ─────────────────────────────────────────────────────────────────────────────
// 2. STUBS POLITIQUE FISCALE
// ─────────────────────────────────────────────────────────────────────────────
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
// 5. TYPES DE DONNÉES (TABLEAUX CONSERVÉS UNIQUEMENT)
// ═════════════════════════════════════════════════════════════════════════════

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

// ── Effectifs Formés GSP ──────────────────────────────────────────────────────
type EffectifsFormesGspRow = { gsp: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const EFFECTIFS_FORMES_GSP_LABELS = ["Cadres & cadres Superieures", "Execution", "Maitrise", "Total Personnes Formees"] as const
const DEFAULT_EFFECTIFS_FORMES_GSP_ROWS: EffectifsFormesGspRow[] = EFFECTIFS_FORMES_GSP_LABELS.map((gsp) => ({ gsp, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))

// ── Formations par Domaines ───────────────────────────────────────────────────
type FormationsDomainesRow = { domaine: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const FORMATIONS_DOMAINES_LABELS = ["Commercial", "Technique", "Management", "Divers (Langue Anglaise)", "Total Formations effectuees"] as const
const DEFAULT_FORMATIONS_DOMAINES_ROWS: FormationsDomainesRow[] = FORMATIONS_DOMAINES_LABELS.map((domaine) => ({ domaine, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))


// ─────────────────────────────────────────────────────────────────────────────
// 6. COMPOSANTS DE TABLEAUX (CONSERVÉS UNIQUEMENT)
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

// ── Composant générique : tableau Objectif / Réalisé / Taux (M + M+1) ─────────
//    Réutilisé par : Effectifs Formés, Formations
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

// ── 6a. Frais Personnel ───────────────────────────────────────────────────────
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

// ── 6b. Effectif GSP ──────────────────────────────────────────────────────────
interface TabEffectifGspProps { rows: EffectifGspRow[]; setRows: React.Dispatch<React.SetStateAction<EffectifGspRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabEffectifGsp({ rows, setRows, onSave, isSubmitting }: TabEffectifGspProps) {
  const update = (i: number, f: "m" | "m1" | "part", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimplePartTable colHeader="GSP" rows={rows} labelKey="gsp" update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6c. Absentéisme ───────────────────────────────────────────────────────────
interface TabAbsenteismeProps { rows: AbsenteismeRow[]; setRows: React.Dispatch<React.SetStateAction<AbsenteismeRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabAbsenteisme({ rows, setRows, onSave, isSubmitting }: TabAbsenteismeProps) {
  const update = (i: number, f: "m" | "m1" | "part", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimplePartTable colHeader="Absenteisme (jours)" rows={rows} labelKey="motif" update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6d. Mouvement Effectifs ───────────────────────────────────────────────────
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

// ── 6e. Effectifs Formés GSP ─────────────────────────────────────────────────
interface TabEffectifsFormesGspProps { rows: EffectifsFormesGspRow[]; setRows: React.Dispatch<React.SetStateAction<EffectifsFormesGspRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabEffectifsFormesGsp({ rows, setRows, onSave, isSubmitting }: TabEffectifsFormesGspProps) {
  const update = (index: number, field: keyof EffectifsFormesGspRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Effectifs Formes par GSP" rows={rows as any} labelKey="gsp" update={(i, f, v) => update(i, f as keyof EffectifsFormesGspRow, v)} onSave={onSave} isSubmitting={isSubmitting} />
}

// ── 6f. Formations par Domaines ──────────────────────────────────────────────
interface TabFormationsDomainesProps { rows: FormationsDomainesRow[]; setRows: React.Dispatch<React.SetStateAction<FormationsDomainesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabFormationsDomaines({ rows, setRows, onSave, isSubmitting }: TabFormationsDomainesProps) {
  const update = (index: number, field: keyof FormationsDomainesRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Domaines" rows={rows as any} labelKey="domaine" update={(i, f, v) => update(i, f as keyof FormationsDomainesRow, v)} onSave={onSave} isSubmitting={isSubmitting} />
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. CONFIGURATION DES ONGLETS (6 tableaux conservés)
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "frais_personnel",        label: "Frais Personnel (mda)",              color: PRIMARY_COLOR, title: "FRAIS PERSONNEL (MDA)" },
  { key: "effectif_gsp",           label: "GSP",                                color: PRIMARY_COLOR, title: "EFFECTIF PAR GSP" },
  { key: "absenteisme",            label: "Absentéisme",                        color: PRIMARY_COLOR, title: "ABSENTEISME (JOURS)" },
  { key: "mouvement_effectifs",    label: "Mouvement des Effectifs",            color: PRIMARY_COLOR, title: "MOUVEMENT DES EFFECTIFS" },
  { key: "effectifs_formes_gsp",   label: "Effectifs formés par gsp",           color: PRIMARY_COLOR, title: "EFFECTIFS FORMES PAR GSP" },
  { key: "formations_domaines",    label: "Formation realise par domaines",     color: PRIMARY_COLOR, title: "FORMATIONS REALISEES PAR DOMAINES" },
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey =
  | "frais_personnel" | "effectif_gsp" | "absenteisme"
  | "mouvement_effectifs" | "effectifs_formes_gsp" | "formations_domaines"

type tableauCategoryKey = "all" | "rh" | "formation"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all",        label: "Toutes les categories", tabKeys: [] },
  { key: "rh",         label: "RH",                   tabKeys: ["frais_personnel", "effectif_gsp", "absenteisme", "mouvement_effectifs"] },
  { key: "formation",  label: "Formation",            tabKeys: ["effectifs_formes_gsp", "formations_domaines"] },
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
interface Savedtableau {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  fraisPersonnelRows?: FraisPersonnelRow[]
  effectifGspRows?: EffectifGspRow[]
  absenteismeRows?: AbsenteismeRow[]
  mouvementEffectifsRows?: MouvementEffectifsRow[]
  effectifsFormesGspRows?: EffectifsFormesGspRow[]
  formationsDomainesRows?: FormationsDomainesRow[]
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

const normalizeEffectifsFormesGspRows = (rows?: EffectifsFormesGspRow[]): EffectifsFormesGspRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return EFFECTIFS_FORMES_GSP_LABELS.map((gsp, i) => ({ gsp, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeFormationsDomainesRows = (rows?: FormationsDomainesRow[]): FormationsDomainesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return FORMATIONS_DOMAINES_LABELS.map((domaine, i) => ({ domaine, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.fraisPersonnelRows?.length ?? 0) > 0) return "frais_personnel"
  if ((decl.effectifGspRows?.length ?? 0) > 0) return "effectif_gsp"
  if ((decl.absenteismeRows?.length ?? 0) > 0) return "absenteisme"
  if ((decl.mouvementEffectifsRows?.length ?? 0) > 0) return "mouvement_effectifs"
  if ((decl.effectifsFormesGspRows?.length ?? 0) > 0) return "effectifs_formes_gsp"
  if ((decl.formationsDomainesRows?.length ?? 0) > 0) return "formations_domaines"
  return "frais_personnel"
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
  const [activeTab, setActiveTab] = useState("frais_personnel")
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

  // Tab data (6 tableaux conservés)
  const [fraisPersonnelRows, setFraisPersonnelRows] = useState<FraisPersonnelRow[]>(DEFAULT_FRAIS_PERSONNEL_ROWS.map((row) => ({ ...row })))
  const [effectifGspRows, setEffectifGspRows] = useState<EffectifGspRow[]>(DEFAULT_EFFECTIF_GSP_ROWS.map((row) => ({ ...row })))
  const [absenteismeRows, setAbsenteismeRows] = useState<AbsenteismeRow[]>(DEFAULT_ABSENTEISME_ROWS.map((row) => ({ ...row })))
  const [mouvementEffectifsRows, setMouvementEffectifsRows] = useState<MouvementEffectifsRow[]>(DEFAULT_MOUVEMENT_EFFECTIFS_ROWS.map((row) => ({ ...row })))
  const [effectifsFormesGspRows, setEffectifsFormesGspRows] = useState<EffectifsFormesGspRow[]>(DEFAULT_EFFECTIFS_FORMES_GSP_ROWS.map((row) => ({ ...row })))
  const [formationsDomainesRows, setFormationsDomainesRows] = useState<FormationsDomainesRow[]>(DEFAULT_FORMATIONS_DOMAINES_ROWS.map((row) => ({ ...row })))
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
          description: "Votre profil n'est pas autorise a modifier ce tableau.",
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
      setFraisPersonnelRows(normalizeFraisPersonnelRows(declaration.fraisPersonnelRows))
      setEffectifGspRows(normalizeEffectifGspRows(declaration.effectifGspRows))
      setAbsenteismeRows(normalizeAbsenteismeRows(declaration.absenteismeRows))
      setMouvementEffectifsRows(normalizeMouvementEffectifsRows(declaration.mouvementEffectifsRows))
      setEffectifsFormesGspRows(normalizeEffectifsFormesGspRows(declaration.effectifsFormesGspRows))
      setFormationsDomainesRows(normalizeFormationsDomainesRows(declaration.formationsDomainesRows))
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
        description: "Votre profil n'est pas autorise a creer ou modifier ce tableau.",
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
      effectifsFormesGspRows: [],
      formationsDomainesRows: [],
    }
    
    switch (activeTab) {
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
      case "effectifs_formes_gsp":
        baseDecl.effectifsFormesGspRows = effectifsFormesGspRows
        break
      case "formations_domaines":
        baseDecl.formationsDomainesRows = formationsDomainesRows
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
        case "frais_personnel": tabData = { fraisPersonnelRows }; break
        case "effectif_gsp": tabData = { effectifGspRows }; break
        case "absenteisme": tabData = { absenteismeRows }; break
        case "mouvement_effectifs": tabData = { mouvementEffectifsRows }; break
        case "effectifs_formes_gsp": tabData = { effectifsFormesGspRows }; break
        case "formations_domaines": tabData = { formationsDomainesRows }; break
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
            ? "Votre role ne vous permet pas de creer des declarations."
            : "Votre role ne vous permet pas de gerer les tableaux."}
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
              {activeTab === "frais_personnel" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Frais Personnel (MDA)</CardTitle>
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
            </div>
          </div>
        </>
      )}
    </LayoutWrapper>
  )
}