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

// ?? Réclamation ??????????????????????????????????????????????????????????????
type ReclamationRow = {
  category: "recues" | "traitees"
  type: "GP" | "B2B"
  mGp: string; mB2b: string; m1Gp: string; m1B2b: string
}
const DEFAULT_RECLAMATION_ROWS: ReclamationRow[] = [
  { category: "recues",   type: "GP",  mGp: "", mB2b: "", m1Gp: "", m1B2b: "" },
  { category: "recues",   type: "B2B", mGp: "", mB2b: "", m1Gp: "", m1B2b: "" },
  { category: "traitees", type: "GP",  mGp: "", mB2b: "", m1Gp: "", m1B2b: "" },
  { category: "traitees", type: "B2B", mGp: "", mB2b: "", m1Gp: "", m1B2b: "" },
]

// ?? Réclamation GP ???????????????????????????????????????????????????????????
type ReclamationGpRow = { label: string; recues: string; traitees: string }
const RECLAMATION_GP_LABELS = ["Appels", "Couverture", "Offres", "Data", "SMS", "Autres"] as const
const DEFAULT_RECLAMATION_GP_ROWS: ReclamationGpRow[] = RECLAMATION_GP_LABELS.map((label) => ({ label, recues: "", traitees: "" }))

// ?? E-Payement ???????????????????????????????????????????????????????????????
type EPayementRow = { rechargement: string; m: string; m1: string; evol: string }
const EPAYEMENT_CHANNELS = ["Baridimob", "webportail", "GAB-Alg Poste", "WINPAY (BNA)"] as const
const createDefaultEPayementRows = (): EPayementRow[] =>
  EPAYEMENT_CHANNELS.map((rechargement) => ({ rechargement, m: "", m1: "", evol: "" }))

// ?? Total Encaissement ???????????????????????????????????????????????????????
type TotalEncaissementRow = { mGp: string; mB2b: string; m1Gp: string; m1B2b: string; evol: string }
const EMPTY_TOTAL_ENCAISSEMENT_ROW: TotalEncaissementRow = { mGp: "", mB2b: "", m1Gp: "", m1B2b: "", evol: "-" }

// ?? Recouvrement ?????????????????????????????????????????????????????????????
type RecouvrementRow = { label: string; mGp: string; mB2b: string; m1Gp: string; m1B2b: string }
const RECOUVREMENT_LABELS = ["Montant Mis en Recouvrement", "Montant Recouvre", "Total"] as const
const DEFAULT_RECOUVREMENT_ROWS: RecouvrementRow[] = RECOUVREMENT_LABELS.map((label) => ({ label, mGp: "", mB2b: "", m1Gp: "", m1B2b: "" }))

// ?? Désactivation / Résiliation ???????????????????????????????????????????????
type DesactivationResiliationRow = { designation: string; m: string; m1: string; evol: string }
const DESACTIVATION_RESILIATION_LABELS = ["Postpaid GP", "Prepaid GP", "Postpaid B2B", "Prepaid B2B", "Total"] as const
const DEFAULT_DESACTIVATION_RESILIATION_ROWS: DesactivationResiliationRow[] = DESACTIVATION_RESILIATION_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Parc Abonnés B2B ??????????????????????????????????????????????????????????
type ParcAbonnesB2BRow = { designation: string; m: string; m1: string; evol: string }
const PARC_ABONNES_B2B_LABELS = ["Postpaid B2B", "Prepaid B2B", "TOTAL"] as const
const DEFAULT_PARC_ABONNES_B2B_ROWS: ParcAbonnesB2BRow[] = PARC_ABONNES_B2B_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Parc Abonnés GP ???????????????????????????????????????????????????????????
type ParcAbonnesGpRow = { designation: string; m: string; m1: string; evol: string }
const PARC_ABONNES_GP_LABELS = ["Postpaid GP", "Prepaid GP", "TOTAL"] as const
const DEFAULT_PARC_ABONNES_GP_ROWS: ParcAbonnesGpRow[] = PARC_ABONNES_GP_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Total Parc Abonnés ????????????????????????????????????????????????????????
type TotalParcAbonnesRow = { designation: string; m: string; m1: string; evol: string }
const TOTAL_PARC_ABONNES_LABELS = ["Parc Postpaid", "Parc Prepaid", "TOTAL"] as const
const DEFAULT_TOTAL_PARC_ABONNES_ROWS: TotalParcAbonnesRow[] = TOTAL_PARC_ABONNES_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Total Parc Abonnés par Technologie ???????????????????????????????????????
type TotalParcAbonnesTechnologieRow = { designation: string; m: string; m1: string; evol: string }
const TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS = ["2G", "3G", "4G", "TOTAL"] as const
const DEFAULT_TOTAL_PARC_ABONNES_TECHNOLOGIE_ROWS: TotalParcAbonnesTechnologieRow[] = TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Activation ????????????????????????????????????????????????????????????????
type ActivationRow = { designation: string; m: string; m1: string; evol: string }
const ACTIVATION_LABELS = ["Postpaid GP", "Prepaid GP", "Postpaid B2B", "Prepaid B2B", "Total"] as const
const DEFAULT_ACTIVATION_ROWS: ActivationRow[] = ACTIVATION_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Chiffre d'Affaires MDA ????????????????????????????????????????????????????
type ChiffreAffairesMdaRow = { designation: string; mObjectif: string; mRealise: string; mTaux: string; m1Objectif: string; m1Realise: string; m1Taux: string }
const CHIFFRE_AFFAIRES_MDA_LABELS = ["Grand Public", "B2B", "Interco & Roaming"] as const
const DEFAULT_CHIFFRE_AFFAIRES_MDA_ROWS: ChiffreAffairesMdaRow[] = CHIFFRE_AFFAIRES_MDA_LABELS.map((designation) => ({ designation, mObjectif: "", mRealise: "", mTaux: "", m1Objectif: "", m1Realise: "", m1Taux: "" }))


