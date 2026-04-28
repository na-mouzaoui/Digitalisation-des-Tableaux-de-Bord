"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

// ?? Frais Personnel ???????????????????????????????????????????????????????????
type FraisPersonnelRow = { designation: string; m: string; m1: string }
const FRAIS_PERSONNEL_LABELS = ["Objectif", "Realisation", "Taux d'atteinte", "Salaire Moyen"] as const
const DEFAULT_FRAIS_PERSONNEL_ROWS: FraisPersonnelRow[] = FRAIS_PERSONNEL_LABELS.map((designation) => ({ designation, m: "", m1: "" }))

// ?? Effectif GSP ??????????????????????????????????????????????????????????????
type EffectifGspRow = { gsp: string; m: string; m1: string; part: string }
const EFFECTIF_GSP_LABELS = ["Cadres Sup", "Cadres", "Maitrise", "Execution", "Total"] as const
const DEFAULT_EFFECTIF_GSP_ROWS: EffectifGspRow[] = EFFECTIF_GSP_LABELS.map((gsp) => ({ gsp, m: "", m1: "", part: "" }))

// ?? Absentéisme ???????????????????????????????????????????????????????????????
type AbsenteismeRow = { motif: string; m: string; m1: string; part: string }
const ABSENTEISME_LABELS = ["Irregulieres", "Cadre Disciplinaire", "Cadre Medical", "Autorisees", "TOTAL"] as const
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

