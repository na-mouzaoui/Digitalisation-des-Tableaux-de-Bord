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


const getCurrentTableuPeriod = (now: Date = new Date()) => ({
  mois: String(now.getMonth() + 1).padStart(2, "0"),
  annee: String(now.getFullYear()),
})
const getTableuPeriodLockMessage = (mois: string, annee: string, _role?: string | null) => `PÃ©riode ${mois}/${annee}.`
const isTableuPeriodLocked = (_mois: string, _annee: string, _role?: string | null) => false
const syncTableuPolicy = async (_direction?: string | null) => null
const isAdminTableuRole = (_role?: string | null) => false
const isRegionalTableuRole = (_role?: string | null) => false
const isFinanceTableuRole = (_role?: string | null) => false
const getManageableTableuTabKeysForDirection = () => ["encaissement"]
const isTableuTabDisabledByPolicy = (_tabKey?: string) => false


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 3. HELPERS DE FORMATAGE DES MONTANTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4. COMPOSANT GÃ‰NÃ‰RIQUE : AmountInput
//    Input rÃ©utilisable pour la saisie de montants.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 5. TYPES ET TABLEAUX DE L'ONGLET Â« ENCAISSEMENT Â»
//
//    â”Œâ”€ GUIDE : AJOUTER UN NOUVEAU TABLEAU â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
//    â”‚  Pour chaque nouveau tableau dans un onglet :                         â”‚
//    â”‚  a) DÃ©clarez son interface de donnÃ©es ici (ex: interface MonTableau)  â”‚
//    â”‚  b) CrÃ©ez son composant Tab* ci-dessous (section 6)                   â”‚
//    â”‚  c) Ajoutez son Ã©tat dans le state de la page (section 9)             â”‚
//    â”‚  d) Incluez ses donnÃ©es dans handleSave (section 10)                  â”‚
//    â”‚  e) Rendez-le dans le TabsContent concernÃ© (section 11)               â”‚
//    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ 5a. TYPE : ligne du tableau Encaissement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//    Pour ajouter des colonnes : ajoutez des champs ici ET dans
//    normalizeEncaissementData (section 8b) ET dans TabTotalEncaissement.

// â”€â”€ (MODÃˆLE) Pour un futur tableau, copiez ce bloc et adaptez-le : â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// interface MonNouveauTableauRow {
//   col1: string
//   col2: string
//   // ... autant de colonnes que nÃ©cessaire
// }

interface TotalEncaissementRow {
  mGp: string    // Colonne M-1 / GP
  mB2b: string   // Colonne M-1 / B2B
  m1Gp: string   // Colonne M   / GP
  m1B2b: string  // Colonne M   / B2B
  evol: string   // Colonne Ã‰volution
}