// ?????????????????????????????????????????????????????????????????????????????
// 6. COMPOSANTS DE TABLEAUX
//    Pattern commun : update(index, field, value) + AmountInput + bouton Save
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

// ?? 6a. Réclamation ???????????????????????????????????????????????????????????
interface TabReclamationProps {
  rows: ReclamationRow[]
  setRows: React.Dispatch<React.SetStateAction<ReclamationRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabReclamation({ rows, setRows, onSave, isSubmitting }: TabReclamationProps) {
  const update = (index: number, field: keyof Pick<ReclamationRow, "mGp" | "mB2b" | "m1Gp" | "m1B2b">, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  const recuesRows   = rows.filter((r) => r.category === "recues")
  const traiteesRows = rows.filter((r) => r.category === "traitees")
  const recuesTotals   = { mGp: recuesRows.reduce((s, r) => s + num(r.mGp), 0),   mB2b: recuesRows.reduce((s, r) => s + num(r.mB2b), 0),   m1Gp: recuesRows.reduce((s, r) => s + num(r.m1Gp), 0),   m1B2b: recuesRows.reduce((s, r) => s + num(r.m1B2b), 0) }
  const traiteesTotals = { mGp: traiteesRows.reduce((s, r) => s + num(r.mGp), 0), mB2b: traiteesRows.reduce((s, r) => s + num(r.mB2b), 0), m1Gp: traiteesRows.reduce((s, r) => s + num(r.m1Gp), 0), m1B2b: traiteesRows.reduce((s, r) => s + num(r.m1B2b), 0) }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Reclamations</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Type</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M-1 GP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M-1 B2B</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M GP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M B2B</th>
             </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.category}-${row.type}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {index % 2 === 0 && (
                  <td rowSpan={2} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle">
                    {row.category === "recues" ? "Recues" : "Traitees"}
                   </td>
                )}
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-700">{row.type}</td>
                <td className="px-2 py-1 border-b"><AmountInput value={row.mGp}   onChange={(e) => update(index, "mGp",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-2 py-1 border-b"><AmountInput value={row.mB2b}  onChange={(e) => update(index, "mB2b",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-2 py-1 border-b"><AmountInput value={row.m1Gp}  onChange={(e) => update(index, "m1Gp",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-2 py-1 border-b"><AmountInput value={row.m1B2b} onChange={(e) => update(index, "m1B2b", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-xs text-right border-t">Taux de traitement (%)</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(traiteesTotals.mGp,   recuesTotals.mGp))}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(traiteesTotals.mB2b,  recuesTotals.mB2b))}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(traiteesTotals.m1Gp,  recuesTotals.m1Gp))}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(traiteesTotals.m1B2b, recuesTotals.m1B2b))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? 6b. Réclamation GP ????????????????????????????????????????????????????????