// ?? Creances Contentieuses ????????????????????????????????????????????????????
type CreancesContentieusesRow = { designation: string; m: string; m1: string; evol: string }
const CREANCES_CONTENTIEUSES_LABELS = ["Objectif", "Montant recouvre", "Taux de recouvrement"] as const
const DEFAULT_CREANCES_CONTENTIEUSES_ROWS: CreancesContentieusesRow[] = CREANCES_CONTENTIEUSES_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Frequence des Sessions de Formation ??????????????????????????????????????
type FrequenceFormationRow = { mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const EMPTY_FREQUENCE_FORMATION_ROW: FrequenceFormationRow = { mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }

// ?? Effectifs Formés GSP ??????????????????????????????????????????????????????
type EffectifsFormesGspRow = { gsp: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const EFFECTIFS_FORMES_GSP_LABELS = ["Cadres & cadres Superieures", "Execution", "Maitrise", "Total Personnes Formees"] as const
const DEFAULT_EFFECTIFS_FORMES_GSP_ROWS: EffectifsFormesGspRow[] = EFFECTIFS_FORMES_GSP_LABELS.map((gsp) => ({ gsp, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))

// ?? Formations par Domaines ???????????????????????????????????????????????????
type FormationsDomainesRow = { domaine: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const FORMATIONS_DOMAINES_LABELS = ["Commercial", "Technique", "Management", "Divers (Langue Anglaise)", "Total Formations effectuees"] as const
const DEFAULT_FORMATIONS_DOMAINES_ROWS: FormationsDomainesRow[] = FORMATIONS_DOMAINES_LABELS.map((domaine) => ({ domaine, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))


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
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
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

// ?? 6e. Mouvement Effectifs par Domaine ???????????????????????????????????????
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

// ?? 6f. Creances Contentieuses ???????????????????????????????????????????????
interface TabCreancesContentieusesProps { rows: CreancesContentieusesRow[]; setRows: React.Dispatch<React.SetStateAction<CreancesContentieusesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabCreancesContentieuses({ rows, setRows, onSave, isSubmitting }: TabCreancesContentieusesProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Creances Contentieuses" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6e. Effectifs Formés GSP ?????????????????????????????????????????????????
interface TabEffectifsFormesGspProps { rows: EffectifsFormesGspRow[]; setRows: React.Dispatch<React.SetStateAction<EffectifsFormesGspRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabEffectifsFormesGsp({ rows, setRows, onSave, isSubmitting }: TabEffectifsFormesGspProps) {
  const update = (index: number, field: keyof EffectifsFormesGspRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Effectifs Formes par GSP" rows={rows as any} labelKey="gsp" update={(i, f, v) => update(i, f as keyof EffectifsFormesGspRow, v)} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6f. Formations par Domaines ??????????????????????????????????????????????
interface TabFormationsDomainesProps { rows: FormationsDomainesRow[]; setRows: React.Dispatch<React.SetStateAction<FormationsDomainesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabFormationsDomaines({ rows, setRows, onSave, isSubmitting }: TabFormationsDomainesProps) {
  const update = (index: number, field: keyof FormationsDomainesRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  return <OrtTable colHeader="Domaines" rows={rows as any} labelKey="domaine" update={(i, f, v) => update(i, f as keyof FormationsDomainesRow, v)} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6g. Frequence des Sessions de Formation ?????????????????????????????????
interface TabFrequenceFormationProps { row: FrequenceFormationRow; setRow: React.Dispatch<React.SetStateAction<FrequenceFormationRow>>; onSave: () => void; isSubmitting: boolean }
function TabFrequenceFormation({ row, setRow, onSave, isSubmitting }: TabFrequenceFormationProps) {
  const update = (field: keyof FrequenceFormationRow, value: string) =>
    setRow((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              {[["Objectif", 0], ["Realise", 1], ["Taux", 2]].map(([h, i]) => (
                <th key={i as number} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
              {[["Objectif", 3], ["Realise", 4], ["Taux", 5]].map(([h, i]) => (
                <th key={i as number} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              {(["m1Objectif", "m1Realise", "m1Taux", "mObjectif", "mRealise", "mTaux"] as const).map((field) => (
                <td key={field} className="px-1 py-1 border-b">
                  <AmountInput value={row[field]} onChange={(e) => update(field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
              ))}
            </tr>
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
  { key: "creance_contentieuses", label: "Creance contentieuses",    color: PRIMARY_COLOR, title: "CREANCE CONTENTIEUSES" },
  { key: "rh",                 label: "RH",                    color: PRIMARY_COLOR, title: "RH" },
  { key: "formation",           label: "Formation",              color: PRIMARY_COLOR, title: "FORMATION" },
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey =
  | "creance_contentieuses" | "rh" | "formation"

type tableauCategoryKey = "all"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all", label: "All", tabKeys: ["creance_contentieuses", "rh", "formation"] },
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
  creancesContentieusesRows?: CreancesContentieusesRow[]
  fraisPersonnelRows?: FraisPersonnelRow[]
  effectifGspRows?: EffectifGspRow[]
  absenteismeRows?: AbsenteismeRow[]
  mouvementEffectifsRows?: MouvementEffectifsRow[]
  formationRows?: { effectifsFormesGspRows?: EffectifsFormesGspRow[]; formationsDomainesRows?: FormationsDomainesRow[]; frequenceFormationRow?: FrequenceFormationRow }
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

const normalizeCreancesContentieusesRows = (rows?: CreancesContentieusesRow[]): CreancesContentieusesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return CREANCES_CONTENTIEUSES_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeEffectifsFormesGspRows = (rows?: EffectifsFormesGspRow[]): EffectifsFormesGspRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return EFFECTIFS_FORMES_GSP_LABELS.map((gsp, i) => ({ gsp, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeFormationsDomainesRows = (rows?: FormationsDomainesRow[]): FormationsDomainesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return FORMATIONS_DOMAINES_LABELS.map((domaine, i) => ({ domaine, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const normalizeFrequenceFormationRow = (row?: FrequenceFormationRow): FrequenceFormationRow => ({
  mObjectif: safeString(row?.mObjectif),
  mRealise: safeString(row?.mRealise),
  mTaux: safeString(row?.mTaux),
  m1Objectif: safeString(row?.m1Objectif),
  m1Realise: safeString(row?.m1Realise),
  m1Taux: safeString(row?.m1Taux),
})

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.fraisPersonnelRows?.length ?? 0) > 0) return "rh"
  if ((decl.effectifGspRows?.length ?? 0) > 0) return "rh"
  if ((decl.absenteismeRows?.length ?? 0) > 0) return "rh"
  if ((decl.mouvementEffectifsRows?.length ?? 0) > 0) return "rh"
  if ((decl.creancesContentieusesRows?.length ?? 0) > 0) return "creance_contentieuses"
  if (decl.formationRows) return "formation"
  return "rh"
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
  const [direction, setDirection] = useState("")
  const [mois, setMois] = useState(INITIAL_tableau_PERIOD.mois)
  const [annee, setAnnee] = useState(INITIAL_tableau_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [tableauPolicyRevision, settableauPolicyRevision] = useState(0)

  // Sub-tab for Formation
  const [activeFormationTab, setActiveFormationTab] = useState<"effectifs_formes_gsp" | "formations_domaines" | "frequence_formation">("effectifs_formes_gsp")
  
  // Sub-tab for RH
  const [activeRhTab, setActiveRhTab] = useState<"frais_personnel" | "effectif_gsp" | "absenteisme" | "mouvement_effectifs" | "mouvement_effectifs_domaine">("frais_personnel")

  // Tab data (6 tableaux conservés)
  const [fraisPersonnelRows, setFraisPersonnelRows] = useState<FraisPersonnelRow[]>(DEFAULT_FRAIS_PERSONNEL_ROWS.map((row) => ({ ...row })))
  const [effectifGspRows, setEffectifGspRows] = useState<EffectifGspRow[]>(DEFAULT_EFFECTIF_GSP_ROWS.map((row) => ({ ...row })))
  const [absenteismeRows, setAbsenteismeRows] = useState<AbsenteismeRow[]>(DEFAULT_ABSENTEISME_ROWS.map((row) => ({ ...row })))
  const [mouvementEffectifsRows, setMouvementEffectifsRows] = useState<MouvementEffectifsRow[]>(DEFAULT_MOUVEMENT_EFFECTIFS_ROWS.map((row) => ({ ...row })))
  const [mouvementEffectifsDomaineRows, setMouvementEffectifsDomaineRows] = useState<MouvementEffectifsDomaineRow[]>(DEFAULT_MOUVEMENT_EFFECTIFS_DOMAINE_ROWS.map((row) => ({ ...row })))
  const [creancesContentieusesRows, setCreancesContentieusesRows] = useState<CreancesContentieusesRow[]>(DEFAULT_CREANCES_CONTENTIEUSES_ROWS.map((row) => ({ ...row })))
  const [effectifsFormesGspRows, setEffectifsFormesGspRows] = useState<EffectifsFormesGspRow[]>(DEFAULT_EFFECTIFS_FORMES_GSP_ROWS.map((row) => ({ ...row })))
  const [formationsDomainesRows, setFormationsDomainesRows] = useState<FormationsDomainesRow[]>(DEFAULT_FORMATIONS_DOMAINES_ROWS.map((row) => ({ ...row })))
  const [frequenceFormationRow, setFrequenceFormationRow] = useState<FrequenceFormationRow>({ ...EMPTY_FREQUENCE_FORMATION_ROW })
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
          description: "Votre profil n'est pas autorise a modifier ce tableau.",
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
      setFraisPersonnelRows(normalizeFraisPersonnelRows(declaration.fraisPersonnelRows))
      setEffectifGspRows(normalizeEffectifGspRows(declaration.effectifGspRows))
      setAbsenteismeRows(normalizeAbsenteismeRows(declaration.absenteismeRows))
      setMouvementEffectifsRows(normalizeMouvementEffectifsRows(declaration.mouvementEffectifsRows))
      setMouvementEffectifsDomaineRows(normalizeMouvementEffectifsDomaineRows(declaration.mouvementEffectifsDomaineRows))
      setCreancesContentieusesRows(normalizeCreancesContentieusesRows(declaration.creancesContentieusesRows))
      setEffectifsFormesGspRows(normalizeEffectifsFormesGspRows(declaration.formationRows?.effectifsFormesGspRows))
      setFormationsDomainesRows(normalizeFormationsDomainesRows(declaration.formationRows?.formationsDomainesRows))
      setFrequenceFormationRow(normalizeFrequenceFormationRow(declaration.formationRows?.frequenceFormationRow))
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
      case "rh":
        if (activeRhTab === "frais_personnel" && fraisPersonnelRows.some((row) => !row.m || !row.m1)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Frais Personnel.", variant: "destructive" })
          validationError = true
        }
        if (activeRhTab === "effectif_gsp" && effectifGspRows.some((row) => !row.m || !row.m1 || !row.part)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Effectif par GSP.", variant: "destructive" })
          validationError = true
        }
        if (activeRhTab === "absenteisme" && absenteismeRows.some((row) => !row.m || !row.m1 || !row.part)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Absenteisme.", variant: "destructive" })
          validationError = true
        }
        if (activeRhTab === "mouvement_effectifs" && mouvementEffectifsRows.some((row) => !row.mCadresSup || !row.mCadres || !row.mMaitrise || !row.mExecution || !row.m1CadresSup || !row.m1Cadres || !row.m1Maitrise || !row.m1Execution)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Mouvement des Effectifs.", variant: "destructive" })
          validationError = true
        }
        if (activeRhTab === "mouvement_effectifs_domaine" && mouvementEffectifsDomaineRows.some((row) => !row.mCdi || !row.mCdd || !row.mCta || !row.m1Cdi || !row.m1Cdd || !row.m1Cta)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Mouvement des Effectifs par Domaine.", variant: "destructive" })
          validationError = true
        }
        break
      case "formation":
        if (activeFormationTab === "effectifs_formes_gsp" && effectifsFormesGspRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Effectifs formes par GSP.", variant: "destructive" })
          validationError = true
        }
        if (activeFormationTab === "formations_domaines" && formationsDomainesRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseignerr toutes les lignes du tableau Formations realisees par domaines.", variant: "destructive" })
          validationError = true
        }
        if (activeFormationTab === "frequence_formation" && (!frequenceFormationRow.mObjectif || !frequenceFormationRow.mRealise || !frequenceFormationRow.mTaux || !frequenceFormationRow.m1Objectif || !frequenceFormationRow.m1Realise || !frequenceFormationRow.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez raisonnerr toutes les valeurs du tableau Frequence de formation.", variant: "destructive" })
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
creancesContentieusesRows: [],
      formationRows: { effectifsFormesGspRows: [], formationsDomainesRows: [], frequenceFormationRow: { ...EMPTY_FREQUENCE_FORMATION_ROW } },
      mouvementEffectifsDomaineRows: [],
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
      case "creance_contentieuses":
        baseDecl.creancesContentieusesRows = creancesContentieusesRows
        break
      case "formation":
        baseDecl.formationRows = {
          effectifsFormesGspRows: effectifsFormesGspRows,
          formationsDomainesRows: formationsDomainesRows,
          frequenceFormationRow: frequenceFormationRow,
        }
        break
    }
    
    switch (activeTab) {
      case "rh":
        if (activeRhTab === "frais_personnel") baseDecl.fraisPersonnelRows = fraisPersonnelRows
        if (activeRhTab === "effectif_gsp") baseDecl.effectifGspRows = effectifGspRows
        if (activeRhTab === "absenteisme") baseDecl.absenteismeRows = absenteismeRows
        if (activeRhTab === "mouvement_effectifs") baseDecl.mouvementEffectifsRows = mouvementEffectifsRows
        if (activeRhTab === "mouvement_effectifs_domaine") baseDecl.mouvementEffectifsDomaineRows = mouvementEffectifsDomaineRows
        break
      case "creance_contentieuses":
        baseDecl.creancesContentieusesRows = creancesContentieusesRows
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
        case "rh":
          if (activeRhTab === "frais_personnel") tabData = { fraisPersonnelRows }
          if (activeRhTab === "effectif_gsp") tabData = { effectifGspRows }
          if (activeRhTab === "absenteisme") tabData = { absenteismeRows }
          if (activeRhTab === "mouvement_effectifs") tabData = { mouvementEffectifsRows }
          if (activeRhTab === "mouvement_effectifs_domaine") tabData = { mouvementEffectifsDomaineRows: mouvementEffectifsDomaineRows }
          break
        case "creance_contentieuses": tabData = { creancesContentieusesRows }; break
        case "formation": tabData = { formationRows: { effectifsFormesGspRows, formationsDomainesRows, frequenceFormationRow } }; break
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
            ? "Votre role ne vous permet pas de creer des declarations."
            : "Votre role ne vous permet pas de gerer les tableaux."}
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
                {TABS.map((tab) => (
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
                    {activeTab === "creance_contentieuses" ? (
                      <Select value="creance_contentieuses" onValueChange={() => {}} disabled>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Selectionner un tableau" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="creance_contentieuses">Creance contentieuses</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (activeTab === "formation" || activeTab === "rh") ? (
                      <Select value={activeTab === "formation" ? activeFormationTab : activeRhTab} onValueChange={(value) => {
                        if (activeTab === "formation") {
                          setActiveFormationTab(value as typeof activeFormationTab)
                        } else {
                          setActiveRhTab(value as typeof activeRhTab)
                        }
                      }}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Selectionner un tableau" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeTab === "formation" && (
                            <>
                              <SelectItem value="effectifs_formes_gsp">Effectifs formes par GSP</SelectItem>
                              <SelectItem value="formations_domaines">Formations realisees par domaines</SelectItem>
                              <SelectItem value="frequence_formation">Frequence de formation</SelectItem>
                            </>
                          )}
                          {activeTab === "rh" && (
                            <>
                              <SelectItem value="frais_personnel">Frais Personnel</SelectItem>
                              <SelectItem value="effectif_gsp">Effectif par GSP</SelectItem>
                              <SelectItem value="absenteisme">Absentéisme</SelectItem>
                              <SelectItem value="mouvement_effectifs">Mouvement des Effectifs</SelectItem>
                              <SelectItem value="mouvement_effectifs_domaine">Mouvement des Effectifs par Domaine</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
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
                    )}
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
              {activeTab === "rh" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>
                      {activeRhTab === "frais_personnel" && "Frais Personnel (MDA)"}
                      {activeRhTab === "effectif_gsp" && "Effectif par GSP"}
                      {activeRhTab === "absenteisme" && "Absentéisme"}
                      {activeRhTab === "mouvement_effectifs" && "Mouvement des Effectifs"}
                      {activeRhTab === "mouvement_effectifs_domaine" && "Mouvement des Effectifs par Domaine"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {activeRhTab === "frais_personnel" && (
                        <TabFraisPersonnel rows={fraisPersonnelRows} setRows={setFraisPersonnelRows} onSave={handleSave} isSubmitting={isSubmitting} />
                      )}
                      {activeRhTab === "effectif_gsp" && (
                        <TabEffectifGsp rows={effectifGspRows} setRows={setEffectifGspRows} onSave={handleSave} isSubmitting={isSubmitting} />
                      )}
                      {activeRhTab === "absenteisme" && (
                        <TabAbsenteisme rows={absenteismeRows} setRows={setAbsenteismeRows} onSave={handleSave} isSubmitting={isSubmitting} />
                      )}
                      {activeRhTab === "mouvement_effectifs" && (
                        <TabMouvementEffectifs rows={mouvementEffectifsRows} setRows={setMouvementEffectifsRows} onSave={handleSave} isSubmitting={isSubmitting} />
                      )}
                      {activeRhTab === "mouvement_effectifs_domaine" && (
                        <TabMouvementEffectifsDomaine rows={mouvementEffectifsDomaineRows} setRows={setMouvementEffectifsDomaineRows} onSave={handleSave} isSubmitting={isSubmitting} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              {activeTab === "creance_contentieuses" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Creance contentieuses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabCreancesContentieuses rows={creancesContentieusesRows} setRows={setCreancesContentieusesRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "formation" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>
                      {activeFormationTab === "effectifs_formes_gsp" && "Effectifs formes par GSP"}
                      {activeFormationTab === "formations_domaines" && "Formations realisees par domaines"}
                      {activeFormationTab === "frequence_formation" && "Frequence des Sessions de Formation"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {activeFormationTab === "effectifs_formes_gsp" && (
                        <TabEffectifsFormesGsp rows={effectifsFormesGspRows} setRows={setEffectifsFormesGspRows} onSave={handleSave} isSubmitting={isSubmitting} />
                      )}
                      {activeFormationTab === "formations_domaines" && (
                        <TabFormationsDomaines rows={formationsDomainesRows} setRows={setFormationsDomainesRows} onSave={handleSave} isSubmitting={isSubmitting} />
                      )}
                      {activeFormationTab === "frequence_formation" && (
                        <TabFrequenceFormation row={frequenceFormationRow} setRow={setFrequenceFormationRow} onSave={handleSave} isSubmitting={isSubmitting} />
                      )}
                    </div>
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