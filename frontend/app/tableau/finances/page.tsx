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
// ?????????????????????????????????????????????????????????????????????????????
// 1. CONSTANTES GLOBALES
// ?????????????????????????????????????????????????????????????????????????????
const PRIMARY_COLOR = "#2db34b"

// ?????????????????????????????????????????????????????????????????????????????
// 3. HELPERS DE FORMATAGE DES MONTANTS
// ?????????????????????????????????????????????????????????????????????????????
const isTotalRow = (d: string) => /total/i.test(d)

const calcEvol = (m: string, m1: string) => {
  const mNum = num(m)
  const m1Num = num(m1)
  if (m1Num === 0) return "0.0"
  return ((mNum - m1Num) / m1Num * 100).toFixed(1)
}

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
// 5. TYPES DE DONNéES
// ?????????????????????????????????????????????????????????????????????????????

// ?? Compte Résultat ???????????????????????????????????????????????????????????
type CompteResultatRow = { 
  designation: string
  mBudget: string
  mRealise: string
  mTaux: string
  m1Realise: string
}

const COMPTE_RESULTAT_LABELS = [
  "Chiffre d'affaire GP",
  "Chiffre d'affair B2B",
  "Chiffre d'affairs Interco -roming",
  "Total CA",
  "Autres produits",
  "Consommation de l'exercice",
  "Service Exterieurs et autres consommations",
  "VALEUR AJOUTEE D'EXPLOITATION",
  "Charge du Personnel",
  "Impots, Taxes et versement assimile",
  "EBE",
  "Autres produits Operasionnels",
  "Autres charges Operationnelles",
  "Dotations aux amortissements",
  "Reprises sur pertes de valeur et provisions",
  "Resultat Operationnel",
  "Produits financiers",
  "Charges financieres",
  "RESULTAT FINANCIER",
  "RESULTAT ORDINAIRE AVANT IMPOTS",
] as const

const COMPTE_RESULTAT_GREEN_ROWS = new Set([
  "Total CA",
  "VALEUR AJOUTEE D'EXPLOITATION",
  "EBE",
  "Resultat Operationnel",
  "RESULTAT FINANCIER",
  "RESULTAT ORDINAIRE AVANT IMPOTS",
])

const DEFAULT_COMPTE_RESULTAT_ROWS: CompteResultatRow[] = COMPTE_RESULTAT_LABELS.map((designation) => ({
  designation,
  mBudget: "",
  mRealise: "",
  mTaux: "",
  m1Realise: "",
}))

// ?????????????????????????????????????????????????????????????????????????????
// 6. COMPOSANTS DE TABLEAUX
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

// ?? Compte Résultat ???????????????????????????????????????????????????????????
interface TabCompteResultatProps {
  rows: CompteResultatRow[]
  setRows: React.Dispatch<React.SetStateAction<CompteResultatRow[]>>
  onSave: () => void
  isSubmitting: boolean
  mois: string
}

