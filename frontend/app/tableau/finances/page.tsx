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
  m1Budget: string
  m1Realise: string
  m1Taux: string
}

const COMPTE_RESULTAT_LABELS = [
  "Chiffre d'affaire GP",
  "Chiffre d'affair ME",
  "Chiffre d'affairs Interco -roming",
  "Total CA",
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
] as const

const DEFAULT_COMPTE_RESULTAT_ROWS: CompteResultatRow[] = COMPTE_RESULTAT_LABELS.map((designation) => ({
  designation,
  mBudget: "",
  mRealise: "",
  mTaux: "",
  m1Budget: "",
  m1Realise: "",
  m1Taux: "",
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
}

function TabCompteResultat({ rows, setRows, onSave, isSubmitting }: TabCompteResultatProps) {
  const update = (index: number, field: keyof CompteResultatRow, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r">Designations</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">M-1</th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
            </tr>
            <tr className="bg-gray-50">
              {["Budget", "Realise", "Taux"].map((h, i) => (
                <th key={i} className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b${i === 2 ? " border-r" : ""}`}>{h}</th>
              ))}
              {["Budget", "Realise", "Taux"].map((h, i) => (
                <th key={i + 3} className="px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.designation} className="bg-white">
                <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                {(["mBudget", "mRealise", "mTaux", "m1Budget", "m1Realise", "m1Taux"] as const).map((field) => (
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
// 7. CONFIGURATION DES ONGLETS
// ?????????????????????????????????????????????????????????????????????????????
const TABS = [
  { key: "compte_resultat", label: "Compte de resultat", color: PRIMARY_COLOR, title: "COMPTE DE RESULTAT" },
]

const CUSTOM_tableau_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

type tableauTabKey = "compte_resultat"

type tableauCategoryKey = "cr"

const tableau_CATEGORY_OPTIONS: Array<{ key: tableauCategoryKey; label: string; tabKeys: tableauTabKey[] }> = [
  { key: "cr", label: "CR", tabKeys: ["compte_resultat"] },
]

const findtableauCategoryKeyForTab = (tabKey: string): tableauCategoryKey =>
  tableau_CATEGORY_OPTIONS.find((c) => c.tabKeys.includes(tabKey as tableauTabKey))?.key ?? "cr"

const istableauTabKey = (value: string): value is tableauTabKey =>
  TABS.some((tab) => tab.key === value)

const MONTHS = [
  { value: "01", label: "Janvier" }, { value: "02", label: "Fevrier" },
  { value: "03", label: "Mars" }, { value: "04", label: "Avril" },
  { value: "05", label: "Mai" }, { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" }, { value: "08", label: "Aout" },
  { value: "09", label: "Septembre" }, { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" }, { value: "12", label: "Decembre" },
]

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
    m1Budget: safeString(src[i]?.m1Budget),
    m1Realise: safeString(src[i]?.m1Realise),
    m1Taux: safeString(src[i]?.m1Taux),
  }))
}

const resolveDeclarationTabKey = (decl: Savedtableau): tableauTabKey => {
  if ((decl.compteResultatRows?.length ?? 0) > 0) return "compte_resultat"
  return "compte_resultat"
}

// PAGE
export default function NouvelleDeclarationPage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
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

  const [activeTab, setActiveTab] = useState("compte_resultat")
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<tableauCategoryKey>("cr")
  const [direction, setDirection] = useState("")
  const [mois, setMois] = useState(INITIAL_tableau_PERIOD.mois)
  const [annee, setAnnee] = useState(INITIAL_tableau_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [tableauPolicyRevision, settableauPolicyRevision] = useState(0)

  const [compteResultatRows, setCompteResultatRows] = useState<CompteResultatRow[]>(DEFAULT_COMPTE_RESULTAT_ROWS.map((row) => ({ ...row })))
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
    if (declarationCategoryOptions.some((category) => category.key === selectedCategoryKey)) return
    setSelectedCategoryKey(declarationCategoryOptions[0]?.key ?? "cr")
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
      setCompteResultatRows(normalizeCompteResultatRows(declaration.compteResultatRows))
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
    if (compteResultatRows.some((row) => !row.mBudget || !row.mRealise || !row.mTaux || !row.m1Budget || !row.m1Realise || !row.m1Taux)) {
      toast({ title: "Champs incomplets", description: "Veuillez renseigner toutes les lignes du tableau Compte de resultat.", variant: "destructive" })
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
      compteResultatRows,
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
      const tabData = { compteResultatRows }

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
                    : "Remplissez le tableau, puis enregistrez."}
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
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Compte de resultat</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabCompteResultat rows={compteResultatRows} setRows={setCompteResultatRows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </LayoutWrapper>
  )
}