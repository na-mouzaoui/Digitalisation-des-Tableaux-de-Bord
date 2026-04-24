"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Save } from "lucide-react"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import { API_BASE } from "@/lib/config"

const PRIMARY_COLOR = "#2db34b"


const getCurrenttableauPeriod = (now: Date = new Date()) => ({
  mois: String(now.getMonth() + 1).padStart(2, "0"),
  annee: String(now.getFullYear()),
})
const gettableauPeriodLockMessage = (mois: string, annee: string, _role?: string | null) => `P?riode ${mois}/${annee}.`
const istableauPeriodLocked = (_mois: string, _annee: string, _role?: string | null) => false
const synctableauPolicy = async (_direction?: string | null) => null
const isAdmintableauRole = (_role?: string | null) => false
const isRegionaltableauRole = (_role?: string | null) => false
const isFinancetableauRole = (_role?: string | null) => false
const getManageabletableauTabKeysForDirection = () => ["encaissement"]
const istableauTabDisabledByPolicy = (_tabKey?: string) => false


// _______________________________________
// 3. HELPERS DE FORMATAGE DES MONTANTS
// _______________________________________
const fmt = (v: number | string) => {
  if (v === "" || isNaN(Number(v))) return ""
  const num = Number(v)
  const [intPart, decPart] = num.toFixed(2).split(".")
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${formattedInt},${decPart}`
}

const normalizeAmountInput = (value: string) => {
  const raw = value.replace(/\u00A0/g, " ").trim()
  if (!raw) return ""
  const hasTrailingSeparator = /[.,]$/.test(raw)
  const standardized = raw.replace(/\s/g, "").replace(/,/g, ".")
  const cleaned = standardized.replace(/[^0-9.]/g, "")
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
  const groupedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  if (hasTrailingDot) return `${groupedIntegerPart},`
  return decimalPart ? `${groupedIntegerPart},${decimalPart}` : groupedIntegerPart
}

const num = (v: string) => {
  const normalized = normalizeAmountInput(v)
  const parseReady = normalized.endsWith(".") ? normalized.slice(0, -1) : normalized
  return parseFloat(parseReady) || 0
}


// _______________________________________
// 4. COMPOSANT G?N?RIQUE : AmountInput
//    Input r?utilisable pour la saisie de montants.
// _______________________________________
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
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={formatAmountInput(value)}
      onChange={handleChange}
    />
  )
}


// _____________________________________________________________________________
// 5. TYPES ET TABLEAUX DE L'ONGLET é ENCAISSEMENT é
//
//     GUIDE : AJOUTER UN NOUVEAU TABLEAU _________________
//    |  Pour chaque nouveau tableau dans un onglet :                         |
//    |  a) D?clarez son interface de donn?es ici (ex: interface MonTableau)  |
//    |  b) Cr?ez son composant Tab* ci-dessous (section 6)                   |
//    |  c) Ajoutez son ?tat dans le state de la page (section 9)             |
//    |  d) Incluez ses donn?es dans handleSave (section 10)                  |
//    |  e) Rendez-le dans le TabsContent concern? (section 11)               |
//    ____________________________________
// _____________________________________________________________________________

// _ 5a. TYPE : ligne du tableau Encaissement _______________
//    Pour ajouter des colonnes : ajoutez des champs ici ET dans
//    normalizeEncaissementData (section 8b) ET dans TabTotalEncaissement.

// _ (MODELE) Pour un futur tableau, copiez ce bloc et adaptez-le : _____
//
// interface MonNouveauTableauRow {
//   col1: string
//   col2: string
//   // ... autant de colonnes que n?cessaire
// }

interface TotalEncaissementRow {
  mGp: string    // Colonne M-1 / GP
  mB2b: string   // Colonne M-1 / B2B
  m1Gp: string   // Colonne M   / GP
  m1B2b: string  // Colonne M   / B2B
  evol: string   // Colonne ?volution
}

interface ParcAbonneRow {
  label: string    // Parc Abonn?s B2B
  m1: string   // Colonne M-1 
  m: string   // Colonne M
  evol: string   // Colonne ?volution
}


// _______________________________________
// 6. COMPOSANTS DE TABLEAUX
//    Chaque tableau est un composant autonome.
//    Vous pouvez en empiler plusieurs dans un méme TabsContent (section 11).
// _______________________________________

// _ 6a. TABLEAU : Encaissement ________________________

// _ (MODELE) Pour ajouter un 2e tableau dans l'onglet Encaissement : _____
//
// interface TabMonDeuxiemeTableauProps {
//   rows: MonDeuxiemeTableauRow[]
//   setRows: React.Dispatch<React.SetStateAction<MonDeuxiemeTableauRow[]>>
// }
//
// function TabMonDeuxiemeTableau({ rows, setRows }: TabMonDeuxiemeTableauProps) {
//   return (
//     <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
//       <table className="min-w-full text-sm">
//         <thead>...</thead>
//         <tbody>
//           {rows.map((row, i) => (
//             <tr key={i}>
//               {/* vos cellules ici */}
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   )
// }

// TAB Ecaissemnet 
interface TabTotalEncaissementProps {
  row: TotalEncaissementRow
  setRow: React.Dispatch<React.SetStateAction<TotalEncaissementRow>>
  onSave: () => void
  isSubmitting: boolean
}

function TabTotalEncaissement({ row, setRow, onSave, isSubmitting }: TabTotalEncaissementProps) {
  const update = (field: keyof TotalEncaissementRow, value: string) =>
    setRow((prev) => ({ ...prev, [field]: value }))

  // Ligne de total (ici identique a la ligne de saisie ??" adaptez si besoin)
  const totals = useMemo(() => ({
    mGp:  row.mGp  || "0",
    mB2b: row.mB2b || "0",
    m1Gp: row.m1Gp || "0",
    m1B2b:row.m1B2b|| "0",
    evol: row.evol || "-",
  }), [row])

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-4 text-center text-xs font-semibold text-gray-700 border-b border-r align-middle">
                Encaissement (MDA)
              </th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
              <th rowSpan={2} className="px-3 py-4 text-center text-xs font-semibold text-gray-700 border-b align-middle">Evol</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">B2B</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b">GP</th>
              <th className="px-3 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r">B2B</th>
            </tr>
          </thead>
          <tbody>
            {/* _ Ligne de saisie _ */}
            <tr className="bg-white">
              <td className="px-1 py-1 border-b"><AmountInput value={row.mGp}  onChange={(e) => update("mGp",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.mB2b} onChange={(e) => update("mB2b", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.m1Gp} onChange={(e) => update("m1Gp", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.m1B2b}onChange={(e) => update("m1B2b",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><Input value={row.evol} onChange={(e) => update("evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="-" /></td>
            </tr>
            {/* _ Ligne de total (fond vert) _ */}
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 border-b text-xs text-right">{fmt(totals.mGp)}</td>
              <td className="px-3 py-2 border-b text-xs text-right">{fmt(totals.mB2b)}</td>
              <td className="px-3 py-2 border-b text-xs text-right">{fmt(totals.m1Gp)}</td>
              <td className="px-3 py-2 border-b text-xs text-right">{fmt(totals.m1B2b)}</td>
              <td className="px-3 py-2 border-b text-xs text-center">{totals.evol}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* _ Bouton Enregistrer (un seul par onglet suffit) _ */}
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}


//Tab : Parc Abonn?s B2B
// _ 6b. TABLEAU : Parc Abonn?s B2B ______________________
interface TabParcAbonneProps {
  rows: ParcAbonneRow[]
  setRows: React.Dispatch<React.SetStateAction<ParcAbonneRow[]>>
  onSave: () => void
  isSubmitting: boolean
}

function TabParcAbonne({ rows, setRows, onSave, isSubmitting }: TabParcAbonneProps) {
  const updateRow = (index: number, field: keyof Omit<ParcAbonneRow, "label">, value: string) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    )
  }

  // Calcul automatique de la ligne TOTAL
  const totalM    = rows.slice(0, -1).reduce((acc, r) => acc + num(r.m),   0)
  const totalM1   = rows.slice(0, -1).reduce((acc, r) => acc + num(r.m1),  0)
  const totalEvol = totalM > 0
    ? `${(((totalM1 - totalM) / totalM) * 100).toFixed(1)}%`
    : "-"

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border-b border-r">
              Parc Abonn?s B2B
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border-b border-r">M+1</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border-b">Evol</th>
          </tr>
        </thead>
        <tbody>
          {/* _ Lignes ?ditables (toutes sauf TOTAL) _ */}
          {rows.slice(0, -1).map((row, i) => (
            <tr key={row.label} className="bg-white hover:bg-gray-50 transition-colors">
              {/* Libell? non ?ditable */}
              <td className="px-3 py-1 border-b border-r text-xs font-medium text-gray-700 whitespace-nowrap">
                {row.label}
              </td>
              <td className="px-1 py-1 border-b border-r">
                <AmountInput
                  value={row.m}
                  onChange={(e) => updateRow(i, "m", e.target.value)}
                  className="h-7 px-2 text-xs"
                  placeholder="0"
                />
              </td>
              <td className="px-1 py-1 border-b border-r">
                <AmountInput
                  value={row.m1}
                  onChange={(e) => updateRow(i, "m1", e.target.value)}
                  className="h-7 px-2 text-xs"
                  placeholder="0"
                />
              </td>
              <td className="px-1 py-1 border-b">
                <Input
                  value={row.evol}
                  onChange={(e) => updateRow(i, "evol", e.target.value)}
                  className="h-7 px-2 text-xs"
                  placeholder="-"
                />
              </td>
            </tr>
          ))}

          {/* _ Ligne TOTAL (calcul?e automatiquement, fond vert) _ */}
          <tr className="bg-green-100 font-semibold">
            <td className="px-3 py-2 text-xs font-bold text-gray-800 border-t border-r">TOTAL</td>
            <td className="px-3 py-2 text-xs text-right border-t border-r">{fmt(totalM)}</td>
            <td className="px-3 py-2 text-xs text-right border-t border-r">{fmt(totalM1)}</td>
            <td className="px-3 py-2 text-xs text-center border-t">{totalEvol}</td>
          </tr>
        </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// _______________________________________
// 7. CONFIGURATION DES ONGLETS
//    Ajoutez une entr?e ici pour chaque nouvel onglet (ex: "recouvrement").
//    key   ??' identifiant technique (doit correspondre a TabsContent value=)
//    label ??' texte affich? dans le TabsTrigger
//    color ??' couleur d'accentuation (optionnel)
//    title ??' titre imprim? sur le PDF
// _______________________________________
const TABS = [
  { key: "encaissement", label: "Encaissement", color: "#2db34b", title: "ENCAISSEMENT" },
  { key: "parc", label: "Parc", color: "#0093f5", title: "PARC" }
  // { key: "recouvrement", label: "Recouvrement", color: "#e67e22", title: "RECOUVREMENT" },
]

type tableauTabKey = "encaissement"| "parc" // ??? ajoutez vos nouvelles cl?s ici avec | "recouvrement"

const MONTHS = [
  { value: "01", label: "Janvier" },   { value: "02", label: "Fevrier" },
  { value: "03", label: "Mars" },      { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },       { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },   { value: "08", label: "Aout" },
  { value: "09", label: "Septembre" }, { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },  { value: "12", label: "Decembre" },
]

const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_tableau_PERIOD = getCurrenttableauPeriod()
const YEARS = Array.from({ length: 101 }, (_, i) => (2000 + i).toString())


// _______________________________________
// 8. TYPES & HELPERS D'API / STOCKAGE
// _______________________________________

// _ 8a. Type du tableau sauvegard? en localStorage _________
//    Ajoutez un champ *Data pour chaque nouveau tableau :
//    ex: recouvrementData?: MonNouveauTableauRow
interface Savedtableau {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  encaissementData?: TotalEncaissementRow
  parcAbonneData?: ParcAbonneRow[] 

  // recouvrementData?: MonNouveauTableauRow  // ??? d?commenter pour un nouveau tableau
}

// _ 8b. Type retourn? par l'API _______________________
type Apitableautableau = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

// _ 8c. Helpers de normalisation ______________________
const safeString = (value: unknown) => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

// _ (MODELE) Copiez-collez pour un nouveau tableau : _____________
// const normalizeMonNouveauTableauData = (data?: MonNouveauTableauRow): MonNouveauTableauRow => {
//   if (data && typeof data === "object") {
//     return { col1: safeString(data.col1), col2: safeString(data.col2) }
//   }
//   return { col1: "", col2: "" }
// }


const normalizeEncaissementData = (data?: TotalEncaissementRow): TotalEncaissementRow => {
  if (data && typeof data === "object") {
    return {
      mGp:  safeString(data.mGp),
      mB2b: safeString(data.mB2b),
      m1Gp: safeString(data.m1Gp),
      m1B2b:safeString(data.m1B2b),
      evol: safeString(data.evol),
    }
  }
  return { mGp: "", mB2b: "", m1Gp: "", m1B2b: "", evol: "" }
}

const DEFAULT_PARC_ABONNE_ROWS: ParcAbonneRow[] = [
  { label: "Postpaid B2B", m: "", m1: "", evol: "" },
  { label: "Prepaid B2B",  m: "", m1: "", evol: "" },
  { label: "TOTAL",        m: "", m1: "", evol: "" }, // ligne calcul?e, non utilis?e au chargement
]

const normalizeParcAbonneRows = (data?: ParcAbonneRow[]): ParcAbonneRow[] => {
  if (Array.isArray(data) && data.length >= 2) {
    // On recharge uniquement les 2 lignes ?ditables, le TOTAL est recalcul?
    return [
      { label: "Postpaid B2B", m: safeString(data[0]?.m), m1: safeString(data[0]?.m1), evol: safeString(data[0]?.evol) },
      { label: "Prepaid B2B",  m: safeString(data[1]?.m), m1: safeString(data[1]?.m1), evol: safeString(data[1]?.evol) },
      { label: "TOTAL",        m: "", m1: "", evol: "" },
    ]
  }
  return DEFAULT_PARC_ABONNE_ROWS.map((r) => ({ ...r }))
}


const normalizeMonthValue = (value: string) =>
  MONTHS.some((m) => m.value === value) ? value : String(new Date().getMonth() + 1).padStart(2, "0")

const normalizeYearValue = (value: string) =>
  YEARS.includes(value) ? value : String(CURRENT_YEAR)


// _______________________________________
// 9. COMPOSANT ZONE D'IMPRESSION (PDF)
//    Ajoutez ici chaque tableau a inclure dans le PDF.
// _______________________________________



// _______________________________________
// 10. PAGE PRINCIPALE
// _______________________________________
export default function NouvelletableauPage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
  const [editQuery, setEditQuery] = useState<{ editId: string; tab: string }>({ editId: "", tab: "" })

  // _ 10a. Chargement des r?gions ______________________
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

  // _ 10b. Lecture des query params (editId, mois, annee) __________
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const requestedMois = safeString(params.get("mois")).trim()
    if (requestedMois) setMois(normalizeMonthValue(requestedMois))
    const requestedAnnee = safeString(params.get("annee")).trim()
    if (requestedAnnee) setAnnee(normalizeYearValue(requestedAnnee))
    setEditQuery({
      editId: safeString(params.get("editId")).trim(),
      tab:    safeString(params.get("tab")).trim(),
    })
  }, [])

  // _ 10c. STATE GLOBAL ___________________________
  const [activeTab, setActiveTab] = useState("encaissement")
  const [direction, setDirection] = useState("")
  const [mois, setMois] = useState(INITIAL_tableau_PERIOD.mois)
  const [annee, setAnnee] = useState(INITIAL_tableau_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingtableauId, setEditingtableauId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [tableauPolicyRevision, settableauPolicyRevision] = useState(0)

  // _ 10d. STATE DES DONN?ES DE TABLEAUX __________________
  //    Ajoutez un useState par tableau suppl?mentaire ici.
    // const [recouvrementRows, setRecouvrementRows] = useState<MonNouveauTableauRow[]>([])
  const [encaissementRow, setEncaissementRow] = useState<TotalEncaissementRow>({
    mGp: "", mB2b: "", m1Gp: "", m1B2b: "", evol: "",
  })
  const [parcAbonneRows, setParcAbonneRows] = useState<ParcAbonneRow[]>(
  DEFAULT_PARC_ABONNE_ROWS.map((r) => ({ ...r }))
)


  // _ 10e. STATE API ____________________________
  const [tableautableaux, settableau] = useState<Apitableautableau[]>([])

  // _ 10f. Logique de réles et d'onglets __________________
  const userRole = user?.role ?? ""
  const isAdminRole    = isAdmintableauRole(userRole)
  const isRegionalRole = isRegionaltableauRole(userRole)
  const isFinanceRole  = isFinancetableauRole(userRole)
  const adminSelectedDirection = safeString(direction).trim()

  const manageableTabKeys = useMemo(() => new Set(getManageabletableauTabKeysForDirection()), [tableauPolicyRevision])
  const availableTabs     = useMemo(() => TABS.filter((tab) => manageableTabKeys.has(tab.key)), [manageableTabKeys])
  const disabledTabKeys   = useMemo(() => new Set(availableTabs.filter((t) => istableauTabDisabledByPolicy(t.key)).map((t) => t.key)), [availableTabs, tableauPolicyRevision])
  const selectableTabs    = useMemo(() => availableTabs.map((tab) => ({ ...tab, isDisabled: disabledTabKeys.has(tab.key) })), [availableTabs, disabledTabKeys])
  const tableauTabs   = selectableTabs

  const selectableYears  = useMemo(() => YEARS.filter((y) => MONTHS.some((m) => !istableauPeriodLocked(m.value, y, userRole))), [tableauPolicyRevision, userRole])
  const selectableMonths = useMemo(() => MONTHS.filter((m) => !istableauPeriodLocked(m.value, annee, userRole)), [annee, tableauPolicyRevision, userRole])

  const hastableauTabAccess  = tableauTabs.length > 0
  const isActiveTabDisabled = disabledTabKeys.has(activeTab)

  // _ 10g. R?solution de la direction selon le réle _____________
  const resolveDirectionForRole = useCallback(
    (fallbackDirection = "") => {
      const normalized = safeString(fallbackDirection).trim()
      if (isRegionalRole) return safeString(user?.region ?? user?.direction ?? "").trim() || normalized
      if (isFinanceRole)  return "Siege"
      return normalized
    },
    [isRegionalRole, isFinanceRole, user],
  )

  const effectiveDirection = resolveDirectionForRole(
    safeString(direction).trim() || safeString(user?.direction).trim() || "Siege"
  )

  // _ 10h. Synchronisation de la politique tableau _____________
  useEffect(() => {
    if (!userRole) return
    let cancelled = false
    const run = async () => {
      await synctableauPolicy(isAdminRole ? adminSelectedDirection : undefined)
      if (!cancelled) settableauPolicyRevision((p) => p + 1)
    }
    run()
    return () => { cancelled = true }
  }, [adminSelectedDirection, isAdminRole, userRole])

  // _ 10i. Correction automatique mois/ann?e hors plage ___________
  useEffect(() => {
    if (!selectableYears.includes(annee)) {
      const fb = selectableYears[0]
      if (fb) { setAnnee(fb); return }
    }
    if (!selectableMonths.some((m) => m.value === mois)) {
      const fb = selectableMonths[0]?.value
      if (fb) setMois(fb)
    }
  }, [annee, mois, selectableMonths, selectableYears])

  // _ 10j. Auto-set direction selon le réle _________________
  useEffect(() => {
    if (!user || isAdminRole) return
    setDirection((prev) => resolveDirectionForRole(prev))
  }, [user, isAdminRole, resolveDirectionForRole])

  // _ 10k. Chargement des tableaux depuis l'API _____________
  useEffect(() => {
    if (!user || status !== "authenticated") { settableau([]); return }
    let cancelled = false
    const load = async () => {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
        const res = await fetch(`${API_BASE}/api/tableau`, {
          method: "GET", credentials: "include", cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) { if (!cancelled) settableau([]); return }
        const payload = await res.json().catch(() => null)
        const tableaux = Array.isArray(payload)
          ? payload.map((item) => ({
              id:        Number((item as any).id ?? 0),
              tabKey:    String((item as any).tabKey ?? "").trim().toLowerCase(),
              mois:      String((item as any).mois ?? "").trim(),
              annee:     String((item as any).annee ?? "").trim(),
              direction: String((item as any).direction ?? "").trim(),
              dataJson:  String((item as any).dataJson ?? "{}"),
            }))
          : []
        if (!cancelled) settableau(tableaux)
      } catch {
        if (!cancelled) settableau([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [status, user])

  // _ 10l. Chargement d'un tableau existant pour ?dition _______
  useEffect(() => {
    if (isLoading || status !== "authenticated" || !user) return
    if (!editQuery.editId) {
      setEditingtableauId(null)
      setEditingCreatedAt("")
      setEditingSourceMois("")
      setEditingSourceAnnee("")
      return
    }
    try {
      const parsed = JSON.parse(localStorage.getItem("tableau_tableaux") ?? "[]")
      const tableaux = Array.isArray(parsed) ? (parsed as Savedtableau[]) : []
      const decl = tableaux.find((item) => safeString(item.id) === editQuery.editId)
      if (!decl) {
        toast({ title: "tableau introuvable", description: "La tableau demandee n'existe pas.", variant: "destructive" })
        return
      }
      const scopedDirection = isAdminRole ? safeString(decl.direction).trim() : resolveDirectionForRole(safeString(decl.direction).trim())
      setEditingtableauId(safeString(decl.id) || editQuery.editId)
      setEditingCreatedAt(safeString(decl.createdAt) || new Date().toISOString())
      setDirection(scopedDirection)
      const loadedMois  = normalizeMonthValue(safeString(decl.mois))
      const loadedAnnee = normalizeYearValue(safeString(decl.annee))
      setMois(loadedMois)
      setAnnee(loadedAnnee)
      setEditingSourceMois(loadedMois)
      setEditingSourceAnnee(loadedAnnee)

      // Restauration des donn?es par tableau
      // setRecouvrementRows(normalizeMonNouveauTableauData(decl.recouvrementData)) // ??? nouveau tableau
      setEncaissementRow(normalizeEncaissementData(decl.encaissementData))
      setParcAbonneRows(normalizeParcAbonneRows(decl.parcAbonneData))
    } catch {
      toast({ title: "Erreur de chargement", description: "Impossible de charger la tableau.", variant: "destructive" })
    }
  }, [editQuery.editId, editQuery.tab, isAdminRole, isLoading, resolveDirectionForRole, router, status, user])

  // _ 10m. Garde d'authentification _____________________
  if (isLoading || !user || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  // _ 10n. SAUVEGARDE (handleSave) _____________________
  //    Pour ajouter les donn?es d'un nouveau tableau :
  //    1. Incluez-les dans `baseDecl` (champ *Data)
  //    2. Incluez-les dans `tabData` envoy? a l'API
  const handleSave = async () => {
    const saveDirection = effectiveDirection

    // Validations de p?riode / onglet
    if (isActiveTabDisabled) {
      toast({ title: "Tableau desactive", description: "Le tableau selectionne est desactive.", variant: "destructive" }); return
    }
    if (!selectableYears.includes(annee) || !selectableMonths.some((m) => m.value === mois)) {
      toast({ title: "Periode cloturee", description: "Le mois ou l'annee selectionne(e) est hors delai.", variant: "destructive" }); return
    }
    if (!mois)  { toast({ title: "Mois requis",   description: "Veuillez selectionner le mois.",   variant: "destructive" }); return }
    if (!annee) { toast({ title: "Annee requise", description: "Veuillez selectionner l'annee.", variant: "destructive" }); return }

    const isSourceLocked = !!editingtableauId && !!editingSourceMois && !!editingSourceAnnee
      && istableauPeriodLocked(editingSourceMois, editingSourceAnnee, userRole)
    if (isSourceLocked) {
      toast({ title: "Periode cloturee", description: `${gettableauPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification autorisee.`, variant: "destructive" }); return
    }
    if (istableauPeriodLocked(mois, annee, userRole)) {
      toast({ title: "Periode cloturee", description: `${gettableauPeriodLockMessage(mois, annee, userRole)} Aucune creation ou modification autorisee.`, variant: "destructive" }); return
    }

    // R?cup?ration du cache local
    let existingtableaux: Savedtableau[] = []
    try {
      const parsed = JSON.parse(localStorage.getItem("tableau_tableaux") ?? "[]")
      existingtableaux = Array.isArray(parsed) ? (parsed as Savedtableau[]) : []
    } catch { existingtableaux = [] }

    const originaltableau = editingtableauId
      ? existingtableaux.find((item) => safeString(item.id) === editingtableauId) ?? null
      : null

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 400))

    const tableauId        = editingtableauId ?? Date.now().toString()
    const tableauCreatedAt = editingCreatedAt || new Date().toISOString()

    // _ Objet de tableau sauvegard? localement _
    //    Ajoutez ici les donn?es de chaque nouveau tableau (ex: recouvrementData)
    const baseDecl: Savedtableau = {
      id: tableauId,
      createdAt: tableauCreatedAt,
      direction: saveDirection,
      mois,
      annee,
      encaissementData: encaissementRow,
      parcAbonneData: parcAbonneRows.slice(0, 2),
      
      // recouvrementData: recouvrementRows,
    }

    // Mise a jour du cache localStorage
    try {
      if (editingtableauId) {
        const hasTarget = existingtableaux.some((item) => safeString(item.id) === editingtableauId)
        const updated = hasTarget
          ? existingtableaux.map((item) => safeString(item.id) === editingtableauId ? baseDecl : item)
          : [baseDecl, ...existingtableaux]
        localStorage.setItem("tableau_tableaux", JSON.stringify(updated))
      } else {
        localStorage.setItem("tableau_tableaux", JSON.stringify([baseDecl, ...existingtableaux]))
      }
    } catch { /* quota ou SSR */ }

    // _ Persistance en base de donn?es _
    try {
      const apiBase = API_BASE
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null

      // Ajoutez ici les donn?es de chaque nouveau tableau dans tabData
      const tabData = {
        encaissementData: encaissementRow,
        parcAbonneData: parcAbonneRows.slice(0, 2),
        // recouvrementData: recouvrementRows,
      }

      const requestPayload = {
        tabKey: activeTab,
        mois,
        annee,
        direction: saveDirection,
        dataJson: JSON.stringify(tabData),
      }

      // Suppression de l'ancienne version si modification
      if (editingtableauId) {
        const deleteRes = await fetch(`${apiBase}/api/tableau/${encodeURIComponent(editingtableauId)}`, {
          method: "DELETE", credentials: "include",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        if (!deleteRes.ok && deleteRes.status !== 404) {
          const errPayload = await deleteRes.json().catch(() => ({}))
          const errMsg = (errPayload as any)?.message ?? "Erreur lors de la suppression"
          try { localStorage.setItem("tableau_tableaux", JSON.stringify(existingtableaux)) } catch {}
          setIsSubmitting(false)
          toast({ title: "Erreur de modification", description: String(errMsg), variant: "destructive" })
          return
        }
      }

      // Cr?ation
      const createRes = await fetch(`${apiBase}/api/tableau`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(requestPayload),
      })

      if (!createRes.ok) {
        const errPayload = await createRes.json().catch(() => ({}))
        const errMsg = (errPayload as any)?.message ?? "Erreur lors de l'enregistrement"

        // Tentative de restauration
        let restoreOk = false
        if (editingtableauId && originaltableau) {
          const restoreTabData = { encaissementData: originaltableau.encaissementData ?? { mGp: "", mB2b: "", m1Gp: "", m1B2b: "", evol: "" } }
          const restoreRes = await fetch(`${apiBase}/api/tableau`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ tabKey: activeTab, mois: originaltableau.mois, annee: originaltableau.annee, direction: originaltableau.direction, dataJson: JSON.stringify(restoreTabData) }),
          })
          restoreOk = restoreRes.ok
        }

        try { localStorage.setItem("tableau_tableaux", JSON.stringify(existingtableaux)) } catch {}
        setIsSubmitting(false)
        toast({
          title: "Erreur d'enregistrement",
          description: restoreOk ? `${errMsg} L'ancien tableau a ?t? restaur?.` : String(errMsg),
          variant: "destructive",
        })
        return
      }
    } catch (error) {
      try { localStorage.setItem("tableau_tableaux", JSON.stringify(existingtableaux)) } catch {}
      setIsSubmitting(false)
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible de contacter le serveur", variant: "destructive" })
      return
    }

    toast({
      title: editingtableauId ? "tableau modifiee" : "tableau enregistree",
      description: `La tableau "Encaissement" a ete sauvegardee avec succes.`,
    })
    setIsSubmitting(false)
    router.push("/tableau_dashbord")
  }

  // _ 10o. Message de verrouillage de p?riode ________________
  const currentPeriodLockMessage = (() => {
    if (editingtableauId && editingSourceMois && editingSourceAnnee && istableauPeriodLocked(editingSourceMois, editingSourceAnnee, userRole))
      return `${gettableauPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification n'est autorisee.`
    if (istableauPeriodLocked(mois, annee, userRole))
      return `${gettableauPeriodLockMessage(mois, annee, userRole)} Aucune creation ou modification n'est autorisee.`
    return ""
  })()


  // _____________________________________
  // 11. RENDU JSX
  // _____________________________________
  return (
    <LayoutWrapper user={user}>
      {!hastableauTabAccess ? (
        <AccessDeniedDialog
          title="Acces refuse"
          message={user.role === "direction"
            ? "Votre role ne vous permet pas de creer des tableaux tableaus."
            : "Votre role ne vous permet pas de gerer les tableaux tableauux."}
          redirectTo="/tableau_dashbord"
        />
      ) : (
        <>
          

          {/* _ ONGLETS PRINCIPAUX ______________________
              Pour ajouter un onglet : ajoutez un TabsTrigger + un TabsContent.
              La grille grid-cols-4 s'adapte au nombre d'onglets.
          __________________________________ */}
          <Tabs defaultValue="encaissement" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="epayment">E-payment</TabsTrigger>
              <TabsTrigger value="encaissement">Encaissement</TabsTrigger>
              <TabsTrigger value="reclamation">R?clamation</TabsTrigger>
              <TabsTrigger value="parc">Parc</TabsTrigger>
            </TabsList>

            {/* _ ONGLET : E-PAYMENT ____________________ */}
            <TabsContent value="epayment">
              <Card>
                <CardHeader><CardTitle>E-payment</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Contenu E-payment a impl?menter...</p>
                  {/* Ajoutez ici vos composants de tableaux pour E-payment */}
                </CardContent>
              </Card>
            </TabsContent>

            {/* _ ONGLET : ENCAISSEMENT __________________ */}
            <TabsContent value="encaissement">

              {/* S?lecteur de p?riode (Mois / Ann?e) */}
              <Card className="border border-gray-200 mb-4">
                <CardContent className="pt-3 pb-3">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Mois</label>
                      <Select value={mois} onValueChange={setMois}>
                        <SelectTrigger className="h-8 text-sm w-[130px]">
                          <SelectValue placeholder="Mois" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableMonths.length === 0
                            ? <SelectItem value="no-months" disabled>Aucun mois disponible</SelectItem>
                            : selectableMonths.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Annee</label>
                      <input
                        type="number" min="2000" max="2100" value={annee}
                        onChange={(e) => setAnnee(e.target.value)} placeholder="Ex: 2026"
                        className="h-8 w-[100px] rounded border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* _ (MODELE) Tableau 2 ??" copiez ce bloc pour ajouter un tableau _
              <Card className="mb-4">
                <CardHeader><CardTitle>Mon Deuxiéme Tableau</CardTitle></CardHeader>
                <CardContent>
                  <TabMonDeuxiemeTableau
                    rows={recouvrementRows}
                    setRows={setRecouvrementRows}
                  />
                </CardContent>
              </Card>
              _________________________________
              Note : un seul bouton "Enregistrer" pour tout l'onglet suffit.
              Il est d?ja inclus dans TabTotalEncaissement (onSave={handleSave}).
              Si vous voulez le d?placer en dehors des Card, d?placez-le ici.
              ________________________________ */}
              {/* _ Tableau 1 : Encaissement _______________ */}
              <Card className="mb-4">
                <CardHeader><CardTitle>Encaissement</CardTitle></CardHeader>
                <CardContent>
                  <TabTotalEncaissement
                    row={encaissementRow}
                    setRow={setEncaissementRow}
                    onSave={handleSave}
                    isSubmitting={isSubmitting}
                  />
                </CardContent>
              </Card>
              {/* _ Tableau 2 : Parc Abonn?s B2B ________________ */}
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle>Parc Abonn?s B2B</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabParcAbonne
                    rows={parcAbonneRows}
                    setRows={setParcAbonneRows}
                    onSave={handleSave}
                    isSubmitting={isSubmitting}
                  />
                </CardContent>
              </Card>
              

            </TabsContent>

            {/* _ ONGLET : R?CLAMATION ___________________ */}
            <TabsContent value="reclamation">
              <Card>
                <CardHeader><CardTitle>R?clamation</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Contenu R?clamation a impl?menter...</p>
                  {/* Ajoutez ici vos composants de tableaux pour R?clamation */}
                </CardContent>
              </Card>
            </TabsContent>

            {/* _ ONGLET : PARC ______________________ */}
            <TabsContent value="parc">
              <Card>
                <CardHeader><CardTitle>Parc</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Contenu Parc a impl?menter...</p>
                  {/* Ajoutez ici vos composants de tableaux pour Parc */}
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </>
      )}
    </LayoutWrapper>
  )
}