interface ParcAbonneRow {
  label: string    // Parc AbonnÃ©s B2B
  m1: string   // Colonne M-1 
  m: string   // Colonne M
  evol: string   // Colonne Ã‰volution
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 6. COMPOSANTS DE TABLEAUX
//    Chaque tableau est un composant autonome.
//    Vous pouvez en empiler plusieurs dans un mÃªme TabsContent (section 11).
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ 6a. TABLEAU : Encaissement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ (MODÃˆLE) Pour ajouter un 2e tableau dans l'onglet Encaissement : â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Ligne de total (ici identique Ã  la ligne de saisie â€” adaptez si besoin)
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
            {/* â”€â”€ Ligne de saisie â”€â”€ */}
            <tr className="bg-white">
              <td className="px-1 py-1 border-b"><AmountInput value={row.mGp}  onChange={(e) => update("mGp",  e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.mB2b} onChange={(e) => update("mB2b", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.m1Gp} onChange={(e) => update("m1Gp", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><AmountInput value={row.m1B2b}onChange={(e) => update("m1B2b",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" /></td>
              <td className="px-1 py-1 border-b"><Input value={row.evol} onChange={(e) => update("evol", e.target.value)} className="h-7 px-2 text-xs" placeholder="-" /></td>
            </tr>
            {/* â”€â”€ Ligne de total (fond vert) â”€â”€ */}
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

      {/* â”€â”€ Bouton Enregistrer (un seul par onglet suffit) â”€â”€ */}
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}


//Tab : Parc AbonnÃ©s B2B
// â”€â”€ 6b. TABLEAU : Parc AbonnÃ©s B2B â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              Parc AbonnÃ©s B2B
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border-b border-r">M</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border-b border-r">M+1</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border-b">Evol</th>
          </tr>
        </thead>
        <tbody>
          {/* â”€â”€ Lignes Ã©ditables (toutes sauf TOTAL) â”€â”€ */}
          {rows.slice(0, -1).map((row, i) => (
            <tr key={row.label} className="bg-white hover:bg-gray-50 transition-colors">
              {/* LibellÃ© non Ã©ditable */}
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

          {/* â”€â”€ Ligne TOTAL (calculÃ©e automatiquement, fond vert) â”€â”€ */}
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 7. CONFIGURATION DES ONGLETS
//    Ajoutez une entrÃ©e ici pour chaque nouvel onglet (ex: "recouvrement").
//    key   â†’ identifiant technique (doit correspondre Ã  TabsContent value=)
//    label â†’ texte affichÃ© dans le TabsTrigger
//    color â†’ couleur d'accentuation (optionnel)
//    title â†’ titre imprimÃ© sur le PDF
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TABS = [
  { key: "encaissement", label: "Encaissement", color: "#2db34b", title: "ENCAISSEMENT" },
  { key: "parc", label: "Parc", color: "#0093f5", title: "PARC" }
  // { key: "recouvrement", label: "Recouvrement", color: "#e67e22", title: "RECOUVREMENT" },
]

type TableuTabKey = "encaissement"| "parc" // â† ajoutez vos nouvelles clÃ©s ici avec | "recouvrement"

const MONTHS = [
  { value: "01", label: "Janvier" },   { value: "02", label: "Fevrier" },
  { value: "03", label: "Mars" },      { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },       { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },   { value: "08", label: "Aout" },
  { value: "09", label: "Septembre" }, { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },  { value: "12", label: "Decembre" },
]

const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_TABLEU_PERIOD = getCurrentTableuPeriod()
const YEARS = Array.from({ length: 101 }, (_, i) => (2000 + i).toString())


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 8. TYPES & HELPERS D'API / STOCKAGE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ 8a. Type du tableu sauvegardÃ© en localStorage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//    Ajoutez un champ *Data pour chaque nouveau tableau :
//    ex: recouvrementData?: MonNouveauTableauRow
interface SavedTableu {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  encaissementData?: TotalEncaissementRow
  parcAbonneData?: ParcAbonneRow[] 

  // recouvrementData?: MonNouveauTableauRow  // â† dÃ©commenter pour un nouveau tableau
}

// â”€â”€ 8b. Type retournÃ© par l'API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type ApiTableuTableu = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

// â”€â”€ 8c. Helpers de normalisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const safeString = (value: unknown) => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

// â”€â”€ (MODÃˆLE) Copiez-collez pour un nouveau tableau : â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  { label: "TOTAL",        m: "", m1: "", evol: "" }, // ligne calculÃ©e, non utilisÃ©e au chargement
]

const normalizeParcAbonneRows = (data?: ParcAbonneRow[]): ParcAbonneRow[] => {
  if (Array.isArray(data) && data.length >= 2) {
    // On recharge uniquement les 2 lignes Ã©ditables, le TOTAL est recalculÃ©
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


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 9. COMPOSANT ZONE D'IMPRESSION (PDF)
//    Ajoutez ici chaque tableau Ã  inclure dans le PDF.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PrintZoneProps {
  direction: string
  mois: string
  annee: string
  encaissementData: TotalEncaissementRow
  parcAbonneData: ParcAbonneRow[]      // â† ajout
}

function PrintZone({ direction, mois, annee, encaissementData, parcAbonneData }: PrintZoneProps) {
  const mon = MONTHS.find((m) => m.value === mois)?.label ?? mois

  const thStyle: React.CSSProperties = {
    border: "1px solid #000", padding: "12px 6px", backgroundColor: "#fff", color: "#000",
    fontSize: 11, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle",
  }
  const tdStyle: React.CSSProperties = {
    border: "1px solid #000", padding: "3px 6px", fontSize: 9,
    backgroundColor: "#fff", color: "#000", verticalAlign: "middle",
  }
  const totalRowStyle: React.CSSProperties = {
    backgroundColor: "#2db34b", fontWeight: 800,
  }

  // Recalcul du total pour l'impression
  const editableRows = parcAbonneData.slice(0, 2)
  const totalM  = editableRows.reduce((acc, r) => acc + num(r.m),  0)
  const totalM1 = editableRows.reduce((acc, r) => acc + num(r.m1), 0)
  const totalEvol = totalM > 0
    ? `${(((totalM1 - totalM) / totalM) * 100).toFixed(1)}%`
    : "-"

  return (
    <div id="print-zone" style={{ display: "none" }}>
      <style>{`
        #print-zone table th, #print-zone table td {
          color: #000 !important; text-align: center !important;
          vertical-align: middle !important; direction: ltr !important;
        }
        #print-zone table tbody td { background-color: #fff !important; }
        #print-zone table thead th, #print-zone table tfoot td {
          background-color: #2db34b !important; color: #000 !important; font-weight: 800 !important;
        }
      `}</style>

      {/* â”€â”€ En-tÃªte PDF â”€â”€ */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 12, borderBottom: "2px solid #000", marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" style={{ height: 52, objectFit: "contain" }} />
          <div style={{ width: 260, border: "3px solid #000", backgroundColor: "#fff" }}>
            <div style={{ minHeight: 32, display: "flex", alignItems: "center", padding: "0 10px", borderBottom: "3px solid #000", fontSize: 13, fontWeight: 700, color: "#000", textTransform: "uppercase" }}>
              ATM MOBILIS
            </div>
            <div style={{ minHeight: 32, display: "flex", alignItems: "center", padding: "0 10px", fontSize: 13, fontWeight: 700, color: "#000" }}>
              DR : {direction || "-"}
            </div>
          </div>
        </div>
        <div style={{ width: 260, border: "3px solid #000", backgroundColor: "#fff" }}>
          <div style={{ minHeight: 32, display: "flex", alignItems: "center", padding: "0 10px", borderBottom: "3px solid #000", fontSize: 13, fontWeight: 700, color: "#000" }}>
            Tableu Mois : {mon}
          </div>
          <div style={{ minHeight: 32, display: "flex", alignItems: "center", padding: "0 10px", fontSize: 13, fontWeight: 700, color: "#000" }}>
            Annee : {annee}
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          TABLEAU 1 : ENCAISSEMENT
          Pour chaque nouveau tableau dans le PDF, copiez le bloc
          "Titre + <table>" ci-dessous et adaptez les colonnes.
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "#000", marginBottom: 12 }}>
        ENCAISSEMENT
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr>
            <th style={thStyle} rowSpan={2}>Encaissement (MDA)</th>
            <th style={thStyle} colSpan={2}>M-1</th>
            <th style={thStyle} colSpan={2}>M</th>
            <th style={thStyle} rowSpan={2}>Evol</th>
          </tr>
          <tr>
            <th style={thStyle}>GP</th>
            <th style={thStyle}>B2B</th>
            <th style={thStyle}>GP</th>
            <th style={thStyle}>B2B</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...tdStyle, textAlign: "right" }}>{encaissementData.mGp   ? fmt(encaissementData.mGp)   : ""}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{encaissementData.mB2b  ? fmt(encaissementData.mB2b)  : ""}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{encaissementData.m1Gp  ? fmt(encaissementData.m1Gp)  : ""}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{encaissementData.m1B2b ? fmt(encaissementData.m1B2b) : ""}</td>
            <td style={tdStyle}>{encaissementData.evol || "-"}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(encaissementData.mGp   || "0")}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(encaissementData.mB2b  || "0")}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(encaissementData.m1Gp  || "0")}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(encaissementData.m1B2b || "0")}</td>
            <td style={tdStyle}>{encaissementData.evol || "-"}</td>
          </tr>
        </tfoot>
      </table>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          TABLEAU 2 : PARC ABONNÃ‰S B2B
          â† CopiÃ© et adaptÃ© depuis le modÃ¨le ci-dessus
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "#000", marginBottom: 12 }}>
        PARC ABONNÃ‰S B2B
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr>
            <th style={thStyle}>Parc AbonnÃ©s B2B</th>
            <th style={thStyle}>M</th>
            <th style={thStyle}>M+1</th>
            <th style={thStyle}>Evol</th>
          </tr>
        </thead>
        <tbody>
          {editableRows.map((row) => (
            <tr key={row.label}>
              <td style={{ ...tdStyle, textAlign: "left" }}>{row.label}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{row.m  ? fmt(row.m)  : ""}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{row.m1 ? fmt(row.m1) : ""}</td>
              <td style={tdStyle}>{row.evol || "-"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...tdStyle, fontWeight: 800 }}>TOTAL</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(totalM)}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(totalM1)}</td>
            <td style={tdStyle}>{totalEvol}</td>
          </tr>
        </tfoot>
      </table>

    </div>
  )
}

      {/* â”€â”€ (MODÃˆLE) Pour imprimer un 2e tableau juste en dessous : â”€â”€â”€â”€â”€â”€â”€â”€â”€
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, marginTop: 30, marginBottom: 20 }}>
        MON DEUXIÃˆME TABLEAU
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        ...
      </table>
      â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}



// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 10. PAGE PRINCIPALE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function NouvelleTableuPage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [editQuery, setEditQuery] = useState<{ editId: string; tab: string }>({ editId: "", tab: "" })

  // â”€â”€ 10a. Chargement des rÃ©gions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ 10b. Lecture des query params (editId, mois, annee) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ 10c. STATE GLOBAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [activeTab, setActiveTab] = useState("encaissement")
  const [direction, setDirection] = useState("")
  const [mois, setMois] = useState(INITIAL_TABLEU_PERIOD.mois)
  const [annee, setAnnee] = useState(INITIAL_TABLEU_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingTableuId, setEditingTableuId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [tableuPolicyRevision, setTableuPolicyRevision] = useState(0)

  // â”€â”€ 10d. STATE DES DONNÃ‰ES DE TABLEAUX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //    Ajoutez un useState par tableau supplÃ©mentaire ici.
    // const [recouvrementRows, setRecouvrementRows] = useState<MonNouveauTableauRow[]>([])
  const [encaissementRow, setEncaissementRow] = useState<TotalEncaissementRow>({
    mGp: "", mB2b: "", m1Gp: "", m1B2b: "", evol: "",
  })
  const [parcAbonneRows, setParcAbonneRows] = useState<ParcAbonneRow[]>(
  DEFAULT_PARC_ABONNE_ROWS.map((r) => ({ ...r }))
)


  // â”€â”€ 10e. STATE API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [tableuTableus, setTableu] = useState<ApiTableuTableu[]>([])

  // â”€â”€ 10f. Logique de rÃ´les et d'onglets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const userRole = user?.role ?? ""
  const isAdminRole    = isAdminTableuRole(userRole)
  const isRegionalRole = isRegionalTableuRole(userRole)
  const isFinanceRole  = isFinanceTableuRole(userRole)
  const adminSelectedDirection = safeString(direction).trim()

  const manageableTabKeys = useMemo(() => new Set(getManageableTableuTabKeysForDirection()), [tableuPolicyRevision])
  const availableTabs     = useMemo(() => TABS.filter((tab) => manageableTabKeys.has(tab.key)), [manageableTabKeys])
  const disabledTabKeys   = useMemo(() => new Set(availableTabs.filter((t) => isTableuTabDisabledByPolicy(t.key)).map((t) => t.key)), [availableTabs, tableuPolicyRevision])
  const selectableTabs    = useMemo(() => availableTabs.map((tab) => ({ ...tab, isDisabled: disabledTabKeys.has(tab.key) })), [availableTabs, disabledTabKeys])
  const tableuTabs   = selectableTabs

  const selectableYears  = useMemo(() => YEARS.filter((y) => MONTHS.some((m) => !isTableuPeriodLocked(m.value, y, userRole))), [tableuPolicyRevision, userRole])
  const selectableMonths = useMemo(() => MONTHS.filter((m) => !isTableuPeriodLocked(m.value, annee, userRole)), [annee, tableuPolicyRevision, userRole])

  const hasTableuTabAccess  = tableuTabs.length > 0
  const isActiveTabDisabled = disabledTabKeys.has(activeTab)

  // â”€â”€ 10g. RÃ©solution de la direction selon le rÃ´le â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ 10h. Synchronisation de la politique tableue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!userRole) return
    let cancelled = false
    const run = async () => {
      await syncTableuPolicy(isAdminRole ? adminSelectedDirection : undefined)
      if (!cancelled) setTableuPolicyRevision((p) => p + 1)
    }
    run()
    return () => { cancelled = true }
  }, [adminSelectedDirection, isAdminRole, userRole])

  // â”€â”€ 10i. Correction automatique mois/annÃ©e hors plage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ 10j. Auto-set direction selon le rÃ´le â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!user || isAdminRole) return
    setDirection((prev) => resolveDirectionForRole(prev))
  }, [user, isAdminRole, resolveDirectionForRole])

  // â”€â”€ 10k. Chargement des tableux depuis l'API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!user || status !== "authenticated") { setTableu([]); return }
    let cancelled = false
    const load = async () => {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
        const res = await fetch(`${API_BASE}/api/tableu`, {
          method: "GET", credentials: "include", cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) { if (!cancelled) setTableu([]); return }
        const payload = await res.json().catch(() => null)
        const tableus = Array.isArray(payload)
          ? payload.map((item) => ({
              id:        Number((item as any).id ?? 0),
              tabKey:    String((item as any).tabKey ?? "").trim().toLowerCase(),
              mois:      String((item as any).mois ?? "").trim(),
              annee:     String((item as any).annee ?? "").trim(),
              direction: String((item as any).direction ?? "").trim(),
              dataJson:  String((item as any).dataJson ?? "{}"),
            }))
          : []
        if (!cancelled) setTableu(tableus)
      } catch {
        if (!cancelled) setTableu([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [status, user])

  // â”€â”€ 10l. Chargement d'un tableu existant pour Ã©dition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (isLoading || status !== "authenticated" || !user) return
    if (!editQuery.editId) {
      setEditingTableuId(null)
      setEditingCreatedAt("")
      setEditingSourceMois("")
      setEditingSourceAnnee("")
      return
    }
    try {
      const parsed = JSON.parse(localStorage.getItem("tableu_tableus") ?? "[]")
      const tableus = Array.isArray(parsed) ? (parsed as SavedTableu[]) : []
      const decl = tableus.find((item) => safeString(item.id) === editQuery.editId)
      if (!decl) {
        toast({ title: "Tableu introuvable", description: "La tableu demandee n'existe pas.", variant: "destructive" })
        return
      }
      const scopedDirection = isAdminRole ? safeString(decl.direction).trim() : resolveDirectionForRole(safeString(decl.direction).trim())
      setEditingTableuId(safeString(decl.id) || editQuery.editId)
      setEditingCreatedAt(safeString(decl.createdAt) || new Date().toISOString())
      setDirection(scopedDirection)
      const loadedMois  = normalizeMonthValue(safeString(decl.mois))
      const loadedAnnee = normalizeYearValue(safeString(decl.annee))
      setMois(loadedMois)
      setAnnee(loadedAnnee)
      setEditingSourceMois(loadedMois)
      setEditingSourceAnnee(loadedAnnee)

      // Restauration des donnÃ©es par tableau
      // setRecouvrementRows(normalizeMonNouveauTableauData(decl.recouvrementData)) // â† nouveau tableau
      setEncaissementRow(normalizeEncaissementData(decl.encaissementData))
      setParcAbonneRows(normalizeParcAbonneRows(decl.parcAbonneData))
    } catch {
      toast({ title: "Erreur de chargement", description: "Impossible de charger la tableu.", variant: "destructive" })
    }
  }, [editQuery.editId, editQuery.tab, isAdminRole, isLoading, resolveDirectionForRole, router, status, user])

  // â”€â”€ 10m. Garde d'authentification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isLoading || !user || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  // â”€â”€ 10n. SAUVEGARDE (handleSave) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //    Pour ajouter les donnÃ©es d'un nouveau tableau :
  //    1. Incluez-les dans `baseDecl` (champ *Data)
  //    2. Incluez-les dans `tabData` envoyÃ© Ã  l'API
  const handleSave = async () => {
    const saveDirection = effectiveDirection

    // Validations de pÃ©riode / onglet
    if (isActiveTabDisabled) {
      toast({ title: "Tableau desactive", description: "Le tableau selectionne est desactive.", variant: "destructive" }); return
    }
    if (!selectableYears.includes(annee) || !selectableMonths.some((m) => m.value === mois)) {
      toast({ title: "Periode cloturee", description: "Le mois ou l'annee selectionne(e) est hors delai.", variant: "destructive" }); return
    }
    if (!mois)  { toast({ title: "Mois requis",   description: "Veuillez selectionner le mois.",   variant: "destructive" }); return }
    if (!annee) { toast({ title: "Annee requise", description: "Veuillez selectionner l'annee.", variant: "destructive" }); return }

    const isSourceLocked = !!editingTableuId && !!editingSourceMois && !!editingSourceAnnee
      && isTableuPeriodLocked(editingSourceMois, editingSourceAnnee, userRole)
    if (isSourceLocked) {
      toast({ title: "Periode cloturee", description: `${getTableuPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification autorisee.`, variant: "destructive" }); return
    }
    if (isTableuPeriodLocked(mois, annee, userRole)) {
      toast({ title: "Periode cloturee", description: `${getTableuPeriodLockMessage(mois, annee, userRole)} Aucune creation ou modification autorisee.`, variant: "destructive" }); return
    }

    // RÃ©cupÃ©ration du cache local
    let existingTableus: SavedTableu[] = []
    try {
      const parsed = JSON.parse(localStorage.getItem("tableu_tableus") ?? "[]")
      existingTableus = Array.isArray(parsed) ? (parsed as SavedTableu[]) : []
    } catch { existingTableus = [] }

    const originalTableu = editingTableuId
      ? existingTableus.find((item) => safeString(item.id) === editingTableuId) ?? null
      : null

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 400))

    const tableuId        = editingTableuId ?? Date.now().toString()
    const tableuCreatedAt = editingCreatedAt || new Date().toISOString()

    // â”€â”€ Objet de tableu sauvegardÃ© localement â”€â”€
    //    Ajoutez ici les donnÃ©es de chaque nouveau tableau (ex: recouvrementData)
    const baseDecl: SavedTableu = {
      id: tableuId,
      createdAt: tableuCreatedAt,
      direction: saveDirection,
      mois,
      annee,
      encaissementData: encaissementRow,
      parcAbonneData: parcAbonneRows.slice(0, 2),
      
      // recouvrementData: recouvrementRows,
    }

    // Mise Ã  jour du cache localStorage
    try {
      if (editingTableuId) {
        const hasTarget = existingTableus.some((item) => safeString(item.id) === editingTableuId)
        const updated = hasTarget
          ? existingTableus.map((item) => safeString(item.id) === editingTableuId ? baseDecl : item)
          : [baseDecl, ...existingTableus]
        localStorage.setItem("tableu_tableus", JSON.stringify(updated))
      } else {
        localStorage.setItem("tableu_tableus", JSON.stringify([baseDecl, ...existingTableus]))
      }
    } catch { /* quota ou SSR */ }

    // â”€â”€ Persistance en base de donnÃ©es â”€â”€
    try {
      const apiBase = API_BASE
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null

      // Ajoutez ici les donnÃ©es de chaque nouveau tableau dans tabData
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
      if (editingTableuId) {
        const deleteRes = await fetch(`${apiBase}/api/tableu/${encodeURIComponent(editingTableuId)}`, {
          method: "DELETE", credentials: "include",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        if (!deleteRes.ok && deleteRes.status !== 404) {
          const errPayload = await deleteRes.json().catch(() => ({}))
          const errMsg = (errPayload as any)?.message ?? "Erreur lors de la suppression"
          try { localStorage.setItem("tableu_tableus", JSON.stringify(existingTableus)) } catch {}
          setIsSubmitting(false)
          toast({ title: "Erreur de modification", description: String(errMsg), variant: "destructive" })
          return
        }
      }

      // CrÃ©ation
      const createRes = await fetch(`${apiBase}/api/tableu`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(requestPayload),
      })

      if (!createRes.ok) {
        const errPayload = await createRes.json().catch(() => ({}))
        const errMsg = (errPayload as any)?.message ?? "Erreur lors de l'enregistrement"

        // Tentative de restauration
        let restoreOk = false
        if (editingTableuId && originalTableu) {
          const restoreTabData = { encaissementData: originalTableu.encaissementData ?? { mGp: "", mB2b: "", m1Gp: "", m1B2b: "", evol: "" } }
          const restoreRes = await fetch(`${apiBase}/api/tableu`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ tabKey: activeTab, mois: originalTableu.mois, annee: originalTableu.annee, direction: originalTableu.direction, dataJson: JSON.stringify(restoreTabData) }),
          })
          restoreOk = restoreRes.ok
        }

        try { localStorage.setItem("tableu_tableus", JSON.stringify(existingTableus)) } catch {}
        setIsSubmitting(false)
        toast({
          title: "Erreur d'enregistrement",
          description: restoreOk ? `${errMsg} L'ancien tableu a Ã©tÃ© restaurÃ©.` : String(errMsg),
          variant: "destructive",
        })
        return
      }
    } catch (error) {
      try { localStorage.setItem("tableu_tableus", JSON.stringify(existingTableus)) } catch {}
      setIsSubmitting(false)
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible de contacter le serveur", variant: "destructive" })
      return
    }

    toast({
      title: editingTableuId ? "Tableu modifiee" : "Tableu enregistree",
      description: `La tableu "Encaissement" a ete sauvegardee avec succes.`,
    })
    setIsSubmitting(false)
    router.push("/tableu_dashbord")
  }

  // â”€â”€ 10o. Message de verrouillage de pÃ©riode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const currentPeriodLockMessage = (() => {
    if (editingTableuId && editingSourceMois && editingSourceAnnee && isTableuPeriodLocked(editingSourceMois, editingSourceAnnee, userRole))
      return `${getTableuPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification n'est autorisee.`
    if (isTableuPeriodLocked(mois, annee, userRole))
      return `${getTableuPeriodLockMessage(mois, annee, userRole)} Aucune creation ou modification n'est autorisee.`
    return ""
  })()


  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 11. RENDU JSX
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <LayoutWrapper user={user}>
      {!hasTableuTabAccess ? (
        <AccessDeniedDialog
          title="Acces refuse"
          message={user.role === "direction"
            ? "Votre role ne vous permet pas de creer des tableus tableues."
            : "Votre role ne vous permet pas de gerer les tableaux tableuux."}
          redirectTo="/tableu_dashbord"
        />
      ) : (
        <>
          {/* Zone d'impression cachÃ©e (PDF) */}
          <PrintZone
            direction={effectiveDirection}
            mois={mois}
            annee={annee}
            encaissementData={encaissementRow}
            parcAbonneData={parcAbonneRows} 
          />

          {/* â”€â”€ ONGLETS PRINCIPAUX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
              Pour ajouter un onglet : ajoutez un TabsTrigger + un TabsContent.
              La grille grid-cols-4 s'adapte au nombre d'onglets.
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <Tabs defaultValue="encaissement" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="epayment">E-payment</TabsTrigger>
              <TabsTrigger value="encaissement">Encaissement</TabsTrigger>
              <TabsTrigger value="reclamation">RÃ©clamation</TabsTrigger>
              <TabsTrigger value="parc">Parc</TabsTrigger>
            </TabsList>

            {/* â”€â”€ ONGLET : E-PAYMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="epayment">
              <Card>
                <CardHeader><CardTitle>E-payment</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Contenu E-payment Ã  implÃ©menter...</p>
                  {/* Ajoutez ici vos composants de tableaux pour E-payment */}
                </CardContent>
              </Card>
            </TabsContent>

            {/* â”€â”€ ONGLET : ENCAISSEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="encaissement">

              {/* SÃ©lecteur de pÃ©riode (Mois / AnnÃ©e) */}
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
              {/* â”€â”€ (MODÃˆLE) Tableau 2 â€” copiez ce bloc pour ajouter un tableau â”€â”€
              <Card className="mb-4">
                <CardHeader><CardTitle>Mon DeuxiÃ¨me Tableau</CardTitle></CardHeader>
                <CardContent>
                  <TabMonDeuxiemeTableau
                    rows={recouvrementRows}
                    setRows={setRecouvrementRows}
                  />
                </CardContent>
              </Card>
              â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
              Note : un seul bouton "Enregistrer" pour tout l'onglet suffit.
              Il est dÃ©jÃ  inclus dans TabTotalEncaissement (onSave={handleSave}).
              Si vous voulez le dÃ©placer en dehors des Card, dÃ©placez-le ici.
              â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              {/* â”€â”€ Tableau 1 : Encaissement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              {/* â”€â”€ Tableau 2 : Parc AbonnÃ©s B2B â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle>Parc AbonnÃ©s B2B</CardTitle>
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

            {/* â”€â”€ ONGLET : RÃ‰CLAMATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="reclamation">
              <Card>
                <CardHeader><CardTitle>RÃ©clamation</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Contenu RÃ©clamation Ã  implÃ©menter...</p>
                  {/* Ajoutez ici vos composants de tableaux pour RÃ©clamation */}
                </CardContent>
              </Card>
            </TabsContent>

            {/* â”€â”€ ONGLET : PARC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TabsContent value="parc">
              <Card>
                <CardHeader><CardTitle>Parc</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Contenu Parc Ã  implÃ©menter...</p>
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