interface TabReclamationGpProps {
  rows: ReclamationGpRow[]
  setRows: React.Dispatch<React.SetStateAction<ReclamationGpRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabReclamationGp({ rows, setRows, onSave, isSubmitting }: TabReclamationGpProps) {
  const update = (index: number, field: "recues" | "traitees", value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  const totalRecues   = rows.reduce((s, r) => s + num(r.recues),   0)
  const totalTraitees = rows.reduce((s, r) => s + num(r.traitees), 0)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Type de Reclamation GP</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b" colSpan={2}>M</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b">Taux (%)</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b">Part (%)</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b"></th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Recues</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Traitees</th>
              <th className="px-3 py-2 border-b"></th>
              <th className="px-3 py-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const recues = num(row.recues), traitees = num(row.traitees)
              return (
                <tr key={`${row.label}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                  <td className="px-2 py-1 border-b"><AmountInput value={row.recues}   onChange={(e) => update(index, "recues",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-2 py-1 border-b"><AmountInput value={row.traitees} onChange={(e) => update(index, "traitees", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                  <td className="px-3 py-2 border-b text-xs text-right font-semibold text-gray-700">{fmt(toPercent(traitees, recues))}</td>
                  <td className="px-3 py-2 border-b text-xs text-right font-semibold text-gray-700">{fmt(toPercent(recues, totalRecues))}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 text-xs text-right border-t">Total</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(totalRecues)}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(totalTraitees)}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{fmt(toPercent(totalTraitees, totalRecues))}</td>
              <td className="px-3 py-2 text-xs border-t text-right">{totalRecues > 0 ? "100,00" : ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? 6c. E-Payement (bloc réutilisable + wrapper) ??????????????????????????????
interface EPayementBlockProps {
  title: string
  rows: EPayementRow[]
  setRows: React.Dispatch<React.SetStateAction<EPayementRow[]>>
}
function EPayementBlock({ title, rows, setRows }: EPayementBlockProps) {
  const update = (index: number, field: "m" | "m1" | "evol", value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Rechargement</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M-1</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">M</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Evol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{EPAYEMENT_CHANNELS[index] ?? row.rechargement}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m}    onChange={(e) => update(index, "m",    e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 130 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1}   onChange={(e) => update(index, "m1",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 130 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.evol} onChange={(e) => update(index, "evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 130 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface TabEPayementSingleProps {
  title: string
  rows: EPayementRow[]
  setRows: React.Dispatch<React.SetStateAction<EPayementRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabEPayementSingle({ title, rows, setRows, onSave, isSubmitting }: TabEPayementSingleProps) {
  return (
    <div className="space-y-4">
      <EPayementBlock title={title} rows={rows} setRows={setRows} />
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? 6d. Total Encaissement ????????????????????????????????????????????????????
interface TabTotalEncaissementProps {
  row: TotalEncaissementRow
  setRow: React.Dispatch<React.SetStateAction<TotalEncaissementRow>>
  onSave: () => void
  isSubmitting: boolean
}
function TabTotalEncaissement({ row, setRow, onSave, isSubmitting }: TabTotalEncaissementProps) {
  const update = (field: keyof TotalEncaissementRow, value: string) =>
    setRow((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={3} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Encaissement (MDA)</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th rowSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Evol</th>
            </tr>
            <tr className="bg-gray-50">
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-medium text-gray-600 border-b border-r">Sous-colonnes</th>
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-medium text-gray-600 border-b border-r">Sous-colonnes</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">B2B</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">B2B</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">Encaissements</td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.mGp}   onChange={(e) => update("mGp",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.mB2b}  onChange={(e) => update("mB2b",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.m1Gp}  onChange={(e) => update("m1Gp",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.m1B2b} onChange={(e) => update("m1B2b", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><Input value={row.evol} onChange={(e) => update("evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="-" /></td>
            </tr>
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 border-b text-xs">Total</td>
              <td className="px-3 py-2 border-b text-xs text-right [direction:rtl]">{fmt(row.mGp   || "0")}</td>
              <td className="px-3 py-2 border-b text-xs text-right [direction:rtl]">{fmt(row.mB2b  || "0")}</td>
              <td className="px-3 py-2 border-b text-xs text-right [direction:rtl]">{fmt(row.m1Gp  || "0")}</td>
              <td className="px-3 py-2 border-b text-xs text-right [direction:rtl]">{fmt(row.m1B2b || "0")}</td>
              <td className="px-3 py-2 border-b text-xs text-center">{row.evol || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? 6e. Recouvrement ?????????????????????????????????????????????????????????
interface TabRecouvrementProps { rows: RecouvrementRow[]; setRows: React.Dispatch<React.SetStateAction<RecouvrementRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabRecouvrement({ rows, setRows, onSave, isSubmitting }: TabRecouvrementProps) {
  const update = (index: number, field: keyof Pick<RecouvrementRow, "mGp" | "mB2b" | "m1Gp" | "m1B2b">, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={3} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Recouvrement (MDA)</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-medium text-gray-600 border-b border-r">Sous-colonnes</th>
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-medium text-gray-600 border-b">Sous-colonnes</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">B2B</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">B2B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.label}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mGp}   onChange={(e) => update(index, "mGp",   e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mB2b}  onChange={(e) => update(index, "mB2b",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Gp}  onChange={(e) => update(index, "m1Gp",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1B2b} onChange={(e) => update(index, "m1B2b", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
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

// ?? 6f. Parc Abonnés B2B ?????????????????????????????????????????????????????
interface TabParcAbonnesB2BProps { rows: ParcAbonnesB2BRow[]; setRows: React.Dispatch<React.SetStateAction<ParcAbonnesB2BRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabParcAbonnesB2B({ rows, setRows, onSave, isSubmitting }: TabParcAbonnesB2BProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Parc Abonnes B2B" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6g. Parc Abonnés GP ??????????????????????????????????????????????????????
interface TabParcAbonnesGpProps { rows: ParcAbonnesGpRow[]; setRows: React.Dispatch<React.SetStateAction<ParcAbonnesGpRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabParcAbonnesGp({ rows, setRows, onSave, isSubmitting }: TabParcAbonnesGpProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Parc Abonnes GP" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6h. Total Parc Abonnés ????????????????????????????????????????????????????
interface TabTotalParcAbonnesProps { rows: TotalParcAbonnesRow[]; setRows: React.Dispatch<React.SetStateAction<TotalParcAbonnesRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabTotalParcAbonnes({ rows, setRows, onSave, isSubmitting }: TabTotalParcAbonnesProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Total Parc Abonnes" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6i. Total Parc Abonnés par Technologie ???????????????????????????????????
interface TabTotalParcAbonnesTechnologieProps { rows: TotalParcAbonnesTechnologieRow[]; setRows: React.Dispatch<React.SetStateAction<TotalParcAbonnesTechnologieRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabTotalParcAbonnesTechnologie({ rows, setRows, onSave, isSubmitting }: TabTotalParcAbonnesTechnologieProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Total Parc Abonnes par Technologie" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6j. Activation ???????????????????????????????????????????????????????????
interface TabActivationProps { rows: ActivationRow[]; setRows: React.Dispatch<React.SetStateAction<ActivationRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabActivation({ rows, setRows, onSave, isSubmitting }: TabActivationProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Activation" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6k. Désactivation / Résiliation ??????????????????????????????????????????
interface TabDesactivationResiliationProps { rows: DesactivationResiliationRow[]; setRows: React.Dispatch<React.SetStateAction<DesactivationResiliationRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabDesactivationResiliation({ rows, setRows, onSave, isSubmitting }: TabDesactivationResiliationProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Desactivation / Resiliation" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6l. Chiffre d'Affaires MDA ????????????????????????????????????????????????
interface TabChiffreAffairesMdaProps { rows: ChiffreAffairesMdaRow[]; setRows: React.Dispatch<React.SetStateAction<ChiffreAffairesMdaRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabChiffreAffairesMda({ rows, setRows, onSave, isSubmitting }: TabChiffreAffairesMdaProps) {
  const update = (index: number, field: keyof ChiffreAffairesMdaRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Chiffre d'Affaires (MDA)</th>
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
              <tr key={row.designation} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mObjectif} onChange={(e) => update(index, "mObjectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRealise}  onChange={(e) => update(index, "mRealise",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux}     onChange={(e) => update(index, "mTaux",     e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Objectif} onChange={(e) => update(index, "m1Objectif", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Realise}  onChange={(e) => update(index, "m1Realise",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Taux}     onChange={(e) => update(index, "m1Taux",     e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
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
  { key: "reclamation",                    label: "Reclamation",                           color: PRIMARY_COLOR, title: "TABLEAU RECLAMATION" },
  { key: "reclamation_gp",                 label: "Reclamation GP",                        color: PRIMARY_COLOR, title: "TABLEAU RECLAMATION GP" },
  { key: "e_payement_pop",                 label: "E-PAYEMENT Pop",                        color: PRIMARY_COLOR, title: "E-PAYEMENT POP (MDA)" },
  { key: "e_payement_prp",                 label: "E-PAYEMENT Prp",                        color: PRIMARY_COLOR, title: "E-PAYEMENT PRP (MDA)" },
  { key: "total_encaissement",             label: "Totale des encaissements",                color: PRIMARY_COLOR, title: "TOTALE DES ENCAISSEMENTS" },
  { key: "recouvrement",                   label: "Recouvrement",                          color: PRIMARY_COLOR, title: "RECOUVREMENT (MDA)" },
  { key: "desactivation_resiliation",      label: "Desactivation / Resiliation",           color: PRIMARY_COLOR, title: "DESACTIVATION / RESILIATION" },
  { key: "parc_abonnes_b2b",               label: "Parc Abonnes B2B",                      color: PRIMARY_COLOR, title: "PARC ABONNES B2B" },
  { key: "parc_abonnes_gp",                label: "Parc Abonnes GP",                       color: PRIMARY_COLOR, title: "PARC ABONNES GP" },
  { key: "total_parc_abonnes",             label: "Total Parc Abonnes",                    color: PRIMARY_COLOR, title: "TOTAL PARC ABONNES" },
  { key: "total_parc_abonnes_technologie", label: "Total Parc Abonnes par technologie",    color: PRIMARY_COLOR, title: "TOTAL PARC ABONNES PAR TECHNOLOGIE" },
  { key: "activation",                     label: "Activation",                            color: PRIMARY_COLOR, title: "ACTIVATION" },
  { key: "chiffre_affaires_mda",           label: "Chiffre d'Affaires (MDA)",              color: PRIMARY_COLOR, title: "CHIFFRE D'AFFAIRES (MDA)" },
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey =
  | "reclamation" | "reclamation_gp" | "e_payement_pop" | "e_payement_prp"
  | "total_encaissement" | "recouvrement"
  | "desactivation_resiliation"
  | "parc_abonnes_b2b" | "parc_abonnes_gp" | "total_parc_abonnes" | "total_parc_abonnes_technologie"
  | "activation" | "chiffre_affaires_mda"

type tableauCategoryKey =
  | "all" | "reclamation" | "e_payment" | "encaissement" | "recouvrement"
  | "parc_abonnes" | "activation_desactivation_sim" | "chiffre_affaires"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all",           label: "Toutes les categories",          tabKeys: [] },
  { key: "reclamation",   label: "Reclamation",                    tabKeys: ["reclamation", "reclamation_gp"] },
  { key: "e_payment",     label: "E-payment",                      tabKeys: ["e_payement_pop", "e_payement_prp"] },
  { key: "encaissement",  label: "Encaissement",                   tabKeys: ["total_encaissement"] },
  { key: "recouvrement",  label: "Recouvrement",                   tabKeys: ["recouvrement"] },
  { key: "parc_abonnes",  label: "Parc abonne",                    tabKeys: ["parc_abonnes_b2b", "parc_abonnes_gp", "total_parc_abonnes", "total_parc_abonnes_technologie"] },
  { key: "activation_desactivation_sim", label: "Activation / Desactivation SIM", tabKeys: ["desactivation_resiliation", "activation"] },
  { key: "chiffre_affaires", label: "Chiffre d'affaires",          tabKeys: ["chiffre_affaires_mda"] },
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


// ?????????????????????????????????????????????????????????????????????????????
// 8. TYPES & HELPERS D'API / STOCKAGE
// ?????????????????????????????????????????????????????????????????????????????

// ?? 8a. Type de la déclaration sauvegardée (localStorage + API) ??????????????
//    Tableaux conservés uniquement
interface Savedtableau {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  reclamationRows?: ReclamationRow[]
  reclamationGpRows?: ReclamationGpRow[]
  ePayementPopRows?: EPayementRow[]
  ePayementPrpRows?: EPayementRow[]
  totalEncaissementRows?: TotalEncaissementRow[]
  recouvrementRows?: RecouvrementRow[]
  desactivationResiliationRows?: DesactivationResiliationRow[]
  parcAbonnesB2bRows?: ParcAbonnesB2BRow[]
  parcAbonnesGpRows?: ParcAbonnesGpRow[]
  totalParcAbonnesRows?: TotalParcAbonnesRow[]
  totalParcAbonnesTechnologieRows?: TotalParcAbonnesTechnologieRow[]
  activationRows?: ActivationRow[]
  chiffreAffairesMdaRows?: ChiffreAffairesMdaRow[]
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

// ?? 8d. Fonctions de normalisation par tableau (tableaux conservés) ??????????

const normalizeReclamationRows = (rows?: ReclamationRow[]): ReclamationRow[] => {
  const normalizeCategory = (v: unknown): ReclamationRow["category"] => safeString(v).toLowerCase() === "traitees" ? "traitees" : "recues"
  const normalizeType = (v: unknown): ReclamationRow["type"] => safeString(v).toUpperCase() === "B2B" ? "B2B" : "GP"
  const normalized = (rows ?? []).map((row) => ({
    category: normalizeCategory(row.category),
    type: normalizeType(row.type),
    mGp: safeString(row.mGp), mB2b: safeString(row.mB2b),
    m1Gp: safeString(row.m1Gp), m1B2b: safeString(row.m1B2b),
  }))
  return normalized.length === 4 ? normalized : DEFAULT_RECLAMATION_ROWS.map((r) => ({ ...r }))
}

const normalizeReclamationGpRows = (rows?: ReclamationGpRow[]): ReclamationGpRow[] => {
  const normalized = (rows ?? []).map((row, i) => ({ label: safeString(row.label) || RECLAMATION_GP_LABELS[i] || `Ligne ${i + 1}`, recues: safeString(row.recues), traitees: safeString(row.traitees) }))
  return normalized.length === RECLAMATION_GP_LABELS.length ? normalized : DEFAULT_RECLAMATION_GP_ROWS.map((r) => ({ ...r }))
}

const normalizeEPayementRows = (rows?: EPayementRow[]): EPayementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return EPAYEMENT_CHANNELS.map((rechargement, i) => ({ rechargement, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeTotalEncaissementRow = (row?: TotalEncaissementRow): TotalEncaissementRow => ({
  mGp: safeString(row?.mGp), mB2b: safeString(row?.mB2b),
  m1Gp: safeString(row?.m1Gp), m1B2b: safeString(row?.m1B2b),
  evol: safeString(row?.evol) || "-",
})

const normalizeTotalEncaissementRows = (rows?: TotalEncaissementRow[]): TotalEncaissementRow[] => {
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined
  return [normalizeTotalEncaissementRow(firstRow)]
}

const normalizeRecouvrementRows = (rows?: RecouvrementRow[]): RecouvrementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return RECOUVREMENT_LABELS.map((label, i) => ({ label, mGp: safeString(src[i]?.mGp), mB2b: safeString(src[i]?.mB2b), m1Gp: safeString(src[i]?.m1Gp), m1B2b: safeString(src[i]?.m1B2b) }))
}

const normalizeDesactivationResiliationRows = (rows?: DesactivationResiliationRow[]): DesactivationResiliationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DESACTIVATION_RESILIATION_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeParcAbonnesB2BRows = (rows?: ParcAbonnesB2BRow[]): ParcAbonnesB2BRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return PARC_ABONNES_B2B_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeParcAbonnesGpRows = (rows?: ParcAbonnesGpRow[]): ParcAbonnesGpRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return PARC_ABONNES_GP_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeTotalParcAbonnesRows = (rows?: TotalParcAbonnesRow[]): TotalParcAbonnesRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return TOTAL_PARC_ABONNES_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeTotalParcAbonnesTechnologieRows = (rows?: TotalParcAbonnesTechnologieRow[]): TotalParcAbonnesTechnologieRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeActivationRows = (rows?: ActivationRow[]): ActivationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return ACTIVATION_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeChiffreAffairesMdaRows = (rows?: ChiffreAffairesMdaRow[]): ChiffreAffairesMdaRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return CHIFFRE_AFFAIRES_MDA_LABELS.map((designation, i) => ({ designation, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Objectif: safeString(src[i]?.m1Objectif), m1Realise: safeString(src[i]?.m1Realise), m1Taux: safeString(src[i]?.m1Taux) }))
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.reclamationRows?.length ?? 0) > 0) return "reclamation"
  if ((decl.reclamationGpRows?.length ?? 0) > 0) return "reclamation_gp"
  if ((decl.ePayementPopRows?.length ?? 0) > 0) return "e_payement_pop"
  if ((decl.ePayementPrpRows?.length ?? 0) > 0) return "e_payement_prp"
  if ((decl.totalEncaissementRows?.length ?? 0) > 0) return "total_encaissement"
  if ((decl.recouvrementRows?.length ?? 0) > 0) return "recouvrement"
  if ((decl.desactivationResiliationRows?.length ?? 0) > 0) return "desactivation_resiliation"
  if ((decl.parcAbonnesB2bRows?.length ?? 0) > 0) return "parc_abonnes_b2b"
  if ((decl.parcAbonnesGpRows?.length ?? 0) > 0) return "parc_abonnes_gp"
  if ((decl.totalParcAbonnesRows?.length ?? 0) > 0) return "total_parc_abonnes"
  if ((decl.totalParcAbonnesTechnologieRows?.length ?? 0) > 0) return "total_parc_abonnes_technologie"
  if ((decl.activationRows?.length ?? 0) > 0) return "activation"
  if ((decl.chiffreAffairesMdaRows?.length ?? 0) > 0) return "chiffre_affaires_mda"
  return "reclamation"
}


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
  const [activeTab, setActiveTab] = useState("reclamation")
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

  // Tab data (lifted) - TABLEAUX CONSERVéS
  const [reclamationRows, setReclamationRows] = useState<ReclamationRow[]>(DEFAULT_RECLAMATION_ROWS.map((row) => ({ ...row })))
  const [reclamationGpRows, setReclamationGpRows] = useState<ReclamationGpRow[]>(DEFAULT_RECLAMATION_GP_ROWS.map((row) => ({ ...row })))
  const [ePayementPopRows, setEPayementPopRows] = useState<EPayementRow[]>(createDefaultEPayementRows())
  const [ePayementPrpRows, setEPayementPrpRows] = useState<EPayementRow[]>(createDefaultEPayementRows())
  const [totalEncaissementRows, setTotalEncaissementRows] = useState<TotalEncaissementRow[]>([{ ...EMPTY_TOTAL_ENCAISSEMENT_ROW }])
  const [recouvrementRows, setRecouvrementRows] = useState<RecouvrementRow[]>(DEFAULT_RECOUVREMENT_ROWS.map((row) => ({ ...row })))
  const [desactivationResiliationRows, setDesactivationResiliationRows] = useState<DesactivationResiliationRow[]>(DEFAULT_DESACTIVATION_RESILIATION_ROWS.map((row) => ({ ...row })))
  const [parcAbonnesB2bRows, setParcAbonnesB2bRows] = useState<ParcAbonnesB2BRow[]>(DEFAULT_PARC_ABONNES_B2B_ROWS.map((row) => ({ ...row })))
  const [parcAbonnesGpRows, setParcAbonnesGpRows] = useState<ParcAbonnesGpRow[]>(DEFAULT_PARC_ABONNES_GP_ROWS.map((row) => ({ ...row })))
  const [totalParcAbonnesRows, setTotalParcAbonnesRows] = useState<TotalParcAbonnesRow[]>(DEFAULT_TOTAL_PARC_ABONNES_ROWS.map((row) => ({ ...row })))
  const [totalParcAbonnesTechnologieRows, setTotalParcAbonnesTechnologieRows] = useState<TotalParcAbonnesTechnologieRow[]>(DEFAULT_TOTAL_PARC_ABONNES_TECHNOLOGIE_ROWS.map((row) => ({ ...row })))
  const [activationRows, setActivationRows] = useState<ActivationRow[]>(DEFAULT_ACTIVATION_ROWS.map((row) => ({ ...row })))
  const [chiffreAffairesMdaRows, setChiffreAffairesMdaRows] = useState<ChiffreAffairesMdaRow[]>(DEFAULT_CHIFFRE_AFFAIRES_MDA_ROWS.map((row) => ({ ...row })))
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
      setReclamationRows(normalizeReclamationRows(declaration.reclamationRows))
      setReclamationGpRows(normalizeReclamationGpRows(declaration.reclamationGpRows))
      setEPayementPopRows(normalizeEPayementRows(declaration.ePayementPopRows))
      setEPayementPrpRows(normalizeEPayementRows(declaration.ePayementPrpRows))
      setTotalEncaissementRows(normalizeTotalEncaissementRows(declaration.totalEncaissementRows))
      setRecouvrementRows(normalizeRecouvrementRows(declaration.recouvrementRows))
      setDesactivationResiliationRows(normalizeDesactivationResiliationRows(declaration.desactivationResiliationRows))
      setParcAbonnesB2bRows(normalizeParcAbonnesB2BRows(declaration.parcAbonnesB2bRows))
      setParcAbonnesGpRows(normalizeParcAbonnesGpRows(declaration.parcAbonnesGpRows))
      setTotalParcAbonnesRows(normalizeTotalParcAbonnesRows(declaration.totalParcAbonnesRows))
      setTotalParcAbonnesTechnologieRows(normalizeTotalParcAbonnesTechnologieRows(declaration.totalParcAbonnesTechnologieRows))
      setActivationRows(normalizeActivationRows(declaration.activationRows))
      setChiffreAffairesMdaRows(normalizeChiffreAffairesMdaRows(declaration.chiffreAffairesMdaRows))
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

    // Validation des champs pour les tableaux conservés
    let validationError = false
    switch (activeTab) {
      case "reclamation":
        if (reclamationRows.some((r) => !r.mGp && !r.mB2b && !r.m1Gp && !r.m1B2b)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Reclamation.", variant: "destructive" })
          validationError = true
        }
        break
      case "reclamation_gp":
        if (reclamationGpRows.some((r) => !r.recues || !r.traitees)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Reclamation GP.", variant: "destructive" })
          validationError = true
        }
        break
      case "e_payement_pop":
        if (ePayementPopRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau E-PAYEMENT Pop.", variant: "destructive" })
          validationError = true
        }
        break
      case "e_payement_prp":
        if (ePayementPrpRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau E-PAYEMENT Prp.", variant: "destructive" })
          validationError = true
        }
        break
      case "total_encaissement":
        if (totalEncaissementRows.some((row) => !row.mGp || !row.mB2b || !row.m1Gp || !row.m1B2b || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les valeurs du tableau Totale des encaissements.", variant: "destructive" })
          validationError = true
        }
        break
      case "recouvrement":
        if (recouvrementRows.some((row) => !row.mGp || !row.mB2b || !row.m1Gp || !row.m1B2b)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Recouvrement.", variant: "destructive" })
          validationError = true
        }
        break
      case "desactivation_resiliation":
        if (desactivationResiliationRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Desactivation / Resiliation.", variant: "destructive" })
          validationError = true
        }
        break
      case "parc_abonnes_b2b":
        if (parcAbonnesB2bRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Parc Abonnes B2B.", variant: "destructive" })
          validationError = true
        }
        break
      case "parc_abonnes_gp":
        if (parcAbonnesGpRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Parc Abonnes GP.", variant: "destructive" })
          validationError = true
        }
        break
      case "total_parc_abonnes":
        if (totalParcAbonnesRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Total Parc Abonnes.", variant: "destructive" })
          validationError = true
        }
        break
      case "total_parc_abonnes_technologie":
        if (totalParcAbonnesTechnologieRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Total Parc Abonnes parc technologie.", variant: "destructive" })
          validationError = true
        }
        break
      case "activation":
        if (activationRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Activation.", variant: "destructive" })
          validationError = true
        }
        break
      case "chiffre_affaires_mda":
        if (chiffreAffairesMdaRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Objectif || !row.m1Realise || !row.m1Taux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Chiffre d'Affaires (MDA).", variant: "destructive" })
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
      reclamationRows: [],
      reclamationGpRows: [],
      ePayementPopRows: [],
      ePayementPrpRows: [],
      totalEncaissementRows: [],
      recouvrementRows: [],
      desactivationResiliationRows: [],
      parcAbonnesB2bRows: [],
      parcAbonnesGpRows: [],
      totalParcAbonnesRows: [],
      totalParcAbonnesTechnologieRows: [],
      activationRows: [],
      chiffreAffairesMdaRows: [],
    }
    
    switch (activeTab) {
      case "reclamation":
        baseDecl.reclamationRows = reclamationRows
        break
      case "reclamation_gp":
        baseDecl.reclamationGpRows = reclamationGpRows
        break
      case "e_payement_pop":
        baseDecl.ePayementPopRows = ePayementPopRows
        break
      case "e_payement_prp":
        baseDecl.ePayementPrpRows = ePayementPrpRows
        break
      case "total_encaissement":
        baseDecl.totalEncaissementRows = totalEncaissementRows
        break
      case "recouvrement":
        baseDecl.recouvrementRows = recouvrementRows
        break
      case "desactivation_resiliation":
        baseDecl.desactivationResiliationRows = desactivationResiliationRows
        break
      case "parc_abonnes_b2b":
        baseDecl.parcAbonnesB2bRows = parcAbonnesB2bRows
        break
      case "parc_abonnes_gp":
        baseDecl.parcAbonnesGpRows = parcAbonnesGpRows
        break
      case "total_parc_abonnes":
        baseDecl.totalParcAbonnesRows = totalParcAbonnesRows
        break
      case "total_parc_abonnes_technologie":
        baseDecl.totalParcAbonnesTechnologieRows = totalParcAbonnesTechnologieRows
        break
      case "activation":
        baseDecl.activationRows = activationRows
        break
      case "chiffre_affaires_mda":
        baseDecl.chiffreAffairesMdaRows = chiffreAffairesMdaRows
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
        case "reclamation": tabData = { reclamationRows }; break
        case "reclamation_gp": tabData = { reclamationGpRows }; break
        case "e_payement_pop": tabData = { ePayementPopRows }; break
        case "e_payement_prp": tabData = { ePayementPrpRows }; break
        case "total_encaissement": tabData = { totalEncaissementRows }; break
        case "recouvrement": tabData = { recouvrementRows }; break
        case "desactivation_resiliation": tabData = { desactivationResiliationRows }; break
        case "parc_abonnes_b2b": tabData = { parcAbonnesB2bRows }; break
        case "parc_abonnes_gp": tabData = { parcAbonnesGpRows }; break
        case "total_parc_abonnes": tabData = { totalParcAbonnesRows }; break
        case "total_parc_abonnes_technologie": tabData = { totalParcAbonnesTechnologieRows }; break
        case "activation": tabData = { activationRows }; break
        case "chiffre_affaires_mda": tabData = { chiffreAffairesMdaRows }; break
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
              {activeTab === "reclamation" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Tableau Reclamation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabReclamation rows={reclamationRows} setRows={setReclamationRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "reclamation_gp" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Tableau Reclamation GP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabReclamationGp rows={reclamationGpRows} setRows={setReclamationGpRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "e_payement_pop" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>E-PAYEMENT Pop (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabEPayementSingle
                      title="E-PAYEMENT Pop (MDA)"
                      rows={ePayementPopRows}
                      setRows={setEPayementPopRows}
                      onSave={handleSave}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}
              {activeTab === "e_payement_prp" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>E-PAYEMENT Prp (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabEPayementSingle
                      title="E-PAYEMENT Prp (MDA)"
                      rows={ePayementPrpRows}
                      setRows={setEPayementPrpRows}
                      onSave={handleSave}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}
              {activeTab === "total_encaissement" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Totale des encaissements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabTotalEncaissement
                      row={totalEncaissementRows[0] ?? EMPTY_TOTAL_ENCAISSEMENT_ROW}
                      setRow={(updater) => {
                        if (typeof updater === "function") {
                          setTotalEncaissementRows((prev) => [
                            (updater as (value: TotalEncaissementRow) => TotalEncaissementRow)(prev[0] ?? EMPTY_TOTAL_ENCAISSEMENT_ROW),
                          ])
                        } else {
                          setTotalEncaissementRows([updater])
                        }
                      }}
                      onSave={handleSave}
                      isSubmitting={isSubmitting}
                    />
                  </CardContent>
                </Card>
              )}
              {activeTab === "recouvrement" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Recouvrement (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabRecouvrement rows={recouvrementRows} setRows={setRecouvrementRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "desactivation_resiliation" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Desactivation / Resiliation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabDesactivationResiliation rows={desactivationResiliationRows} setRows={setDesactivationResiliationRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "parc_abonnes_b2b" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Parc Abonnes B2B</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabParcAbonnesB2B rows={parcAbonnesB2bRows} setRows={setParcAbonnesB2bRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "parc_abonnes_gp" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Parc Abonnes GP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabParcAbonnesGp rows={parcAbonnesGpRows} setRows={setParcAbonnesGpRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "total_parc_abonnes" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Total Parc Abonnes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabTotalParcAbonnes rows={totalParcAbonnesRows} setRows={setTotalParcAbonnesRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "total_parc_abonnes_technologie" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Total Parc Abonnes parc technologie</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabTotalParcAbonnesTechnologie rows={totalParcAbonnesTechnologieRows} setRows={setTotalParcAbonnesTechnologieRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "activation" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Activation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabActivation rows={activationRows} setRows={setActivationRows} onSave={handleSave} isSubmitting={isSubmitting} />
                  </CardContent>
                </Card>
              )}
              {activeTab === "chiffre_affaires_mda" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Chiffre d'Affaires (MDA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabChiffreAffairesMda rows={chiffreAffairesMdaRows} setRows={setChiffreAffairesMdaRows} onSave={handleSave} isSubmitting={isSubmitting} />
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