function TabCompteResultat({ rows, setRows, onSave, isSubmitting, mois }: TabCompteResultatProps) {
  const update = (index: number, field: keyof CompteResultatRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  const mFields = ["mBudget", "mRealise"] as const
  const calcTaux = (row: CompteResultatRow) => {
    const realise = parseFloat(row.mRealise ?? "0") || 0
    const budget = parseFloat(row.mBudget ?? "0") || 0
    return budget ? ((realise / budget) * 100).toFixed(1) : "0.0"
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Désignations</th>
              <th colSpan={1} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">{getMonthLabel(mois, 0)}</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Réalisé</th>
              {["Budget", "Réalisé", "Taux"].map((h, i) => (
                <th key={i + 3} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.designation} className={COMPTE_RESULTAT_GREEN_ROWS.has(row.designation) ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
                {mFields.map((field) => (
                  <td key={field} className="px-1 py-1 border-b">
                    <AmountInput value={row[field]} onChange={(e) => update(index, field, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
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

// ?? Investissement (MDA) ???????????????????????????????????????????????????????
type InvestissementRow = { designation: string; m1: string; m: string; evol: string }

const INVESTISSEMENT_LABELS = [
  "PREVU",
  "ENGAGE",
  "TECHNIQUE PREVU",
  "TECHNIQUE ENGAGE",
  "Totale Prevu",
  "Totale Engage",
  "Taux",
] as const

const DEFAULT_INVESTISSEMENT_ROWS: InvestissementRow[] = INVESTISSEMENT_LABELS.map((designation) => ({
  designation,
  m1: "",
  m: "",
  evol: "",
}))

const INVESTISSEMENT_GREEN_ROWS = new Set(["Taux"])

// ?? Avancement Engagement (Finance DFC) ????????????????????????????????????????
type AvancementEngagementRow = { designation: string; m1: string; m: string; evol: string }

const AVANCEMENT_ENGAGEMENT_LABELS = [
  "Montant de l'investissement",
  "Dépense d'investissement engagées",
  "Droits de Douane Exonérés",
  "TVA Exonérée",
  "Taux d'investissement",
  "Total des emplois créés",
] as const

const DEFAULT_AVANCEMENT_ENGAGEMENT_ROWS: AvancementEngagementRow[] = AVANCEMENT_ENGAGEMENT_LABELS.map((designation) => ({
  designation,
  m1: "",
  m: "",
  evol: "",
}))

// ?? Tresorerie Mobilis (MDA) ???????????????????????????????????????????????????
type TresorerieMobilisRow = { designation: string; m1: string; m: string; evol: string }

const TRESORERIE_MOBILIS_LABELS = [
  "Solde Debut de période",
  "Client",
  "Roaming",
  "Interco",
  "Autre",
  "Totale Mois",
  "totale Cumulé",
  "DEPENSE (décaissement)",
  "Exploitations",
  "Totale Mois",
  "Totale Cumulé",
  "Solde Fin de Période",
] as const

const DEFAULT_TRESORERIE_MOBILIS_ROWS: TresorerieMobilisRow[] = TRESORERIE_MOBILIS_LABELS.map((designation) => ({
  designation,
  m1: "",
  m: "",
  evol: "",
}))

const TRESORERIE_MOBILIS_GREEN_INDICES = new Set([5, 9, 11])

interface TabInvestissementProps {
  rows: InvestissementRow[]
  setRows: React.Dispatch<React.SetStateAction<InvestissementRow[]>>
  onSave: () => void
  isSubmitting: boolean
  mois: string
}

const TRESORERIE_NO_EVOL = new Set([0, 5, 9, 11])

function TabInvestissement({ rows, setRows, onSave, isSubmitting, mois }: TabInvestissementProps) {
  const update = (index: number, field: keyof InvestissementRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  const NO_EVOL_INDICES = new Set([4, 5, 6])
  const prevuRows = rows.filter((_, i) => i === 0 || i === 2)
  const engageRows = rows.filter((_, i) => i === 1 || i === 3)
  const sumPrevuM1 = prevuRows.reduce((s, r) => s + num(r.m1), 0)
  const sumPrevuM = prevuRows.reduce((s, r) => s + num(r.m), 0)
  const sumEngageM1 = engageRows.reduce((s, r) => s + num(r.m1), 0)
  const sumEngageM = engageRows.reduce((s, r) => s + num(r.m), 0)
  const tauxM1 = sumEngageM1 === 0 ? "N/A" : fmt((sumPrevuM1 / sumEngageM1) * 100)
  const tauxM = sumEngageM === 0 ? "N/A" : fmt((sumPrevuM / sumEngageM) * 100)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">INVESTISSEMENT (MDA)</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r"></th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, 0)}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Evol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isPrevuTtl = row.designation === "Totale Prevu"
              const isEngageTtl = row.designation === "Totale Engage"
              const isTtl = isPrevuTtl || isEngageTtl
              const isTaux = index === 6
              const tM1 = isPrevuTtl ? sumPrevuM1 : isEngageTtl ? sumEngageM1 : 0
              const tM = isPrevuTtl ? sumPrevuM : isEngageTtl ? sumEngageM : 0
              const dM1 = isTtl ? fmt(tM1) : null
              const dM = isTtl ? fmt(tM) : null
              const dEvol = isTtl ? calcEvol(String(tM), String(tM1)) : calcEvol(row.m, row.m1)
              return (
                <tr key={row.designation} className={INVESTISSEMENT_GREEN_ROWS.has(row.designation) ? "bg-green-100 font-semibold" : "bg-white"}>
                  {index === 0 && <td rowSpan={2} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle text-center">Fonctionement</td>}
                  {index === 2 && <td rowSpan={2} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle text-center">Technique</td>}
                  {index > 3 && <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>}
                  <td className="px-3 py-2 border-b text-center text-xs font-medium text-gray-600">{(index === 0 || index === 2) ? "PREVU" : (index === 1 || index === 3) ? "ENGAGE" : ""}</td>
                  <td className="px-1 py-1 border-b">
                    {isTtl ? <span className="block px-2 text-xs text-right">{dM1}</span> : isTaux ? <span className="block px-2 text-xs text-right font-semibold">{tauxM1}</span> : <AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />}
                  </td>
                  <td className="px-1 py-1 border-b">
                    {isTtl ? <span className="block px-2 text-xs text-right">{dM}</span> : isTaux ? <span className="block px-2 text-xs text-right font-semibold">{tauxM}</span> : <AmountInput value={row.m} onChange={(e) => update(index, "m", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />}
                  </td>
                  {NO_EVOL_INDICES.has(index) ? (
                    <td className="px-3 py-2 border-b"></td>
                  ) : (
                    <td className="px-1 py-1 border-b text-xs text-right font-semibold">{dEvol} %</td>
                  )}
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

// ?? Avancement Engagement ???????????????????????????????????????????????????????
interface TabAvancementEngagementProps {
  rows: AvancementEngagementRow[]
  setRows: React.Dispatch<React.SetStateAction<AvancementEngagementRow[]>>
  onSave: () => void
  isSubmitting: boolean
  mois: string
}

function TabAvancementEngagement({ rows, setRows, onSave, isSubmitting, mois }: TabAvancementEngagementProps) {
  const update = (index: number, field: keyof AvancementEngagementRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">État d'avancement des engagements (MDA)</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, 0)}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Evolution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.designation} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.m} onChange={(e) => update(index, "m", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />
                </td>
                <td className="px-1 py-1 border-b text-xs text-right font-semibold">{calcEvol(row.m, row.m1)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? Tresorerie Mobilis ?????????????????????????????????????????????????????????
interface TabTresorerieMobilisProps {
  rows: TresorerieMobilisRow[]
  setRows: React.Dispatch<React.SetStateAction<TresorerieMobilisRow[]>>
  onSave: () => void
  isSubmitting: boolean
  mois: string
}

function TabTresorerieMobilis({ rows, setRows, onSave, isSubmitting, mois }: TabTresorerieMobilisProps) {
  const update = (index: number, field: keyof TresorerieMobilisRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  const recetteRows = rows.filter((_, i) => i >= 1 && i <= 4)
  const sumRecetteM1 = recetteRows.reduce((s, r) => s + num(r.m1), 0)
  const sumRecetteM = recetteRows.reduce((s, r) => s + num(r.m), 0)
  const depRows = rows.filter((_, i) => i === 7 || i === 8)
  const sumDepM1 = depRows.reduce((s, r) => s + num(r.m1), 0)
  const sumDepM = depRows.reduce((s, r) => s + num(r.m), 0)
  const soldeDebut = rows[0]
  const soldeDebutM1 = num(soldeDebut?.m1 ?? "0")
  const soldeDebutM = num(soldeDebut?.m ?? "0")

  const getTotalM1 = (i: number) => {
    if (i === 5) return sumRecetteM1
    if (i === 9) return sumDepM1
    if (i === 11) return soldeDebutM1 + sumRecetteM1 - sumDepM1
    return 0
  }
  const getTotalM = (i: number) => {
    if (i === 5) return sumRecetteM
    if (i === 9) return sumDepM
    if (i === 11) return soldeDebutM + sumRecetteM - sumDepM
    return 0
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Trésorerie Mobilis (MDA)</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r"></th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, -1)}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">{getMonthLabel(mois, 0)}</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Evolution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isAutoSum = [5, 9, 11].includes(index)
              const noEvol = TRESORERIE_NO_EVOL.has(index)
              const tM1 = isAutoSum ? getTotalM1(index) : 0
              const tM = isAutoSum ? getTotalM(index) : 0
              const dM1 = isAutoSum ? fmt(tM1) : null
              const dM = isAutoSum ? fmt(tM) : null
              const dEvol = isAutoSum ? calcEvol(String(tM), String(tM1)) : calcEvol(row.m, row.m1)
              return (
                <tr key={`${row.designation}-${index}`} className={TRESORERIE_MOBILIS_GREEN_INDICES.has(index) ? "bg-green-100 font-semibold" : "bg-white"}>
                  {index === 1 ? (
                    <td rowSpan={4} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle">RECETTE (encaissement)</td>
                  ) : index === 7 ? (
                    <td rowSpan={2} className="px-3 py-2 border-b text-xs font-semibold text-gray-800 align-middle">DÉPENSE (décaissement)</td>
                  ) : index === 0 || (index >= 5 && index <= 6) || index >= 9 ? (
                    <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                  ) : null}
                  <td className="px-3 py-2 border-b text-center text-xs font-medium text-gray-600">
                    {(index >= 1 && index <= 4) ? ["Client", "Roaming", "Interco", "Autre"][index - 1] : index === 7 ? "Investissements" : index === 8 ? "Exploitations" : ""}
                  </td>
                  <td className="px-1 py-1 border-b">
                    {isAutoSum ? <span className="block px-2 text-xs text-right">{dM1}</span> : <AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />}
                  </td>
                  <td className="px-1 py-1 border-b">
                    {isAutoSum ? <span className="block px-2 text-xs text-right">{dM}</span> : <AmountInput value={row.m} onChange={(e) => update(index, "m", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" />}
                  </td>
                  {noEvol ? (
                    <td className="px-3 py-2 border-b"></td>
                  ) : (
                    <td className="px-1 py-1 border-b text-xs text-right font-semibold">{dEvol} %</td>
                  )}
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

// ?????????????????????????????????????????????????????????????????????????????
// 7. CONFIGURATION DES ONGLETS
// ?????????????????????????????????????????????????????????????????????????????
const TABS = [
  { key: "compte_resultat", label: "Compte de résultat", color: PRIMARY_COLOR, title: "COMPTE DE RÉSULTAT & INVESTISSEMENT (MDA)" },
  { key: "avancement_engagement", label: "Finance DFC", color: PRIMARY_COLOR, title: "ÉTAT D'AVANCEMENT DES ENGAGEMENTS (MDA)" },
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey = "compte_resultat" | "investissement" | "avancement_engagement" | "tresorerie"

type tableauCategoryKey = "all"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "all", label: "Tous", tabKeys: ["compte_resultat", "investissement", "avancement_engagement", "tresorerie"] },
]

const KPI_TAB_KEYS = ["compte_resultat", "investissement", "avancement_engagement"]

const ALL_VALID_KEYS = new Set(["compte_resultat", "investissement", "avancement_engagement", "tresorerie"])

const findtableauCategoryKeyForTab = (_tabKey: string): tableauCategoryKey => "all"

const istableauTabKey = (value: string): value is tableauTabKey =>
  ALL_VALID_KEYS.has(value)

const MONTHS = [
  { value: "01", label: "Janvier" }, { value: "02", label: "Fevrier" },
  { value: "03", label: "Mars" }, { value: "04", label: "Avril" },
  { value: "05", label: "Mai" }, { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" }, { value: "08", label: "Aout" },
  { value: "09", label: "Septembre" }, { value: "10", label: "Octobre" },
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

interface Savedtableau {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  compteResultatRows?: CompteResultatRow[]
  investissementRows?: InvestissementRow[]
  avancementEngagementRows?: AvancementEngagementRow[]
  tresorerieMobilisRows?: TresorerieMobilisRow[]
}

type Apitableautableau = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

const safeString = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

const normalizeMonthValue = (value: string) =>
  MONTHS.some((m) => m.value === value) ? value : String(new Date().getMonth() + 1).padStart(2, "0")

const normalizeYearValue = (value: string) =>
  YEARS.includes(value) ? value : String(CURRENT_YEAR)

const normalizeCompteResultatRows = (rows?: CompteResultatRow[]): CompteResultatRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return COMPTE_RESULTAT_LABELS.map((designation, i) => ({
    designation,
    mBudget: safeString(src[i]?.mBudget),
    mRealise: safeString(src[i]?.mRealise),
    mTaux: safeString(src[i]?.mTaux),
    m1Realise: safeString(src[i]?.m1Realise),
  }))
}

const normalizeInvestissementRows = (rows?: InvestissementRow[]): InvestissementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return INVESTISSEMENT_LABELS.map((designation, i) => ({
    designation,
    m1: safeString(src[i]?.m1),
    m: safeString(src[i]?.m),
    evol: safeString(src[i]?.evol),
  }))
}

const normalizeAvancementEngagementRows = (rows?: AvancementEngagementRow[]): AvancementEngagementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return AVANCEMENT_ENGAGEMENT_LABELS.map((designation, i) => ({
    designation,
    m1: safeString(src[i]?.m1),
    m: safeString(src[i]?.m),
    evol: safeString(src[i]?.evol),
  }))
}

const normalizeTresorerieMobilisRows = (rows?: TresorerieMobilisRow[]): TresorerieMobilisRow[] => {
  const src = Array.isArray(rows) ? rows : []
  // Migration from old 13-row format to current 12-row format
  if (src.length === 13) {
    const srcWithoutRecette = src.filter((_, i) => i !== 1)
    return TRESORERIE_MOBILIS_LABELS.map((designation, i) => ({
      designation,
      m1: safeString(srcWithoutRecette[i]?.m1),
      m: safeString(srcWithoutRecette[i]?.m),
      evol: safeString(srcWithoutRecette[i]?.evol),
    }))
  }
  return TRESORERIE_MOBILIS_LABELS.map((designation, i) => ({
    designation,
    m1: safeString(src[i]?.m1),
    m: safeString(src[i]?.m),
    evol: safeString(src[i]?.evol),
  }))
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.avancementEngagementRows?.length ?? 0) > 0) return "avancement_engagement"
  if ((decl.tresorerieMobilisRows?.length ?? 0) > 0) return "tresorerie"
  if ((decl.investissementRows?.length ?? 0) > 0) return "investissement"
  if ((decl.compteResultatRows?.length ?? 0) > 0) return "compte_resultat"
  return "compte_resultat"
}

// PAGE
function FinancesPageContent() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
  useTableauStepNavigation("finances")
  const printRef = useRef<HTMLDivElement>(null)
  const [editQuery, setEditQuery] = useState<{ editId: string; tab: string }>({ editId: "", tab: "" })

  const [regions, setRegions] = useState<{ id: number; name: string }[]>([])
  useEffect(() => {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
    fetch(`${API_BASE}/api/regions`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data: { id: number; nom: string }[]) => setRegions(data))
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

  const [activeTab, setActiveTab] = useState("compte_resultat")
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

  const [compteResultatRows, setCompteResultatRows] = useState<CompteResultatRow[]>(DEFAULT_COMPTE_RESULTAT_ROWS.map((row) => ({ ...row })))
  const [investissementRows, setInvestissementRows] = useState<InvestissementRow[]>(DEFAULT_INVESTISSEMENT_ROWS.map((row) => ({ ...row })))
  const [avancementEngagementRows, setAvancementEngagementRows] = useState<AvancementEngagementRow[]>(DEFAULT_AVANCEMENT_ENGAGEMENT_ROWS.map((row) => ({ ...row })))
  const [tresorerieMobilisRows, setTresorerieMobilisRows] = useState<TresorerieMobilisRow[]>(DEFAULT_TRESORERIE_MOBILIS_ROWS.map((row) => ({ ...row })))
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
      const map = await fetchKpiRowsMap(KPI_TAB_KEYS, "Finances")
      if (!cancelled) {
        setKpiRows(map)
      }
    }
    loadKpis()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const labels = kpiRows["compte_resultat"]
    const finalLabels = (labels && labels.length > 0 ? labels : COMPTE_RESULTAT_LABELS)
      .map((l) => l.replace(/ME\b/g, "B2B"))
    setCompteResultatRows((prev) => finalLabels.map((designation, i) => ({
      designation,
      mBudget: safeString(prev[i]?.mBudget),
      mRealise: safeString(prev[i]?.mRealise),
      mTaux: safeString(prev[i]?.mTaux),
      m1Realise: safeString(prev[i]?.m1Realise),
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

  const declarationCategoryOptions = useMemo(() => {
    const availableKeys = new Set(declarationTabs.map((tab) => tab.key))
    return tableau_CATEGORY_OPTIONS.filter(
      (category) => category.key === "all" || category.tabKeys.some((tabKey) => availableKeys.has(tabKey)),
    )
  }, [declarationTabs])

  const filteredDeclarationTabs = useMemo(() => {
    const selectedCategory = declarationCategoryOptions.find((category) => category.key === selectedCategoryKey)
    if (!selectedCategory) return declarationTabs
    const categoryTabKeys = new Set(selectedCategory.tabKeys)
    return declarationTabs.filter((tab) => categoryTabKeys.has(tab.key as tableauTabKey))
  }, [declarationCategoryOptions, declarationTabs, selectedCategoryKey])
  
  const allowedTabKeys = useDeclarationAccess("finances", user?.allowedKpis)
  
  const accessibleDeclarationTabs = filteredDeclarationTabs
  
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

    autoPopulate("compte_resultat", setCompteResultatRows)
    autoPopulate("investissement", setInvestissementRows)
    autoPopulate("avancement_engagement", setAvancementEngagementRows)
    autoPopulate("tresorerie", setTresorerieMobilisRows)
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
    if (declarationCategoryOptions.some((category) => category.key === selectedCategoryKey)) return
    setSelectedCategoryKey(declarationCategoryOptions[0]?.key ?? "all")
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
          title: "Déclaration introuvable",
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
      setActiveTab(requestedTab === "investissement" ? "compte_resultat" : requestedTab === "tresorerie" ? "avancement_engagement" : requestedTab)
      setDirection(scopedDirection)
      const loadedMois = normalizeMonthValue(safeString(declaration.mois))
      const loadedAnnee = normalizeYearValue(safeString(declaration.annee))
      setMois(loadedMois)
      setAnnee(loadedAnnee)
      setEditingSourceMois(loadedMois)
      setEditingSourceAnnee(loadedAnnee)
      setCompteResultatRows(normalizeCompteResultatRows(declaration.compteResultatRows))
      setInvestissementRows(normalizeInvestissementRows(declaration.investissementRows))
      setAvancementEngagementRows(normalizeAvancementEngagementRows(declaration.avancementEngagementRows))
      setTresorerieMobilisRows(normalizeTresorerieMobilisRows(declaration.tresorerieMobilisRows))
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
        ALL_VALID_KEYS.has(decl.tabKey)
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

  const handleStepClick = (pointKey: string) => {
    const resolvedKey = pointKey === "investissement" ? "compte_resultat" : pointKey === "tresorerie" ? "avancement_engagement" : pointKey
    if (istableauTabKey(resolvedKey)) {
      setSelectedCategoryKey("all")
      setActiveTab(resolvedKey)
    }
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

    let validationError = false
    if (tabKey === "compte_resultat" && compteResultatRows.some((row) => !row.mBudget || !row.mRealise || !row.mTaux || !row.m1Realise)) {
      toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Compte de resultat.", variant: "destructive" })
      validationError = true
    }
    if (tabKey === "investissement" && investissementRows.some((row) => !row.m1 || !row.m)) {
      toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Investissement.", variant: "destructive" })
      validationError = true
    }
    if (tabKey === "avancement_engagement" && avancementEngagementRows.some((row) => !row.m1 || !row.m || !row.evol)) {
      toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Etat d'avancement des engagements.", variant: "destructive" })
      validationError = true
    }
    if (tabKey === "tresorerie" && tresorerieMobilisRows.some((row) => !row.m1 || !row.m || !row.evol)) {
      toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Trésorerie Mobilis.", variant: "destructive" })
      validationError = true
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
      compteResultatRows: [],
      investissementRows: [],
      avancementEngagementRows: [],
      tresorerieMobilisRows: [],
    }

    switch (tabKey) {
      case "compte_resultat":
        baseDecl.compteResultatRows = compteResultatRows
        break
      case "investissement":
        baseDecl.investissementRows = investissementRows
        break
      case "avancement_engagement":
        baseDecl.avancementEngagementRows = avancementEngagementRows
        break
      case "tresorerie":
        baseDecl.tresorerieMobilisRows = tresorerieMobilisRows
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
      const tabData = tabKey === "avancement_engagement"
        ? { avancementEngagementRows }
        : tabKey === "investissement"
        ? { investissementRows }
        : tabKey === "tresorerie"
        ? { tresorerieMobilisRows }
        : { compteResultatRows }

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

  return (
    <LayoutWrapper user={user}>
      <DomainAccessGuard user={user} domainKey="finances">
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
              title="Tableaux Finances"
              domain="finances"
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
              {activeTab === "compte_resultat" && (() => {
              const isLocked = allowedTabKeys && !allowedTabKeys.has("compte_resultat")
              return (
                <div className={"space-y-4" + (isLocked ? " opacity-50 pointer-events-none select-none" : "")}>
                  {isLocked && (
                    <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                      Accès refusé — vous n'avez pas les droits pour modifier ce tableau.
                    </div>
                  )}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Compte de résultat</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {renderExistingWarning("compte_resultat")}
                      <TabCompteResultat rows={compteResultatRows} setRows={setCompteResultatRows} onSave={() => handleSave("compte_resultat")} isSubmitting={isSubmitting} mois={mois} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Investissement (MDA)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {renderExistingWarning("investissement")}
                      <TabInvestissement rows={investissementRows} setRows={setInvestissementRows} onSave={() => handleSave("investissement")} isSubmitting={isSubmitting} mois={mois} />
                    </CardContent>
                  </Card>
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
              )
            })()}
              {activeTab === "avancement_engagement" && (() => {
              const isLocked = allowedTabKeys && !allowedTabKeys.has("avancement_engagement")
              return (
                <div className={"space-y-4" + (isLocked ? " opacity-50 pointer-events-none select-none" : "")}>
                  {isLocked && (
                    <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                      Accès refusé — vous n'avez pas les droits pour modifier ce tableau.
                    </div>
                  )}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Etat d'avancement des engagement (MDA)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {renderExistingWarning("avancement_engagement")}
                      <TabAvancementEngagement rows={avancementEngagementRows} setRows={setAvancementEngagementRows} onSave={() => handleSave("avancement_engagement")} isSubmitting={isSubmitting} mois={mois} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Trésorerie Mobilis (MDA)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {renderExistingWarning("tresorerie")}
                      <TabTresorerieMobilis rows={tresorerieMobilisRows} setRows={setTresorerieMobilisRows} onSave={() => handleSave("tresorerie")} isSubmitting={isSubmitting} mois={mois} />
                    </CardContent>
                  </Card>
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
              )
            })()}

              <DynamicKpiTabs
                domain="finances"
                excludeKeys={KPI_TAB_KEYS}
                mois={mois}
                annee={annee}
                direction={effectiveDirection}
                allowedKpis={user.allowedKpis}
                allowedSousDomaines={user.allowedSousDomaines}
              />
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
      <FinancesPageContent />
    </Suspense>
  )
}