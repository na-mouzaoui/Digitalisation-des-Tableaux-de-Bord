"use client"

import { useState, useCallback, useMemo, useRef, useEffect, Suspense } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { useTableauStepNavigation } from "@/hooks/use-tableau-step-navigation"
import { getDomainProgressSteps } from "@/lib/tableau-progress"
import { TableauHeader } from "@/components/tableau-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Save, ArrowRight, Pencil } from "lucide-react"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import { API_BASE } from "@/lib/config"
import { fetchKpiRowsMap } from "@/lib/kpi-rows"
import DynamicKpiTabs from "@/components/dynamic-kpi-tabs"
import { useDeclarationAccess } from "@/hooks/use-declaration-access"
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
  const raw = (value ?? "").replace(/\u00A0/g, " ").trim()
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
  const normalized = normalizeAmountInput(value ?? "")
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
const DEFAULT_RECLAMATION_LABELS = ["Recues GP", "Recues B2B", "Traitees GP", "Traitees B2B"] as const

// ?? E-Payement ???????????????????????????????????????????????????????????????
type EPayementRow = { rechargement: string; m: string; m1: string; evol: string }
const EPAYEMENT_CHANNELS = ["Baridimob", "webportail", "GAB-Alg Poste", "WINPAY (BNA)"] as const
const createDefaultEPayementRows = (): EPayementRow[] =>
  EPAYEMENT_CHANNELS.map((rechargement) => ({ rechargement, m: "", m1: "", evol: "" }))

// ?? Rechargement
type RechargementRow = { designation: string; m: string; m1: string; evol: string }
const RECHARGEMENT_LABELS = ["Rechargement PRP Mensuel en Mlrds DA HT", "CA Prélèvements DM en Mlrds DA HT", "Evol"] as const
const DEFAULT_RECHARGEMENT_ROWS: RechargementRow[] = RECHARGEMENT_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Situation Reseaux
type SituationReseauRow = { situation: string; equipements: string; m: string; m1: string }
const DEFAULT_SITUATION_RESEAU_ROWS: SituationReseauRow[] = [
  { situation: "Reseau 2G", equipements: "BTS 900/1800 Mhz", m: "", m1: "" },
  { situation: "Reseau 3G", equipements: "NodeB", m: "", m1: "" },
  { situation: "Reseau 4G", equipements: "eNodeB (Evolved NodeB) (FDD+TDD)\neNodeB (Evolved NodeB) (FDD)", m: "", m1: "" },
]

// ?? Total Encaissement ???????????????????????????????????????????????????????
type TotalEncaissementRow = { designation: string; m: string; m1: string; evol: string }
const TOTAL_ENCAISSEMENT_LABELS = ["GP", "B2B", "Total"] as const
const DEFAULT_TOTAL_ENCAISSEMENT_ROWS: TotalEncaissementRow[] = TOTAL_ENCAISSEMENT_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Recouvrement ?????????????????????????????????????????????????????????????
type RecouvrementRow = { designation: string; m1Recouvre: string; mMis: string; mRecouvre: string; mTaux: string }
const RECOUVREMENT_LABELS = ["GP", "B2B", "Total"] as const
const DEFAULT_RECOUVREMENT_ROWS: RecouvrementRow[] = RECOUVREMENT_LABELS.map((designation) => ({ designation, m1Recouvre: "", mMis: "", mRecouvre: "", mTaux: "" }))

// ?? Parc Abonnés GP ???????????????????????????????????????????????????????????
type ParcAbonnesGpRow = { designation: string; m: string; m1: string; evol: string }
const PARC_ABONNES_GP_LABELS = ["Parc Abonnés GP", "Parc Abonnés B2B", "TOTAL"] as const
const DEFAULT_PARC_ABONNES_GP_ROWS: ParcAbonnesGpRow[] = PARC_ABONNES_GP_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Total Parc Abonnés par Technologie ???????????????????????????????????????
type TotalParcAbonnesTechnologieRow = { designation: string; m: string; m1: string; evol: string }
const TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS = ["2G", "3G", "4G", "5G", "TOTAL"] as const
const DEFAULT_TOTAL_PARC_ABONNES_TECHNOLOGIE_ROWS: TotalParcAbonnesTechnologieRow[] = TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Activation ????????????????????????????????????????????????????????????????
type ActivationRow = { designation: string; m: string; m1: string; evol: string }
const ACTIVATION_LABELS = ["GP", "B2B", "Total"] as const
const DEFAULT_ACTIVATION_ROWS: ActivationRow[] = ACTIVATION_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Désactivation ?????????????????????????????????????????????????????????????
type DesactivationRow = { designation: string; m: string; m1: string; evol: string }
const DESACTIVATION_LABELS = ["GP", "B2B", "Total"] as const
const DEFAULT_DESACTIVATION_ROWS: DesactivationRow[] = DESACTIVATION_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Résiliation ???????????????????????????????????????????????????????????????
type ResiliationRow = { designation: string; m: string; m1: string; evol: string }
const RESILIATION_LABELS = ["GP", "B2B", "Total"] as const
const DEFAULT_RESILIATION_ROWS: ResiliationRow[] = RESILIATION_LABELS.map((designation) => ({ designation, m: "", m1: "", evol: "" }))

// ?? Chiffre d'Affaires MDA ????????????????????????????????????????????????????
type ChiffreAffairesMdaRow = { designation: string; mObjectif: string; mRealise: string; mTaux: string; m1Realise: string }
const CHIFFRE_AFFAIRES_MDA_LABELS = ["Grand Public", "B2B", "Interco & Roaming"] as const
const DEFAULT_CHIFFRE_AFFAIRES_MDA_ROWS: ChiffreAffairesMdaRow[] = CHIFFRE_AFFAIRES_MDA_LABELS.map((designation) => ({ designation, mObjectif: "", mRealise: "", mTaux: "", m1Realise: "" }))


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
// 6a. Réclamation - VERSION FINALE OPTIMISÉE
interface TabReclamationProps {
  rows: ReclamationRow[]
  setRows: React.Dispatch<React.SetStateAction<ReclamationRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabReclamation({ rows, setRows, onSave, isSubmitting }: TabReclamationProps) {
  // Mise à jour pour M (mois actuel) et M-1 (mois précédent)
  const updateM = (index: number, field: "mGp" | "mB2b", value: string) =>
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row
      return { ...row, [field]: value }
    }))

  const updateM1 = (index: number, field: "m1Gp" | "m1B2b", value: string) =>
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row
      return { ...row, [field]: value }
    }))

  const recuesRows = rows.filter((r) => r.category === "recues")
  const traiteesRows = rows.filter((r) => r.category === "traitees")
  
  // Récupérer les valeurs pour chaque ligne
  const recuesGP_M = recuesRows.find(r => r.type === "GP")?.mGp || ""
  const recuesGP_M1 = recuesRows.find(r => r.type === "GP")?.m1Gp || ""
  const recuesB2B_M = recuesRows.find(r => r.type === "B2B")?.mB2b || ""
  const recuesB2B_M1 = recuesRows.find(r => r.type === "B2B")?.m1B2b || ""
  const traiteesGP_M = traiteesRows.find(r => r.type === "GP")?.mGp || ""
  const traiteesGP_M1 = traiteesRows.find(r => r.type === "GP")?.m1Gp || ""
  const traiteesB2B_M = traiteesRows.find(r => r.type === "B2B")?.mB2b || ""
  const traiteesB2B_M1 = traiteesRows.find(r => r.type === "B2B")?.m1B2b || ""
  
  // États pour les taux de traitement (inputs normaux)
  const toNumber = (v: string) => parseFloat(v.replace(",", ".")) || 0
  const [tauxM, setTauxM] = useState("")
  const [tauxM1, setTauxM1] = useState("")

  const handleUpdateM = (type: string, category: string, value: string) => {
    const index = rows.findIndex(r => r.type === type && r.category === category)
    if (index === -1) return
    if (type === "GP") {
      updateM(index, "mGp", value)
    } else {
      updateM(index, "mB2b", value)
    }
  }

  const handleUpdateM1 = (type: string, category: string, value: string) => {
    const index = rows.findIndex(r => r.type === type && r.category === category)
    if (index === -1) return
    if (type === "GP") {
      updateM1(index, "m1Gp", value)
    } else {
      updateM1(index, "m1B2b", value)
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th colSpan={2} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 w-40">
                Réclamations
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 w-28">
                M
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border border-gray-200 w-28">
                M-1
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Ligne Réclamations reçues - GP */}
            <tr className="bg-white">
              <td rowSpan={3} className="px-2 py-2 border border-gray-200 text-xs font-semibold text-gray-800 align-middle w-28">
                Réclamations reçues
              </td>
              <td className="px-2 py-2 border border-gray-200 text-xs text-center w-12">GP</td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={recuesGP_M}
                  onChange={(e) => handleUpdateM("GP", "recues", e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={recuesGP_M1}
                  onChange={(e) => handleUpdateM1("GP", "recues", e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
            </tr>
            {/* Ligne Réclamations reçues - B2B */}
            <tr className="bg-white">
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">B2B</td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={recuesB2B_M}
                  onChange={(e) => handleUpdateM("B2B", "recues", e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={recuesB2B_M1}
                  onChange={(e) => handleUpdateM1("B2B", "recues", e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
            </tr>
            {/* Ligne Totale des réclamations reçus */}
            <tr className="bg-green-100 font-semibold">
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">Totale</td>
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">
                {(toNumber(recuesGP_M) + toNumber(recuesB2B_M)).toFixed(2)}
              </td>
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">
                {(toNumber(recuesGP_M1) + toNumber(recuesB2B_M1)).toFixed(2)}
              </td>
            </tr>
            {/* Ligne Réclamations traitées - GP */}
            <tr className="bg-gray-50">
              <td rowSpan={3} className="px-2 py-2 border border-gray-200 text-xs font-semibold text-gray-800 align-middle">
                Réclamations traitées
              </td>
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">GP</td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={traiteesGP_M}
                  onChange={(e) => handleUpdateM("GP", "traitees", e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={traiteesGP_M1}
                  onChange={(e) => handleUpdateM1("GP", "traitees", e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
            </tr>
            {/* Ligne Réclamations traitées - B2B */}
            <tr className="bg-gray-50">
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">B2B</td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={traiteesB2B_M}
                  onChange={(e) => handleUpdateM("B2B", "traitees", e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={traiteesB2B_M1}
                  onChange={(e) => handleUpdateM1("B2B", "traitees", e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
            </tr>
            {/* Ligne Totale des réclamations traitées */}
            <tr className="bg-green-100 font-semibold">
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">Totale</td>
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">
                {(toNumber(traiteesGP_M) + toNumber(traiteesB2B_M)).toFixed(2)}
              </td>
              <td className="px-2 py-2 border border-gray-200 text-xs text-center">
                {(toNumber(traiteesGP_M1) + toNumber(traiteesB2B_M1)).toFixed(2)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-green-100">
              <td colSpan={2} className="px-2 py-2 text-xs text-right border border-gray-200 font-semibold">
                Taux de traitement (%)
              </td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={tauxM}
                  onChange={(e) => setTauxM(e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
              <td className="px-1 py-1 border border-gray-200">
                <AmountInput 
                  value={tauxM1}
                  onChange={(e) => setTauxM1(e.target.value)} 
                  className="h-7 px-2 text-xs w-full" 
                  placeholder="0,00" 
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}
// ?? 6c. E-Payement (bloc réutilisable + wrapper) ??????????????????????????????
// ?? 6c. E-Payement (bloc réutilisable + wrapper) avec ligne de total ??????????
interface EPayementBlockProps {
  title: string
  rows: EPayementRow[]
  setRows: React.Dispatch<React.SetStateAction<EPayementRow[]>>
}
function EPayementBlock({ title, rows, setRows }: EPayementBlockProps) {
  const update = (index: number, field: "m" | "m1" | "evol", value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  // Calcul des totaux
  const totalM = rows.reduce((sum, row) => sum + num(row.m), 0)
  const totalM1 = rows.reduce((sum, row) => sum + num(row.m1), 0)
  const totalEvol = rows.reduce((sum, row) => sum + num(row.evol), 0)

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
            {/* Ligne de total */}
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 border-b text-xs font-semibold text-gray-800">TOTAL</td>
              <td className="px-1 py-1 border-b text-xs text-right">{fmt(totalM)}</td>
              <td className="px-1 py-1 border-b text-xs text-right">{fmt(totalM1)}</td>
              <td className="px-1 py-1 border-b text-xs text-right">{fmt(totalEvol)}</td>
            </tr>
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

// ?? 6e. Rechargement
interface TabRechargementProps {
  rows: RechargementRow[]
  setRows: React.Dispatch<React.SetStateAction<RechargementRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabRechargement({ rows, setRows, onSave, isSubmitting }: TabRechargementProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) =>
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Rechargement" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6e. Situation Reseaux
interface TabSituationReseauProps {
  rows: SituationReseauRow[]
  setRows: React.Dispatch<React.SetStateAction<SituationReseauRow[]>>
  onSave: () => void
  isSubmitting: boolean
}
function TabSituationReseau({ rows, setRows, onSave, isSubmitting }: TabSituationReseauProps) {
  const update = (index: number, field: "m" | "m1", value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

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
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1} onChange={(e) => update(index, "m1", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m} onChange={(e) => update(index, "m", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveButton onSave={onSave} isSubmitting={isSubmitting} />
    </div>
  )
}

// ?? 6d. Total Encaissement ????????????????????????????????????????????????????
interface TabTotalEncaissementProps {
  rows: TotalEncaissementRow[]
  setRows: React.Dispatch<React.SetStateAction<TotalEncaissementRow[]>>
  onSave: () => void
  isSubmitting: boolean
}

function TabTotalEncaissement({ rows, setRows, onSave, isSubmitting }: TabTotalEncaissementProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) =>
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Encaissement (MDA)" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}
// ?? 6e. Recouvrement ?????????????????????????????????????????????????????????
interface TabRecouvrementProps { rows: RecouvrementRow[]; setRows: React.Dispatch<React.SetStateAction<RecouvrementRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabRecouvrement({ rows, setRows, onSave, isSubmitting }: TabRecouvrementProps) {
  const update = (index: number, field: keyof RecouvrementRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Recouvrement (MDA)</th>
              <th colSpan={1} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">Montant Recouvré</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Montant Mis en Recouvrement</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Montant Recouvré</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">Taux de recouvrement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.designation}-${index}`} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.m1Recouvre} onChange={(e) => update(index, "m1Recouvre", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mMis}       onChange={(e) => update(index, "mMis",       e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mRecouvre}  onChange={(e) => update(index, "mRecouvre",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput value={row.mTaux}      onChange={(e) => update(index, "mTaux",      e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
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
              <tr key={`${row.designation}-${index}`} className={index === rows.length - 1 ? "bg-green-100 font-semibold" : "bg-white"}>
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

// ?? 6f. Parc Abonnés GP ??????????????????????????????????????????????????????
interface TabParcAbonnesGpProps { rows: ParcAbonnesGpRow[]; setRows: React.Dispatch<React.SetStateAction<ParcAbonnesGpRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabParcAbonnesGp({ rows, setRows, onSave, isSubmitting }: TabParcAbonnesGpProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Parc Abonnes GP" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6g. Total Parc Abonnés par Technologie ???????????????????????????????????
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

// ?? 6k. Désactivation ?????????????????????????????????????????????????????????
interface TabDesactivationProps { rows: DesactivationRow[]; setRows: React.Dispatch<React.SetStateAction<DesactivationRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabDesactivation({ rows, setRows, onSave, isSubmitting }: TabDesactivationProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Désactivation" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6l. Résiliation ???????????????????????????????????????????????????????????
interface TabResiliationProps { rows: ResiliationRow[]; setRows: React.Dispatch<React.SetStateAction<ResiliationRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabResiliation({ rows, setRows, onSave, isSubmitting }: TabResiliationProps) {
  const update = (i: number, f: "m" | "m1" | "evol", v: string) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  return <SimpleEvolTable colHeader="Résiliation" rows={rows} update={update} onSave={onSave} isSubmitting={isSubmitting} />
}

// ?? 6m. Chiffre d'Affaires MDA ????????????????????????????????????????????????
interface TabChiffreAffairesMdaProps {
  rows: ChiffreAffairesMdaRow[]
  setRows: React.Dispatch<React.SetStateAction<ChiffreAffairesMdaRow[]>>
  onSave: () => void
  isSubmitting: boolean
}

function TabChiffreAffairesMda({ rows, setRows, onSave, isSubmitting }: TabChiffreAffairesMdaProps) {
  const update = (index: number, field: keyof ChiffreAffairesMdaRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  // ✅ fonction pour convertir en nombre
  const toNumber = (val?: string) => parseFloat(val || "0") || 0

  // ✅ calcul des totaux
  const totals = {
    mObjectif: rows.reduce((sum, r) => sum + toNumber(r.mObjectif), 0),
    mRealise: rows.reduce((sum, r) => sum + toNumber(r.mRealise), 0),
    mTaux: rows.reduce((sum, r) => sum + toNumber(r.mTaux), 0),
    m1Realise: rows.reduce((sum, r) => sum + toNumber(r.m1Realise), 0),
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">
                Chiffre d'Affaires (MDA)
              </th>
              <th colSpan={1} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">
                M-1
              </th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">
                M
              </th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">
                Realise
              </th>
              {["Objectif", "Realise", "Taux"].map((h, i) => (
                <th key={i + 3} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={row.designation} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">
                  {row.designation}
                </td>

                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.mObjectif} onChange={(e) => update(index, "mObjectif", e.target.value)} className="h-7 px-2 text-xs" />
                </td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.mRealise} onChange={(e) => update(index, "mRealise", e.target.value)} className="h-7 px-2 text-xs" />
                </td>
                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.mTaux} onChange={(e) => update(index, "mTaux", e.target.value)} className="h-7 px-2 text-xs" />
                </td>

                <td className="px-1 py-1 border-b">
                  <AmountInput value={row.m1Realise} onChange={(e) => update(index, "m1Realise", e.target.value)} className="h-7 px-2 text-xs" />
                </td>
              </tr>
            ))}

            {/* ✅ Ligne Totale */}
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">
                Totale
              </td>

              <td className="px-3 py-2 border-b text-xs text-right">{totals.mObjectif.toFixed(2)}</td>
              <td className="px-3 py-2 border-b text-xs text-right">{totals.mRealise.toFixed(2)}</td>
              <td className="px-3 py-2 border-b text-xs text-right">{totals.mTaux.toFixed(2)}</td>

              <td className="px-3 py-2 border-b text-xs text-right">{totals.m1Realise.toFixed(2)}</td>
            </tr>
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
  { key: "e_payement",                 label: "E-PAYEMENT (MDA)",                      color: PRIMARY_COLOR, title: "E-PAYEMENT (MDA)" },
  { key: "total_encaissement",             label: "Encaissement (MDA)",                      color: PRIMARY_COLOR, title: "ENCAISSEMENT (MDA)" },
  { key: "rechargement",                   label: "Rechargement",                          color: PRIMARY_COLOR, title: "RECHARGEMENT" },
  { key: "recouvrement",                   label: "Recouvrement",                          color: PRIMARY_COLOR, title: "RECOUVREMENT (MDA)" },
  { key: "parc_abonnes_gp",                label: "Parc Abonnes GP",                       color: PRIMARY_COLOR, title: "PARC ABONNES GP" },
  { key: "total_parc_abonnes_technologie", label: "Total Parc Abonnes par technologie",    color: PRIMARY_COLOR, title: "TOTAL PARC ABONNES PAR TECHNOLOGIE" },
  { key: "activation",                     label: "Activation",                            color: PRIMARY_COLOR, title: "ACTIVATION" },
  { key: "desactivation",                  label: "Désactivation",                         color: PRIMARY_COLOR, title: "DÉSACTIVATION" },
  { key: "resiliation",                    label: "Résiliation",                           color: PRIMARY_COLOR, title: "RÉSILIATION" },
  { key: "chiffre_affaires_mda",           label: "Chiffre d'Affaires (MDA)",              color: PRIMARY_COLOR, title: "CHIFFRE D'AFFAIRES (MDA)" },
]

const KPI_TAB_KEYS = [
  "reclamation",
  "e_payement",
  "total_encaissement",
  "rechargement",
  "recouvrement",
  "parc_abonnes_gp",
  "total_parc_abonnes_technologie",
  "activation",
  "desactivation",
  "resiliation",
  "chiffre_affaires_mda",
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey =
  | "reclamation" | "e_payement"
  | "total_encaissement" | "rechargement" | "situation_reseaux" | "recouvrement"
  | "parc_abonnes_gp" | "total_parc_abonnes_technologie"
  | "activation" | "desactivation" | "resiliation" | "chiffre_affaires_mda"

type tableauCategoryKey =
  | "reclamation" | "e_payment" | "rechargement" | "encaissement" | "recouvrement"
  | "parc_abonnes" | "activation_desactivation_sim" | "chiffre_affaires"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "chiffre_affaires", label: "Chiffre d'affaires",          tabKeys: ["chiffre_affaires_mda"] },
  { key: "parc_abonnes",   label: "Parc abonne",                  tabKeys: ["parc_abonnes_gp", "total_parc_abonnes_technologie"] },
  { key: "activation_desactivation_sim", label: "Activation", tabKeys: ["activation", "desactivation", "resiliation"] },
  { key: "reclamation",    label: "Reclamation",                  tabKeys: ["reclamation"] },
  { key: "e_payment",      label: "E-payment",                    tabKeys: ["e_payement"] },
  { key: "encaissement",   label: "Encaissement",                 tabKeys: ["total_encaissement"] },
  { key: "rechargement",   label: "Rechargement",                 tabKeys: ["rechargement"] },
  { key: "recouvrement",   label: "Recouvrement",                 tabKeys: ["recouvrement"] },
]

const findtableauCategoryKeyForTab = (tabKey: string): tableauCategoryKey =>
  tableau_CATEGORY_OPTIONS.find((c) => c.tabKeys.includes(tabKey as tableauTabKey))?.key ?? "reclamation"

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
  ePayementPopRows?: EPayementRow[]
  totalEncaissementRows?: TotalEncaissementRow[]
  rechargementRows?: RechargementRow[]
  recouvrementRows?: RecouvrementRow[]
  parcAbonnesGpRows?: ParcAbonnesGpRow[]
  totalParcAbonnesTechnologieRows?: TotalParcAbonnesTechnologieRow[]
  activationRows?: ActivationRow[]
  desactivationRows?: DesactivationRow[]
  resiliationRows?: ResiliationRow[]
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

const normalizeEPayementRows = (rows?: EPayementRow[]): EPayementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return EPAYEMENT_CHANNELS.map((rechargement, i) => ({ rechargement, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeRechargementRows = (rows?: RechargementRow[]): RechargementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return RECHARGEMENT_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeTotalEncaissementRows = (rows?: TotalEncaissementRow[]): TotalEncaissementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return TOTAL_ENCAISSEMENT_LABELS.map((designation, i) => ({
    designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol),
  }))
}

const normalizeRecouvrementRows = (rows?: RecouvrementRow[]): RecouvrementRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return RECOUVREMENT_LABELS.map((designation, i) => ({ designation, m1Recouvre: safeString(src[i]?.m1Recouvre), mMis: safeString(src[i]?.mMis), mRecouvre: safeString(src[i]?.mRecouvre), mTaux: safeString(src[i]?.mTaux) }))
}

const normalizeParcAbonnesGpRows = (rows?: ParcAbonnesGpRow[]): ParcAbonnesGpRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return PARC_ABONNES_GP_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeTotalParcAbonnesTechnologieRows = (rows?: TotalParcAbonnesTechnologieRow[]): TotalParcAbonnesTechnologieRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeActivationRows = (rows?: ActivationRow[]): ActivationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return ACTIVATION_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeDesactivationRows = (rows?: DesactivationRow[]): DesactivationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return DESACTIVATION_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeResiliationRows = (rows?: ResiliationRow[]): ResiliationRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return RESILIATION_LABELS.map((designation, i) => ({ designation, m: safeString(src[i]?.m), m1: safeString(src[i]?.m1), evol: safeString(src[i]?.evol) }))
}

const normalizeChiffreAffairesMdaRows = (rows?: ChiffreAffairesMdaRow[]): ChiffreAffairesMdaRow[] => {
  const src = Array.isArray(rows) ? rows : []
  return CHIFFRE_AFFAIRES_MDA_LABELS.map((designation, i) => ({ designation, mObjectif: safeString(src[i]?.mObjectif), mRealise: safeString(src[i]?.mRealise), mTaux: safeString(src[i]?.mTaux), m1Realise: safeString(src[i]?.m1Realise) }))
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.reclamationRows?.length ?? 0) > 0) return "reclamation"
  if ((decl.ePayementPopRows?.length ?? 0) > 0) return "e_payement"
  if ((decl.totalEncaissementRows?.length ?? 0) > 0) return "total_encaissement"
  if ((decl.rechargementRows?.length ?? 0) > 0) return "rechargement"
  if ((decl.recouvrementRows?.length ?? 0) > 0) return "recouvrement"
  if ((decl.parcAbonnesGpRows?.length ?? 0) > 0) return "parc_abonnes_gp"
  if ((decl.totalParcAbonnesTechnologieRows?.length ?? 0) > 0) return "total_parc_abonnes_technologie"
  if ((decl.activationRows?.length ?? 0) > 0) return "activation"
  if ((decl.desactivationRows?.length ?? 0) > 0) return "desactivation"
  if ((decl.resiliationRows?.length ?? 0) > 0) return "resiliation"
  if ((decl.chiffreAffairesMdaRows?.length ?? 0) > 0) return "chiffre_affaires_mda"
  if ((decl as any).desactivationResiliationRows?.length > 0) return "desactivation"
  return "reclamation"
}


// PAGE
function CommercialPageContent() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
  useTableauStepNavigation("commercial")
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
    if (requestedTab && istableauTabKey(requestedTab)) {
      setActiveTab(requestedTab)
      setSelectedCategoryKey(findtableauCategoryKeyForTab(requestedTab))
    }
  }, [])

  // Global meta
  const [activeTab, setActiveTab] = useState<string>(tableau_CATEGORY_OPTIONS[0]?.tabKeys[0] ?? "reclamation")
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<tableauCategoryKey>(tableau_CATEGORY_OPTIONS[0]?.key ?? "reclamation")
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

  // Tab data (lifted) - TABLEAUX CONSERVéS
  const [reclamationRows, setReclamationRows] = useState<ReclamationRow[]>(DEFAULT_RECLAMATION_ROWS.map((row) => ({ ...row })))
  const [ePayementPopRows, setEPayementPopRows] = useState<EPayementRow[]>(createDefaultEPayementRows())
  const [totalEncaissementRows, setTotalEncaissementRows] = useState<TotalEncaissementRow[]>(DEFAULT_TOTAL_ENCAISSEMENT_ROWS.map((row) => ({ ...row })))
  const [rechargementRows, setRechargementRows] = useState<RechargementRow[]>(DEFAULT_RECHARGEMENT_ROWS.map((row) => ({ ...row })))
  const [recouvrementRows, setRecouvrementRows] = useState<RecouvrementRow[]>(DEFAULT_RECOUVREMENT_ROWS.map((row) => ({ ...row })))
  const [parcAbonnesGpRows, setParcAbonnesGpRows] = useState<ParcAbonnesGpRow[]>(DEFAULT_PARC_ABONNES_GP_ROWS.map((row) => ({ ...row })))
  const [totalParcAbonnesTechnologieRows, setTotalParcAbonnesTechnologieRows] = useState<TotalParcAbonnesTechnologieRow[]>(DEFAULT_TOTAL_PARC_ABONNES_TECHNOLOGIE_ROWS.map((row) => ({ ...row })))
  const [activationRows, setActivationRows] = useState<ActivationRow[]>(DEFAULT_ACTIVATION_ROWS.map((row) => ({ ...row })))
  const [desactivationRows, setDesactivationRows] = useState<DesactivationRow[]>(DEFAULT_DESACTIVATION_ROWS.map((row) => ({ ...row })))
  const [resiliationRows, setResiliationRows] = useState<ResiliationRow[]>(DEFAULT_RESILIATION_ROWS.map((row) => ({ ...row })))
  const [chiffreAffairesMdaRows, setChiffreAffairesMdaRows] = useState<ChiffreAffairesMdaRow[]>(DEFAULT_CHIFFRE_AFFAIRES_MDA_ROWS.map((row) => ({ ...row })))
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
      const map = await fetchKpiRowsMap(KPI_TAB_KEYS, "Commerciale")
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

    const parseReclamationLabel = (label: string) => {
      const lower = label.toLowerCase()
      const category: ReclamationRow["category"] = lower.includes("traite") ? "traitees" : "recues"
      const type: ReclamationRow["type"] = lower.includes("b2b") ? "B2B" : "GP"
      return { category, type }
    }

    const reclamationLabels = getLabels("reclamation", DEFAULT_RECLAMATION_LABELS)
    setReclamationRows((prev) => reclamationLabels.map((label, i) => {
      const parsed = parseReclamationLabel(label)
      const row = prev[i]
      return {
        category: parsed.category,
        type: parsed.type,
        mGp: safeString(row?.mGp),
        mB2b: safeString(row?.mB2b),
        m1Gp: safeString(row?.m1Gp),
        m1B2b: safeString(row?.m1B2b),
      }
    }))

    const ePayementPopLabels = getLabels("e_payement", EPAYEMENT_CHANNELS)
    setEPayementPopRows((prev) => ePayementPopLabels.map((rechargement, i) => ({
      rechargement,
      m: safeString(prev[i]?.m),
      m1: safeString(prev[i]?.m1),
      evol: safeString(prev[i]?.evol),
    })))

    const totalEncaissementLabels = getLabels("total_encaissement", TOTAL_ENCAISSEMENT_LABELS)
    setTotalEncaissementRows((prev) => totalEncaissementLabels.map((designation, i) => ({
      designation, m: safeString(prev[i]?.m), m1: safeString(prev[i]?.m1), evol: safeString(prev[i]?.evol),
    })))

    const rechargementLabels = getLabels("rechargement", RECHARGEMENT_LABELS)
    setRechargementRows((prev) => rechargementLabels.map((designation, i) => ({
      designation, m: safeString(prev[i]?.m), m1: safeString(prev[i]?.m1), evol: safeString(prev[i]?.evol),
    })))

    const recouvrementLabels = getLabels("recouvrement", RECOUVREMENT_LABELS)
    setRecouvrementRows((prev) => recouvrementLabels.map((designation, i) => ({
      designation,
      m1Recouvre: safeString(prev[i]?.m1Recouvre),
      mMis: safeString(prev[i]?.mMis),
      mRecouvre: safeString(prev[i]?.mRecouvre),
      mTaux: safeString(prev[i]?.mTaux),
    })))

    const parcGpLabels = getLabels("parc_abonnes_gp", PARC_ABONNES_GP_LABELS)
    setParcAbonnesGpRows((prev) => parcGpLabels.map((designation, i) => ({
      designation,
      m: safeString(prev[i]?.m),
      m1: safeString(prev[i]?.m1),
      evol: safeString(prev[i]?.evol),
    })))

    const totalTechLabels = getLabels("total_parc_abonnes_technologie", TOTAL_PARC_ABONNES_TECHNOLOGIE_LABELS)
    setTotalParcAbonnesTechnologieRows((prev) => totalTechLabels.map((designation, i) => ({
      designation,
      m: safeString(prev[i]?.m),
      m1: safeString(prev[i]?.m1),
      evol: safeString(prev[i]?.evol),
    })))

    const activationLabels = getLabels("activation", ACTIVATION_LABELS)
    setActivationRows((prev) => activationLabels.map((designation, i) => ({
      designation,
      m: safeString(prev[i]?.m),
      m1: safeString(prev[i]?.m1),
      evol: safeString(prev[i]?.evol),
    })))

    const desactivationLabels = getLabels("desactivation", DESACTIVATION_LABELS)
    setDesactivationRows((prev) => desactivationLabels.map((designation, i) => ({
      designation,
      m: safeString(prev[i]?.m),
      m1: safeString(prev[i]?.m1),
      evol: safeString(prev[i]?.evol),
    })))

    const resiliationLabels = getLabels("resiliation", RESILIATION_LABELS)
    setResiliationRows((prev) => resiliationLabels.map((designation, i) => ({
      designation,
      m: safeString(prev[i]?.m),
      m1: safeString(prev[i]?.m1),
      evol: safeString(prev[i]?.evol),
    })))

    const chiffreLabels = getLabels("chiffre_affaires_mda", CHIFFRE_AFFAIRES_MDA_LABELS)
    setChiffreAffairesMdaRows((prev) => chiffreLabels.map((designation, i) => ({
      designation,
      mObjectif: safeString(prev[i]?.mObjectif),
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
      (category) => category.tabKeys.some((tabKey) => availableKeys.has(tabKey)),
    )
  }, [declarationTabs])
  
  const filteredDeclarationTabs = useMemo(() => {
    const selectedCategory = declarationCategoryOptions.find((category) => category.key === selectedCategoryKey)
    if (!selectedCategory) return declarationTabs
    const categoryTabKeys = new Set(selectedCategory.tabKeys)
    return declarationTabs.filter((tab) => categoryTabKeys.has(tab.key as tableauTabKey))
  }, [declarationCategoryOptions, declarationTabs, selectedCategoryKey])
  
  const allowedTabKeys = useDeclarationAccess("commercial", user?.allowedKpis)
  
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
    setSelectedCategoryKey(declarationCategoryOptions[0]?.key ?? "reclamation")
  }, [declarationCategoryOptions, selectedCategoryKey])

  const handleStepClick = (pointKey: string) => {
    const step = getDomainProgressSteps("commercial").find((s) =>
      s.points.some((p) => p.key === pointKey)
    )
    if (step) {
      setSelectedCategoryKey(step.key as tableauCategoryKey)
    }
    setActiveTab(pointKey)
  }

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
      setEPayementPopRows(normalizeEPayementRows(declaration.ePayementPopRows))
      setTotalEncaissementRows(normalizeTotalEncaissementRows(declaration.totalEncaissementRows))
      setRechargementRows(normalizeRechargementRows(declaration.rechargementRows))
      setRecouvrementRows(normalizeRecouvrementRows(declaration.recouvrementRows))
      setParcAbonnesGpRows(normalizeParcAbonnesGpRows(declaration.parcAbonnesGpRows))
      setTotalParcAbonnesTechnologieRows(normalizeTotalParcAbonnesTechnologieRows(declaration.totalParcAbonnesTechnologieRows))
      setActivationRows(normalizeActivationRows(declaration.activationRows))
      setDesactivationRows(normalizeDesactivationRows(declaration.desactivationRows))
      setResiliationRows(normalizeResiliationRows(declaration.resiliationRows))
      setChiffreAffairesMdaRows(normalizeChiffreAffairesMdaRows(declaration.chiffreAffairesMdaRows))
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

    // Validation des champs pour les tableaux conservés
    let validationError = false
    switch (tabKey) {
      case "reclamation":
        if (reclamationRows.some((r) => !r.mGp && !r.mB2b && !r.m1Gp && !r.m1B2b)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Reclamation.", variant: "destructive" })
          validationError = true
        }
        break
      case "e_payement":
        if (ePayementPopRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau E-PAYEMENT (MDA).", variant: "destructive" })
          validationError = true
        }
        break
      case "total_encaissement":
        if (totalEncaissementRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les valeurs du tableau Encaissement (MDA).", variant: "destructive" })
          validationError = true
        }
        break
      case "rechargement":
        if (rechargementRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Rechargement.", variant: "destructive" })
          validationError = true
        }
        break
      case "recouvrement":
        if (recouvrementRows.some((row) => !row.m1Recouvre || !row.mMis || !row.mRecouvre || !row.mTaux)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Recouvrement.", variant: "destructive" })
          validationError = true
        }
        break
      case "parc_abonnes_gp":
        if (parcAbonnesGpRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Parc Abonnes GP.", variant: "destructive" })
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
      case "desactivation":
        if (desactivationRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Désactivation.", variant: "destructive" })
          validationError = true
        }
        break
      case "resiliation":
        if (resiliationRows.some((row) => !row.m || !row.m1 || !row.evol)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Résiliation.", variant: "destructive" })
          validationError = true
        }
        break
      case "chiffre_affaires_mda":
        if (chiffreAffairesMdaRows.some((row) => !row.mObjectif || !row.mRealise || !row.mTaux || !row.m1Realise)) {
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
      ePayementPopRows: [],
      totalEncaissementRows: [],
      rechargementRows: [],
      recouvrementRows: [],
      parcAbonnesGpRows: [],
      totalParcAbonnesTechnologieRows: [],
      activationRows: [],
      desactivationRows: [],
      resiliationRows: [],
      chiffreAffairesMdaRows: [],
    }
    
    switch (tabKey) {
      case "reclamation":
        baseDecl.reclamationRows = reclamationRows
        break
      case "e_payement":
        baseDecl.ePayementPopRows = ePayementPopRows
        break
      case "total_encaissement":
        baseDecl.totalEncaissementRows = totalEncaissementRows
        break
      case "rechargement":
        baseDecl.rechargementRows = rechargementRows
        break
      case "recouvrement":
        baseDecl.recouvrementRows = recouvrementRows
        break
      case "parc_abonnes_gp":
        baseDecl.parcAbonnesGpRows = parcAbonnesGpRows
        break
      case "total_parc_abonnes_technologie":
        baseDecl.totalParcAbonnesTechnologieRows = totalParcAbonnesTechnologieRows
        break
      case "activation":
        baseDecl.activationRows = activationRows
        break
      case "desactivation":
        baseDecl.desactivationRows = desactivationRows
        break
      case "resiliation":
        baseDecl.resiliationRows = resiliationRows
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
      switch (tabKey) {
        case "reclamation": tabData = { reclamationRows }; break
        case "e_payement": tabData = { ePayementPopRows }; break
        case "total_encaissement": tabData = { totalEncaissementRows }; break
        case "rechargement": tabData = { rechargementRows }; break
        case "recouvrement": tabData = { recouvrementRows }; break
        case "parc_abonnes_gp": tabData = { parcAbonnesGpRows }; break
        case "total_parc_abonnes_technologie": tabData = { totalParcAbonnesTechnologieRows }; break
        case "activation": tabData = { activationRows }; break
        case "desactivation": tabData = { desactivationRows }; break
        case "resiliation": tabData = { resiliationRows }; break
        case "chiffre_affaires_mda": tabData = { chiffreAffairesMdaRows }; break
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

      const created = await createResponse.json().catch(() => ({}))
      const newId = Number((created as { id?: unknown }).id ?? 0)
      if (newId) {
        settableauDeclarations((prev) => {
          const filtered = prev.filter((d) => !(d.mois === mois && d.annee === annee && d.direction === saveDirection && d.tabKey === tabKey))
          return [...filtered, {
            id: newId,
            tabKey,
            mois,
            annee,
            direction: saveDirection,
            dataJson: JSON.stringify(tabData),
          }]
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
      case "reclamation":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Tableau Reclamation</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabReclamation rows={reclamationRows} setRows={setReclamationRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "e_payement":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>E-PAYEMENT (MDA)</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabEPayementSingle
                title="E-PAYEMENT (MDA)"
                rows={ePayementPopRows}
                setRows={setEPayementPopRows}
                onSave={() => handleSave(tabKey)}
                isSubmitting={isSubmitting}
              />

            </CardContent>
          </Card>
        )
      case "total_encaissement":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Encaissement (MDA)</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabTotalEncaissement rows={totalEncaissementRows} setRows={setTotalEncaissementRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "rechargement":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Rechargement</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabRechargement rows={rechargementRows} setRows={setRechargementRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "recouvrement":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Recouvrement (MDA)</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabRecouvrement rows={recouvrementRows} setRows={setRecouvrementRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "parc_abonnes_gp":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Parc Abonnes GP</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabParcAbonnesGp rows={parcAbonnesGpRows} setRows={setParcAbonnesGpRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "total_parc_abonnes_technologie":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Total Parc Abonnes parc technologie</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabTotalParcAbonnesTechnologie rows={totalParcAbonnesTechnologieRows} setRows={setTotalParcAbonnesTechnologieRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "activation":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Activation</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabActivation rows={activationRows} setRows={setActivationRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "desactivation":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Désactivation</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabDesactivation rows={desactivationRows} setRows={setDesactivationRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "resiliation":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Résiliation</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabResiliation rows={resiliationRows} setRows={setResiliationRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      case "chiffre_affaires_mda":
        return (
          <Card key={tabKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Chiffre d'Affaires (MDA)</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDisabledNotice(tabKey)}
              {renderExistingWarning(tabKey)}
              <TabChiffreAffairesMda rows={chiffreAffairesMdaRows} setRows={setChiffreAffairesMdaRows} onSave={() => handleSave(tabKey)} isSubmitting={isSubmitting} />

            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <LayoutWrapper user={user}>
      <DomainAccessGuard user={user} domainKey="commercial">
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
              title="Tableaux Commercial"
              domain="commercial"
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
                domain="commercial"
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
      <CommercialPageContent />
    </Suspense>
  )
}