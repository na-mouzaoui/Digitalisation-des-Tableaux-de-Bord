"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Save } from "lucide-react"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import WILAYAS_COMMUNES, { type WilayaCommuneEntry } from "@/lib/wilayas-communes"
import { getCurrentFiscalPeriod, getFiscalPeriodLockMessage, isFiscalPeriodLocked } from "@/lib/fiscal-period-deadline"
import { getManageableFiscalTabKeysForDirection, isAdminFiscalRole, isFinanceFiscalRole, isRegionalFiscalRole, isFiscalTabDisabledByPolicy } from "@/lib/fiscal-tab-access"
import { syncFiscalPolicy } from "@/lib/fiscal-policy"
import { API_BASE } from "@/lib/config"

// primary colour used by all tables/buttons
const PRIMARY_COLOR = "#2db34b"

// 
// HELPERS
// 
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

  if (hasTrailingSeparator && decimalPart.length === 0) {
    return `${integerPart}.`
  }

  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart
}

const formatAmountInput = (value: string) => {
  const normalized = normalizeAmountInput(value)
  if (!normalized) return ""

  const hasTrailingDot = normalized.endsWith(".")
  const [integerPart, decimalPart = ""] = normalized.split(".")
  const groupedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")

  if (hasTrailingDot) {
    return `${groupedIntegerPart},`
  }

  return decimalPart ? `${groupedIntegerPart},${decimalPart}` : groupedIntegerPart
}

const num = (v: string) => {
  const normalized = normalizeAmountInput(v)
  const parseReady = normalized.endsWith(".") ? normalized.slice(0, -1) : normalized
  return parseFloat(parseReady) || 0
}

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

// 
// TAB 1 - ENCAISSEMENT  (controlled)
// Encaissement: HT, TVA, TTC
// 
type EncRow = { designation: string; ht: string }

interface Tab1Props { rows: EncRow[]; setRows: React.Dispatch<React.SetStateAction<EncRow[]>>
  onSave: () => void;
  isSubmitting: boolean;
}

function TabEncaissement({ rows, setRows, onSave, isSubmitting }: Tab1Props) {
  const addRow    = () => setRows((p) => [...p, { designation: "", ht: "" }])
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const update    = (i: number, field: keyof EncRow, val: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)))

  const totals = useMemo(() => {
    const ht = rows.reduce((s, r) => s + num(r.ht), 0)
    const tva = ht * 0.19
    return { ht, tva, ttc: ht + tva }
  }, [rows])

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400 border-b w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">DESIGNATIONS</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">ENCAISSEMENTS HT</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">TVA</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">ENCAISSEMENTS TTC</th>
              <th className="px-2 py-2 border-b w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const ht = num(row.ht)
              const tva = ht * 0.19
              const ttc = ht + tva
              return (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-2 py-1 text-center text-xs text-gray-400 border-b">{i + 1}</td>
                  <td className="px-1 py-1 border-b">
                    <Input value={row.designation} onChange={(e) => update(i, "designation", e.target.value)}
                      className="h-7 px-2 text-xs" placeholder="Designation" style={{ minWidth: 200 }} />
                  </td>
                  <td className="px-1 py-1 border-b">
                    <AmountInput value={row.ht}
                      onChange={(e) => update(i, "ht", e.target.value)}
                      className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 130 }} />
                  </td>
                  <td className="px-3 py-1 border-b text-xs text-gray-700 font-semibold bg-gray-50/50">
                    {row.ht ? fmt(tva) : "-"}
                  </td>
                  <td className="px-3 py-1 border-b text-xs text-gray-700 font-semibold bg-gray-50/50">
                    {row.ht ? fmt(ttc) : "-"}
                  </td>
                  <td className="px-2 py-1 text-center border-b">
                    <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                      className="text-emerald-400 hover:text-emerald-600 disabled:opacity-30"><Trash2 size={13} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totals.ht)}</td>
              <td className="px-3 py-2 text-xs text-gray-700 border-t text-right [direction:rtl]">{fmt(totals.tva)}</td>
              <td className="px-3 py-2 text-xs text-gray-700 border-t text-right [direction:rtl]">{fmt(totals.ttc)}</td>
              <td className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" size="sm" onClick={addRow}
          className="gap-1.5 text-xs border-green-500 text-green-600 hover:bg-green-50">
          <Plus size={13} /> Ajouter une ligne
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 2 & 3 - TVA/IMMO  and  TVA/BIENS & SERV (controlled, same structure)
// 
type FiscalFournisseurOption = {
  id: number
  raisonSociale: string
  adresse: string
  nif: string
  authNif: string
  rc: string
  authRc: string
}

type TvaRow = {
  fournisseurId?: string
  nomRaisonSociale: string; adresse: string; nif: string; authNif: string
  numRC: string; authRC: string; numFacture: string; dateFacture: string
  montantHT: string; tva: string; tauxTVA?: TvaRate | ""
}
const EMPTY_TVA: TvaRow = {
  fournisseurId: "",
  nomRaisonSociale: "", adresse: "", nif: "", authNif: "",
  numRC: "", authRC: "", numFacture: "", dateFacture: "",
  montantHT: "", tva: "", tauxTVA: "",
}

const TVA_RATE_OPTIONS = [
  { value: "19", label: "19%" },
  { value: "9", label: "9%" },
] as const

type TvaRate = (typeof TVA_RATE_OPTIONS)[number]["value"]

const normalizeTvaRate = (value?: string): TvaRate | "" => {
  if (value === "19" || value === "9") return value
  return ""
}

const calculateTvaFromRate = (montantHT: string, tauxTVA?: string) => {
  const rate = normalizeTvaRate(tauxTVA)
  return rate ? num(montantHT) * (Number(rate) / 100) : 0
}

const getTvaAmount = (row: TvaRow, useRateSelection: boolean) => {
  const rate = normalizeTvaRate(row.tauxTVA)
  if (useRateSelection && rate) {
    return calculateTvaFromRate(row.montantHT, rate)
  }
  return num(row.tva)
}

const getTvaRateLabel = (tauxTVA?: string) => {
  const rate = normalizeTvaRate(tauxTVA)
  return rate ? `${rate}%` : "-"
}

const printNullableText = (value: unknown) => {
  const normalized = safeString(value).trim()
  return normalized === "0" ? "" : normalized
}

const safeString = (value: unknown) => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

const asArrayPayload = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== "object") return []

  const raw = value as Record<string, unknown>
  if (Array.isArray(raw.$values)) return raw.$values
  if (Array.isArray(raw.items)) return raw.items
  if (Array.isArray(raw.data)) return raw.data
  return []
}

const normalizeFiscalFournisseurOption = (value: unknown): FiscalFournisseurOption | null => {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const id = Number(raw.id)
  if (!Number.isFinite(id)) return null

  return {
    id,
    raisonSociale: safeString(raw.raisonSociale),
    adresse: safeString(raw.adresse),
    nif: safeString(raw.nif),
    authNif: safeString(raw.authNif),
    rc: safeString(raw.rc),
    authRc: safeString(raw.authRc),
  }
}

interface Tab23Props { rows: TvaRow[]; setRows: React.Dispatch<React.SetStateAction<TvaRow[]>>;
  onSave: () => void;
  isSubmitting: boolean;
  fournisseurs: FiscalFournisseurOption[];
  withSelectableRate?: boolean;
}

function TabTVAEtat({ rows, setRows, onSave, isSubmitting, fournisseurs, withSelectableRate = false }: Tab23Props) {
  const addRow    = () => setRows((p) => [...p, { ...EMPTY_TVA }])
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const toSupplierValue = (value: string | undefined | null) => {
    const normalized = safeString(value).trim()
    return normalized ? normalized : "0"
  }
  const update    = (i: number, field: keyof TvaRow, val: string) =>
    setRows((p) =>
      p.map((r, idx) => {
        if (idx !== i) return r
        const next = { ...r, [field]: val } as TvaRow
        if (withSelectableRate && (field === "montantHT" || field === "tauxTVA")) {
          const rate = normalizeTvaRate(next.tauxTVA)
          next.tva = next.montantHT && rate ? calculateTvaFromRate(next.montantHT, rate).toFixed(2) : ""
        }
        return next
      }),
    )

  const selectFournisseur = (i: number, fournisseurId: string) =>
    setRows((p) =>
      p.map((r, idx) => {
        if (idx !== i) return r
        const selected = fournisseurs.find((f) => String(f.id) === fournisseurId)
        if (!selected) {
          return {
            ...r,
            fournisseurId: "",
            nomRaisonSociale: "",
            adresse: "",
            nif: "",
            authNif: "",
            numRC: "",
            authRC: "",
          }
        }
        return {
          ...r,
          fournisseurId,
          nomRaisonSociale: toSupplierValue(selected.raisonSociale),
          adresse: toSupplierValue(selected.adresse),
          nif: toSupplierValue(selected.nif),
          authNif: toSupplierValue(selected.authNif),
          numRC: toSupplierValue(selected.rc),
          authRC: toSupplierValue(selected.authRc),
        }
      }),
    )

  const totalHT  = rows.reduce((s, r) => s + num(r.montantHT), 0)
  const totalTVA = rows.reduce((s, r) => s + getTvaAmount(r, withSelectableRate), 0)
  const totalTTC = totalHT + totalTVA

  const headers = [
    "Nom Prenom / Raison Sociale", "Adresse", "NIF", "Auth. NIF",
    "N° RC", "Auth. N° RC", "N° Facture", "Date",
    "Montant HT", ...(withSelectableRate ? ["Taux TVA"] : []), "TVA", "Montant TTC",
  ]

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400 border-b w-8">#</th>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b whitespace-nowrap">{h}</th>
              ))}
              <th className="px-2 py-2 border-b w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const currentRow: TvaRow = { ...EMPTY_TVA, ...row, fournisseurId: row.fournisseurId ?? "" }
              const rowTva = getTvaAmount(currentRow, withSelectableRate)
              const ttc = num(currentRow.montantHT) + rowTva
              const supplierPlaceholder = currentRow.nomRaisonSociale?.trim() || "Selectionner"
              return (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-2 py-1 text-center text-xs text-gray-400 border-b">{i + 1}</td>
                  <td className="px-1 py-1 border-b">
                    <select
                      value={currentRow.fournisseurId ?? ""}
                      onChange={(e) => selectFournisseur(i, e.target.value)}
                      className="h-7 rounded border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-300"
                      style={{ minWidth: 220 }}
                    >
                      <option value="">{supplierPlaceholder}</option>
                      {fournisseurs.map((f) => (
                        <option key={f.id} value={String(f.id)}>{f.raisonSociale || "-"}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1 border-b"><Input value={currentRow.adresse ?? ""} readOnly className="h-7 px-2 text-xs bg-gray-50" style={{ minWidth: 150 }} placeholder="Auto" /></td>
                  <td className="px-1 py-1 border-b"><Input value={currentRow.nif ?? ""} readOnly className="h-7 px-2 text-xs bg-gray-50" style={{ minWidth: 110 }} placeholder="Auto" /></td>
                  <td className="px-1 py-1 border-b"><Input value={currentRow.authNif ?? ""} readOnly className="h-7 px-2 text-xs bg-gray-50" style={{ minWidth: 110 }} placeholder="Auto" /></td>
                  <td className="px-1 py-1 border-b"><Input value={currentRow.numRC ?? ""} readOnly className="h-7 px-2 text-xs bg-gray-50" style={{ minWidth: 110 }} placeholder="Auto" /></td>
                  <td className="px-1 py-1 border-b"><Input value={currentRow.authRC ?? ""} readOnly className="h-7 px-2 text-xs bg-gray-50" style={{ minWidth: 110 }} placeholder="Auto" /></td>
                  <td className="px-1 py-1 border-b"><Input value={currentRow.numFacture ?? ""} onChange={(e) => update(i, "numFacture", e.target.value)} className="h-7 px-2 text-xs" style={{ minWidth: 110 }} placeholder="N° Facture" /></td>
                  <td className="px-1 py-1 border-b"><Input type="date" value={currentRow.dateFacture ?? ""} onChange={(e) => update(i, "dateFacture", e.target.value)} className="h-7 px-2 text-xs" style={{ minWidth: 130 }} /></td>
                  <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={currentRow.montantHT ?? ""} onChange={(e) => update(i, "montantHT", e.target.value)} className="h-7 px-2 text-xs" style={{ minWidth: 110 }} placeholder="0.00" /></td>
                  {withSelectableRate && (
                    <td className="px-1 py-1 border-b">
                      <select
                        value={normalizeTvaRate(currentRow.tauxTVA)}
                        onChange={(e) => update(i, "tauxTVA", e.target.value)}
                        className="h-7 rounded border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-300"
                        style={{ minWidth: 110 }}
                      >
                        <option value="">Taux</option>
                        {TVA_RATE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {withSelectableRate ? (
                    <td className="px-3 py-1 border-b text-xs text-right text-gray-700 font-semibold bg-gray-50/50" style={{ minWidth: 110 }}>
                      {currentRow.montantHT && normalizeTvaRate(currentRow.tauxTVA) ? fmt(rowTva) : "-"}
                    </td>
                  ) : (
                    <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={currentRow.tva ?? ""} onChange={(e) => update(i, "tva", e.target.value)} className="h-7 px-2 text-xs" style={{ minWidth: 110 }} placeholder="0.00" /></td>
                  )}
                  <td className="px-1 py-1 border-b text-xs text-right pr-3 text-gray-600" style={{ minWidth: 110 }}>{ttc > 0 ? fmt(ttc) : "-"}</td>
                  <td className="px-2 py-1 text-center border-b">
                    <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                      className="text-emerald-400 hover:text-emerald-600 disabled:opacity-30"><Trash2 size={13} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={9} className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalHT)}</td>
              {withSelectableRate && <td className="px-3 py-2 text-xs text-center border-t text-gray-500"></td>}
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalTVA)}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalTTC)}</td>
              <td className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" size="sm" onClick={addRow}
          className="gap-1.5 text-xs border-green-500 text-green-600 hover:bg-green-50">
          <Plus size={13} /> Ajouter une ligne
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 4 - ETAT DROITS TIMBRE (controlled)
// 
type TimbreRow = { designation: string; caTTCEsp: string; droitTimbre: string }

interface Tab4Props { rows: TimbreRow[]; setRows: React.Dispatch<React.SetStateAction<TimbreRow[]>>;
  onSave: () => void;
  isSubmitting: boolean;
}

function TabDroitsTimbre({ rows, setRows, onSave, isSubmitting }: Tab4Props) {
  const addRow    = () => setRows((p) => [...p, { designation: "", caTTCEsp: "", droitTimbre: "" }])
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const update    = (i: number, field: keyof TimbreRow, val: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)))

  const totalCA    = rows.reduce((s, r) => s + num(r.caTTCEsp), 0)
  const totalDroit = rows.reduce((s, r) => s + num(r.droitTimbre), 0)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400 border-b w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">DESIGNATIONS</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">CHIFFRE D'AFFAIRES TTC ENCAISSE EN ESPECE</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">DROITS DE TIMBRE</th>
              <th className="px-2 py-2 border-b w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-2 py-1 text-center text-xs text-gray-400 border-b">{i + 1}</td>
                <td className="px-1 py-1 border-b"><Input value={row.designation} onChange={(e) => update(i, "designation", e.target.value)} className="h-7 px-2 text-xs" style={{ minWidth: 220 }} placeholder="Designation" /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.caTTCEsp} onChange={(e) => update(i, "caTTCEsp", e.target.value)} className="h-7 px-2 text-xs" style={{ minWidth: 150 }} placeholder="0.00" /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.droitTimbre} onChange={(e) => update(i, "droitTimbre", e.target.value)} className="h-7 px-2 text-xs" style={{ minWidth: 140 }} placeholder="0.00" /></td>
                <td className="px-2 py-1 text-center border-b">
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="text-emerald-400 hover:text-emerald-600 disabled:opacity-30"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalCA)}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalDroit)}</td>
              <td className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" size="sm" onClick={addRow}
          className="gap-1.5 text-xs border-green-500 text-green-600 hover:bg-green-50">
          <Plus size={13} /> Ajouter une ligne
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 5 - CA 7% & CA GLOB 1% (controlled)
// B12 = CA HT soumis a 7% (saisie)    C12 = B12  7%
// B13 = CA HT global soumis a 1%      C13 = B13  1%
// 
interface Tab5Props { b12: string; setB12: (v: string) => void; b13: string; setB13: (v: string) => void;
  onSave: () => void;
  isSubmitting: boolean;
}

function TabCA({ b12, setB12, b13, setB13, onSave, isSubmitting }: Tab5Props) {
  const c12 = num(b12) * 0.07
  const c13 = num(b13) * 0.01

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">DESIGNATIONS</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">
                MONTANT DU CHIFFRE D'AFFAIRES HT SOUMIS
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">
                MONTANT DE LA TAXE A VERSER
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">CHIFFRE D'AFFAIRES RECHARGEMENT SOUMIS A 7%</td>
              <td className="px-1 py-1 border-b">
                <AmountInput min={0} step="0.01" value={b12} onChange={(e) => setB12(e.target.value)}
                  className="h-7 px-2 text-xs" placeholder="Saisir le montant" style={{ minWidth: 200 }} />
              </td>
              <td className="px-3 py-1 border-b text-xs text-gray-700 font-semibold bg-gray-50/50">
                {b12 ? fmt(c12) : "-"}
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">CHIFFRE D'AFFAIRES GLOBAL SOUMIS A 1% (*)</td>
              <td className="px-1 py-1 border-b">
                <AmountInput min={0} step="0.01" value={b13} onChange={(e) => setB13(e.target.value)}
                  className="h-7 px-2 text-xs" placeholder="Saisir le montant" style={{ minWidth: 200 }} />
              </td>
              <td className="px-3 py-1 border-b text-xs text-gray-700 font-semibold bg-gray-50/50">
                {b13 ? fmt(c13) : "-"}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(num(b12) + num(b13))}</td>
              <td className="px-3 py-2 text-xs text-gray-700 border-t text-right [direction:rtl]">{fmt(c12 + c13)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-gray-700">
        NB: (*) LE CHIFFRE D'AFFAIRES GLOBAL SOUMIS A 1% DOIT CORRESPONDRE AU CHIFFRE D'AFFAIRES COMPTABILISE
      </p>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 6 - ETAT TAP (controlled)
// Periode : mois + annee (page-level)
// Tableau : Code (auto), Wilaya (dropdown), Commune (dropdown), Montant imposable (saisie), TAP 1,5% (auto)
// MONTANT TAP = Total(TAP 1,5%)
// 
type TAPRow = { wilayaCode: string; commune: string; tap2: string }
type SiegeEncRow = { ttc: string; ht: string }

const WILAYA_COMMUNE_DATA: WilayaCommuneEntry[] = WILAYAS_COMMUNES

const SIEGE_G1_LABELS = ["Encaissement", "Encaissement Exon\u00e9r\u00e9e"]
const SIEGE_G2_LABELS = [
  "Encaissement MOBIPOST", "Encaissement POST PAID", "Encaissement RACIMO",
  "Encaissement DME", "Encaissement SOFIA", "Encaissement CCP RECOUVREMENT A",
  "Encaissement CCP RECOUVREMENT B", "Encaissement CCP TPE",
  "Encaissement BNA TPE", "Encaissement MASTER ALGERIE POSTE",
]

const MONTHS = [
  { value: "01", label: "Janvier" },   { value: "02", label: "Fevrier" },
  { value: "03", label: "Mars" },      { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },       { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },   { value: "08", label: "Aout" },
  { value: "09", label: "Septembre" }, { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },  { value: "12", label: "Decembre" },
]
const CURRENT_YEAR = new Date().getFullYear()
const INITIAL_FISCAL_PERIOD = getCurrentFiscalPeriod()
const YEARS = Array.from({ length: 101 }, (_, i) => (2000 + i).toString())
interface Tab6Props {
  rows: TAPRow[]; setRows: React.Dispatch<React.SetStateAction<TAPRow[]>>
  mois: string; setMois: (v: string) => void
  annee: string; setAnnee: (v: string) => void
  onSave: () => void;
  isSubmitting: boolean;
}

function TabTAP({ rows, setRows, mois, setMois, annee, setAnnee, onSave, isSubmitting }: Tab6Props) {
  const addRow    = () => setRows((p) => [...p, { wilayaCode: "", commune: "", tap2: "" }])
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const updateRow = useCallback((i: number, field: keyof TAPRow, val: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [field]: val } : r))), [setRows])

  const totalImposable = rows.reduce((s, r) => s + num(r.tap2), 0)
  const totalTAP = totalImposable * 0.015
  const getWilaya = (code: string) => WILAYA_COMMUNE_DATA.find((w) => w.code === code)

  return (
    <div className="space-y-5">
      {/* Tableau */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400 border-b w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Code Wilaya</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Wilaya</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Commune</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Imposable</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">TAP 1,5%</th>
              <th className="px-2 py-2 border-b w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const wilaya = getWilaya(row.wilayaCode)
              return (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-2 py-1 text-center text-xs text-gray-400 border-b">{i + 1}</td>

                  {/* Code - automatique depuis wilaya */}
                  <td className="px-3 py-1 border-b">
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                      {row.wilayaCode || "-"}
                    </span>
                  </td>

                  {/* Wilaya dropdown */}
                  <td className="px-1 py-1 border-b">
                    <select value={row.wilayaCode}
                      onChange={(e) => { updateRow(i, "wilayaCode", e.target.value); updateRow(i, "commune", "") }}
                      className="h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-300"
                      style={{ minWidth: 190 }}>
                      <option value="">- Wilaya -</option>
                      {WILAYA_COMMUNE_DATA.map((w) => (
                        <option key={w.code} value={w.code}>{w.code} - {w.wilaya}</option>
                      ))}
                    </select>
                  </td>

                  {/* Commune dropdown - depend de la wilaya selectionnee */}
                  <td className="px-1 py-1 border-b">
                    <select value={row.commune} onChange={(e) => updateRow(i, "commune", e.target.value)}
                      disabled={!row.wilayaCode}
                      className="h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-300 disabled:opacity-40"
                      style={{ minWidth: 165 }}>
                      <option value="">- Commune -</option>
                      {(wilaya?.communes ?? []).map((c) => {
                        const communeCode = String(c)
                        return <option key={communeCode} value={communeCode}>{communeCode}</option>
                      })}
                    </select>
                  </td>

                  {/* Montant imposable */}
                  <td className="px-1 py-1 border-b">
                    <AmountInput min={0} step="0.01" value={row.tap2}
                      onChange={(e) => updateRow(i, "tap2", e.target.value)}
                      className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 130 }} />
                  </td>

                  {/* TAP 1,5% (calcule) */}
                  <td className="px-3 py-1 border-b text-xs text-gray-700 font-semibold bg-gray-50/50 text-right [direction:rtl]">
                    {row.tap2 ? fmt(num(row.tap2) * 0.015) : "-"}
                  </td>

                  <td className="px-2 py-1 text-center border-b">
                    <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                      className="text-emerald-400 hover:text-emerald-600 disabled:opacity-30"><Trash2 size={13} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={3} className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-sm font-bold text-green-700 border-t text-right [direction:rtl]">{fmt(totalImposable)} DZD</td>
              <td className="px-3 py-2 text-sm font-bold text-green-700 border-t text-right [direction:rtl]">{fmt(totalTAP)} DZD</td>
              <td className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" size="sm" onClick={addRow}
          className="gap-1.5 text-xs border-green-500 text-green-600 hover:bg-green-50">
          <Plus size={13} /> Ajouter une ligne
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 7 - CHIFFRE D'AFFAIRE ENCAISSE SIEGE
// 
interface Tab7Props { rows: SiegeEncRow[]; setRows: React.Dispatch<React.SetStateAction<SiegeEncRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabCaSiege({ rows, setRows, onSave, isSubmitting }: Tab7Props) {
  const upd = (i: number, v: string) =>
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r

        const ttcValue = v
        const ttcNumeric = num(ttcValue)
        const htValue = (ttcValue ?? "").trim() === "" ? "" : (ttcNumeric / 1.19).toFixed(2)

        return { ...r, ttc: ttcValue, ht: htValue }
      }),
    )
  const g1 = rows.slice(0, 2)
  const g2 = rows.slice(2, 12)
  const t1ttc = g1.reduce((s, r) => s + num(r.ttc), 0)
  const t1ht  = g1.reduce((s, r) => s + (num(r.ttc) / 1.19), 0)
  const t2ttc = g2.reduce((s, r) => s + num(r.ttc), 0)
  const t2ht  = g2.reduce((s, r) => s + (num(r.ttc) / 1.19), 0)
  const totalRow: React.CSSProperties = { background: "#f3f4f6", fontWeight: 700 }
  const grandRow: React.CSSProperties = { background: "#dcfce7", fontWeight: 700 }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 border-b" style={{ width: "55%" }}>Designation</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b" style={{ width: "22.5%" }}>TTC</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b" style={{ width: "22.5%" }}>HT</th>
            </tr>
          </thead>
          <tbody>
            {SIEGE_G1_LABELS.map((lbl, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-1 text-xs border-b">{lbl}</td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" className="h-7 px-2 text-xs text-right" value={rows[i].ttc} onChange={(e) => upd(i, e.target.value)} placeholder="0.00" style={{ minWidth: 130 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" className="h-7 px-2 text-xs text-right bg-gray-100" value={(rows[i].ttc ?? "").trim() === "" ? "" : (num(rows[i].ttc) / 1.19).toFixed(2)} readOnly placeholder="0.00" style={{ minWidth: 130 }} /></td>
              </tr>
            ))}
            <tr style={totalRow}>
              <td className="px-4 py-2 text-xs border-b font-bold">TOTAL 1</td>
              <td className="px-3 py-2 text-xs border-b text-right font-bold [direction:rtl]">{fmt(t1ttc)}</td>
              <td className="px-3 py-2 text-xs border-b text-right font-bold [direction:rtl]">{fmt(t1ht)}</td>
            </tr>
            {SIEGE_G2_LABELS.map((lbl, i) => (
              <tr key={i + 2} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-1 text-xs border-b">{lbl}</td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" className="h-7 px-2 text-xs text-right" value={rows[i + 2].ttc} onChange={(e) => upd(i + 2, e.target.value)} placeholder="0.00" style={{ minWidth: 130 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" className="h-7 px-2 text-xs text-right bg-gray-100" value={(rows[i + 2].ttc ?? "").trim() === "" ? "" : (num(rows[i + 2].ttc) / 1.19).toFixed(2)} readOnly placeholder="0.00" style={{ minWidth: 130 }} /></td>
              </tr>
            ))}
            <tr style={totalRow}>
              <td className="px-4 py-2 text-xs border-b font-bold">TOTAL 2</td>
              <td className="px-3 py-2 text-xs border-b text-right font-bold [direction:rtl]">{fmt(t2ttc)}</td>
              <td className="px-3 py-2 text-xs border-b text-right font-bold [direction:rtl]">{fmt(t2ht)}</td>
            </tr>
            <tr style={grandRow}>
              <td className="px-4 py-2 text-xs font-bold text-green-800">TOTAL GENERAL</td>
              <td className="px-3 py-2 text-xs text-right font-bold text-green-800 [direction:rtl]">{fmt(t1ttc + t2ttc)}</td>
              <td className="px-3 py-2 text-xs text-right font-bold text-green-800 [direction:rtl]">{fmt(t1ht + t2ht)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 8 - SITUATION IRG
// 
type IrgRow = { assietteImposable: string; montant: string }
const IRG_LABELS = [
  "IRG sur Salaire Bareme", "Autre IRG 10%", "Autre IRG 15%",
  "Jetons de presence 15%", "Tantieme 15%",
]
interface Tab8Props { rows: IrgRow[]; setRows: React.Dispatch<React.SetStateAction<IrgRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabIRG({ rows, setRows, onSave, isSubmitting }: Tab8Props) {
  const upd = (i: number, f: keyof IrgRow, v: string) =>
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  const total = rows.reduce((s, r) => s + num(r.montant), 0)
  const totalAssiet = rows.reduce((s, r) => s + num(r.assietteImposable), 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Designation</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Assiette Imposable</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant</th>
            </tr>
          </thead>
          <tbody>
            {IRG_LABELS.map((lbl, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-1 text-xs border-b font-medium text-gray-800" style={{ minWidth: 220 }}>{lbl}</td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" className="h-7 px-2 text-xs" value={rows[i].assietteImposable} onChange={(e) => upd(i, "assietteImposable", e.target.value)} placeholder="0.00" style={{ minWidth: 150 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" className="h-7 px-2 text-xs" value={rows[i].montant} onChange={(e) => upd(i, "montant", e.target.value)} placeholder="0.00" style={{ minWidth: 150 }} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalAssiet)}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 9 - SITUATION TAXE 2%
// 
type Taxe2Row = { base: string; montant: string }
const TAXE2_LABELS = ["Taxe sur l'importation des biens et services"]
interface Tab9Props { rows: Taxe2Row[]; setRows: React.Dispatch<React.SetStateAction<Taxe2Row[]>>; onSave: () => void; isSubmitting: boolean }
function TabTaxe2({ rows, setRows, onSave, isSubmitting }: Tab9Props) {
  const upd = (i: number, f: keyof Taxe2Row, v: string) =>
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  const totalBase = rows.reduce((s, r) => s + num(r.base), 0)
  const totalMont = rows.reduce((s, r) => s + num(r.montant), 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Designation</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant de la base</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant de la Taxe 2%</th>
            </tr>
          </thead>
          <tbody>
            {TAXE2_LABELS.map((lbl, i) => (
              <tr key={i} className="bg-white">
                <td className="px-3 py-1 text-xs border-b font-medium text-gray-800" style={{ minWidth: 320 }}>{lbl}</td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" className="h-7 px-2 text-xs" value={rows[i].base} onChange={(e) => upd(i, "base", e.target.value)} placeholder="0.00" style={{ minWidth: 150 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" className="h-7 px-2 text-xs" value={rows[i].montant} onChange={(e) => upd(i, "montant", e.target.value)} placeholder="0.00" style={{ minWidth: 150 }} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalBase)}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalMont)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}
// 
// TAB 10 - ETAT DE LA TAXE 1,5% DES MASTERS
// 
type MasterRow = { date: string; nomMaster: string; numFacture: string; dateFacture: string; montantHT: string; taxe15: string; mois: string; observation: string }
const EMPTY_MASTER: MasterRow = { date: "", nomMaster: "", numFacture: "", dateFacture: "", montantHT: "", taxe15: "", mois: "", observation: "" }
interface Tab10Props { rows: MasterRow[]; setRows: React.Dispatch<React.SetStateAction<MasterRow[]>>; onSave: () => void; isSubmitting: boolean }
function TabMasters({ rows, setRows, onSave, isSubmitting }: Tab10Props) {
  const addRow    = () => setRows((p) => [...p, { ...EMPTY_MASTER }])
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const upd = (i: number, f: keyof MasterRow, v: string) =>
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  const totalHT   = rows.reduce((s, r) => s + num(r.montantHT), 0)
  const totalTaxe = rows.reduce((s, r) => s + num(r.taxe15), 0)
  const iw = { minWidth: 110 }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400 border-b w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Date</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Nom du Master</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">No de Facture</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Date de la Facture</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant de la Facture HT</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Taxe 1,5%</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Mois</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Observation</th>
              <th className="px-2 py-2 border-b w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-2 py-1 text-center text-xs text-gray-400 border-b">{i + 1}</td>
                <td className="px-1 py-1 border-b"><Input type="date" value={row.date} onChange={(e) => upd(i, "date", e.target.value)} className="h-7 px-2 text-xs" style={iw} /></td>
                <td className="px-1 py-1 border-b"><Input value={row.nomMaster} onChange={(e) => upd(i, "nomMaster", e.target.value)} className="h-7 px-2 text-xs" placeholder="Nom du Master" style={{ minWidth: 160 }} /></td>
                <td className="px-1 py-1 border-b"><Input value={row.numFacture} onChange={(e) => upd(i, "numFacture", e.target.value)} className="h-7 px-2 text-xs" placeholder="N° Facture" style={iw} /></td>
                <td className="px-1 py-1 border-b"><Input type="date" value={row.dateFacture} onChange={(e) => upd(i, "dateFacture", e.target.value)} className="h-7 px-2 text-xs" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantHT} onChange={(e) => upd(i, "montantHT", e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-3 py-1 border-b text-xs text-gray-700 font-semibold bg-gray-50/50">{row.montantHT ? fmt(num(row.montantHT) * 0.015) : "-"}</td>
                <td className="px-1 py-1 border-b">
                  <select value={row.mois} onChange={(e) => upd(i, "mois", e.target.value)}
                    className="h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none" style={{ minWidth: 110 }}>
                    <option value="">- Mois -</option>
                    {["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"]
                      .map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                  </select>
                </td>
                <td className="px-1 py-1 border-b"><Input value={row.observation} onChange={(e) => upd(i, "observation", e.target.value)} className="h-7 px-2 text-xs" placeholder="Observation" style={{ minWidth: 140 }} /></td>
                <td className="px-2 py-1 text-center border-b">
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="text-emerald-400 hover:text-emerald-600 disabled:opacity-30"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={5} className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalHT)}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(totalTaxe)}</td>
              <td colSpan={3} className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" size="sm" onClick={addRow}
          className="gap-1.5 text-xs border-green-500 text-green-600 hover:bg-green-50">
          <Plus size={13} /> Ajouter une ligne
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 11 - TAXE DE VEHICULE
// 
interface Tab11Props { montant: string; setMontant: (v: string) => void; onSave: () => void; isSubmitting: boolean }
function TabTaxeVehicule({ montant, setMontant, onSave, isSubmitting }: Tab11Props) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Designation</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="px-3 py-1 text-xs border-b font-medium text-gray-800" style={{ minWidth: 280 }}>Taxe de vehicule</td>
              <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 180 }} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 12 - TAXE DE FORMATION
// 
type Taxe12Row = { montant: string }
const TAXE12_LABELS = ["Taxe de Formation Professionnelle 1%", "Taxe d'Apprentissage 1%"]
interface Tab12Props { rows: Taxe12Row[]; setRows: React.Dispatch<React.SetStateAction<Taxe12Row[]>>; onSave: () => void; isSubmitting: boolean }
function TabTaxeFormation({ rows, setRows, onSave, isSubmitting }: Tab12Props) {
  const upd = (i: number, v: string) =>
    setRows((prev) => prev.map((r, idx) => idx === i ? { montant: v } : r))
  const total = rows.reduce((s, r) => s + num(r.montant), 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Designation</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant</th>
            </tr>
          </thead>
          <tbody>
            {TAXE12_LABELS.map((lbl, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-1 text-xs border-b font-medium text-gray-800" style={{ minWidth: 280 }}>{lbl}</td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={rows[i].montant} onChange={(e) => upd(i, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 180 }} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 13 - SITUATION DE L'ACOMPTE PROVISIONNEL (year only, 12 months)
// 
const MONTH_LABELS_SHORT = ["Janv","Fev","Mars","Avr","Mai","Juin","Juil","Aout","Sept","Oct","Nov","Dec"]
interface Tab13Props { months: string[]; setMonths: React.Dispatch<React.SetStateAction<string[]>>; annee: string; onSave: () => void; isSubmitting: boolean }
function TabAcompte({ months, setMonths, annee, onSave, isSubmitting }: Tab13Props) {
  const upd = (i: number, v: string) =>
    setMonths((prev) => prev.map((m, idx) => idx === i ? v : m))
  const yy = annee.slice(-2)
  const total = months.reduce((s, v) => s + num(v), 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b" style={{ minWidth: 100 }}>Designation</th>
              {MONTH_LABELS_SHORT.map((m) => (
                <th key={m} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b" style={{ minWidth: 90 }}>{m} {yy}</th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b" style={{ minWidth: 110 }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="px-3 py-1 text-xs border-b font-medium text-gray-800">Montant</td>
              {months.map((v, i) => (
                <td key={i} className="px-1 py-1 border-b">
                  <AmountInput min={0} step="0.01" value={v} onChange={(e) => upd(i, e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={{ minWidth: 80 }} />
                </td>
              ))}
              <td className="px-3 py-1 text-xs border-b font-semibold text-green-700 bg-green-50 text-right [direction:rtl]">{fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 14 - IBS SUR FOURNISSEURS ETRANGERS
// 
type Ibs14Row = { numFacture: string; montantBrutDevise: string; tauxChange: string; montantBrutDinars: string; montantNetDevise: string; montantIBS: string; montantNetDinars: string }
const EMPTY_IBS14: Ibs14Row = { numFacture: "", montantBrutDevise: "", tauxChange: "", montantBrutDinars: "", montantNetDevise: "", montantIBS: "", montantNetDinars: "" }
interface Tab14Props { rows: Ibs14Row[]; setRows: React.Dispatch<React.SetStateAction<Ibs14Row[]>>; onSave: () => void; isSubmitting: boolean }
function TabIBS({ rows, setRows, onSave, isSubmitting }: Tab14Props) {
  const addRow    = () => setRows((p) => [...p, { ...EMPTY_IBS14 }])
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const upd = (i: number, f: keyof Ibs14Row, v: string) =>
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  const s = (f: keyof Ibs14Row) => rows.reduce((acc, r) => acc + num(r[f] as string), 0)
  const iw = { minWidth: 120 }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400 border-b w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">No de Facture</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Brut en Devise</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Taux de Change Date du Contrat</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Brut en Dinars</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Net Transferable en Devise</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant de l'IBS (Taux...%)</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Net Transferable en Dinars</th>
              <th className="px-2 py-2 border-b w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-2 py-1 text-center text-xs text-gray-400 border-b">{i + 1}</td>
                <td className="px-1 py-1 border-b"><Input value={row.numFacture} onChange={(e) => upd(i,"numFacture",e.target.value)} className="h-7 px-2 text-xs" placeholder="N° Facture" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantBrutDevise} onChange={(e) => upd(i,"montantBrutDevise",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.tauxChange} onChange={(e) => upd(i,"tauxChange",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantBrutDinars} onChange={(e) => upd(i,"montantBrutDinars",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantNetDevise} onChange={(e) => upd(i,"montantNetDevise",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantIBS} onChange={(e) => upd(i,"montantIBS",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantNetDinars} onChange={(e) => upd(i,"montantNetDinars",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-2 py-1 text-center border-b">
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="text-emerald-400 hover:text-emerald-600 disabled:opacity-30"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(s("montantBrutDevise"))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(s("tauxChange"))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(s("montantBrutDinars"))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(s("montantNetDevise"))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(s("montantIBS"))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(s("montantNetDinars"))}</td>
              <td className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" size="sm" onClick={addRow}
          className="gap-1.5 text-xs border-green-500 text-green-600 hover:bg-green-50">
          <Plus size={13} /> Ajouter une ligne
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 15 - TAXE DOMICILIATION BANCAIRE SUR FOURNISSEURS ETRANGERS
// 
type Taxe15Row = { numFacture: string; dateFacture: string; raisonSociale: string; montantNetDevise: string; monnaie: string; tauxChange: string; montantDinars: string; tauxTaxe: string; montantAPayer: string }
const EMPTY_TAXE15: Taxe15Row = { numFacture: "", dateFacture: "", raisonSociale: "", montantNetDevise: "", monnaie: "", tauxChange: "", montantDinars: "", tauxTaxe: "", montantAPayer: "" }
interface Tab15Props { rows: Taxe15Row[]; setRows: React.Dispatch<React.SetStateAction<Taxe15Row[]>>; onSave: () => void; isSubmitting: boolean }
function TabTaxeDomicil({ rows, setRows, onSave, isSubmitting }: Tab15Props) {
  const addRow    = () => setRows((p) => [...p, { ...EMPTY_TAXE15 }])
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const upd = (i: number, f: keyof Taxe15Row, v: string) =>
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  const iw = { minWidth: 110 }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400 border-b w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">No de Facture</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Date de la Facture</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Raison Sociale</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Net en Devise</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Monnaie / Devises</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Taux de Change Date de la Facture</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Facture en Dinars</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Taux Taxe...%</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant a Payer en Dinars</th>
              <th className="px-2 py-2 border-b w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-2 py-1 text-center text-xs text-gray-400 border-b">{i + 1}</td>
                <td className="px-1 py-1 border-b"><Input value={row.numFacture} onChange={(e) => upd(i,"numFacture",e.target.value)} className="h-7 px-2 text-xs" placeholder="N° Facture" style={iw} /></td>
                <td className="px-1 py-1 border-b"><Input type="date" value={row.dateFacture} onChange={(e) => upd(i,"dateFacture",e.target.value)} className="h-7 px-2 text-xs" style={iw} /></td>
                <td className="px-1 py-1 border-b"><Input value={row.raisonSociale} onChange={(e) => upd(i,"raisonSociale",e.target.value)} className="h-7 px-2 text-xs" placeholder="Raison Sociale" style={{ minWidth: 150 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantNetDevise} onChange={(e) => upd(i,"montantNetDevise",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><Input value={row.monnaie} onChange={(e) => upd(i,"monnaie",e.target.value)} className="h-7 px-2 text-xs" placeholder="EUR / USD" style={{ minWidth: 80 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.tauxChange} onChange={(e) => upd(i,"tauxChange",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantDinars} onChange={(e) => upd(i,"montantDinars",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><Input value={row.tauxTaxe} onChange={(e) => upd(i,"tauxTaxe",e.target.value)} className="h-7 px-2 text-xs" placeholder="Taux %" style={{ minWidth: 80 }} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantAPayer} onChange={(e) => upd(i,"montantAPayer",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-2 py-1 text-center border-b">
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="text-emerald-400 hover:text-emerald-600 disabled:opacity-30"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={4} className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(rows.reduce((s,r)=>s+num(r.montantNetDevise),0))}</td>
              <td className="border-t" />
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(rows.reduce((s,r)=>s+num(r.tauxChange),0))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(rows.reduce((s,r)=>s+num(r.montantDinars),0))}</td>
              <td className="border-t" />
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(rows.reduce((s,r)=>s+num(r.montantAPayer),0))}</td>
              <td className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" size="sm" onClick={addRow}
          className="gap-1.5 text-xs border-green-500 text-green-600 hover:bg-green-50">
          <Plus size={13} /> Ajouter une ligne
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB 16 - TVA AUTO LIQUIDATION SUR FOURNISSEURS ETRANGERS
// 
type Tva16Row = { numFacture: string; montantBrutDevise: string; tauxChange: string; montantBrutDinars: string; tva19: string }
const EMPTY_TVA16: Tva16Row = { numFacture: "", montantBrutDevise: "", tauxChange: "", montantBrutDinars: "", tva19: "" }
interface Tab16Props { rows: Tva16Row[]; setRows: React.Dispatch<React.SetStateAction<Tva16Row[]>>; onSave: () => void; isSubmitting: boolean }
function TabTvaAutoLiq({ rows, setRows, onSave, isSubmitting }: Tab16Props) {
  const addRow    = () => setRows((p) => [...p, { ...EMPTY_TVA16 }])
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i))
  const upd = (i: number, f: keyof Tva16Row, v: string) =>
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  const iw = { minWidth: 130 }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-400 border-b w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">No de Facture</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Brut en Devises</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Taux de Change Date de la Facture</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Montant Brut en Dinars</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">TVA 19%</th>
              <th className="px-2 py-2 border-b w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-2 py-1 text-center text-xs text-gray-400 border-b">{i + 1}</td>
                <td className="px-1 py-1 border-b"><Input value={row.numFacture} onChange={(e) => upd(i,"numFacture",e.target.value)} className="h-7 px-2 text-xs" placeholder="N° Facture" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantBrutDevise} onChange={(e) => upd(i,"montantBrutDevise",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.tauxChange} onChange={(e) => upd(i,"tauxChange",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.montantBrutDinars} onChange={(e) => upd(i,"montantBrutDinars",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-1 py-1 border-b"><AmountInput min={0} step="0.01" value={row.tva19} onChange={(e) => upd(i,"tva19",e.target.value)} className="h-7 px-2 text-xs" placeholder="0.00" style={iw} /></td>
                <td className="px-2 py-1 text-center border-b">
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                    className="text-emerald-400 hover:text-emerald-600 disabled:opacity-30"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-semibold">
              <td colSpan={2} className="px-3 py-2 text-xs text-right border-t">TOTAL</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(rows.reduce((s,r)=>s+num(r.montantBrutDevise),0))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(rows.reduce((s,r)=>s+num(r.tauxChange),0))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(rows.reduce((s,r)=>s+num(r.montantBrutDinars),0))}</td>
              <td className="px-3 py-2 text-xs border-t text-right [direction:rtl]">{fmt(rows.reduce((s,r)=>s+num(r.tva19),0))}</td>
              <td className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" size="sm" onClick={addRow}
          className="gap-1.5 text-xs border-green-500 text-green-600 hover:bg-green-50">
          <Plus size={13} /> Ajouter une ligne
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSubmitting}
          className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
          <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}

// 
// TAB CONFIG
// 
const TABS = [
  { key: "encaissement",   label: "1 - Encaissement",              color: "#2db34b", title: "ENCAISSEMENT" },
  { key: "tva_immo",       label: "2 - TVA / IMMO",                color: "#2db34b", title: "ETAT TVA / IMMOBILISATIONS" },
  { key: "tva_biens",      label: "3 - TVA / Biens & Serv",        color: "#2db34b", title: "ETAT TVA / BIENS & SERVICES" },
  { key: "droits_timbre",  label: "4 - Droits Timbre",             color: "#2db34b", title: "ETAT DROITS DE TIMBRE" },
  { key: "ca_tap",         label: "5 - CA 7% & CA Glob 1%",        color: "#2db34b", title: "CA 7% & CA GLOBAL 1%" },
  { key: "etat_tap",       label: "6 - ETAT TAP",                  color: "#2db34b", title: "ETAT TAP" },
  { key: "ca_siege",       label: "7 - CA Siege",                  color: "#2db34b", title: "CHIFFRE D'AFFAIRE ENCAISSE SIEGE" },
  { key: "irg",            label: "8 - Situation IRG",             color: "#2db34b", title: "SITUATION IRG" },
  { key: "taxe2",          label: "9 - Taxe 2%",                   color: "#2db34b", title: "SITUATION DE LA TAXE 2%" },
  { key: "taxe_masters",   label: "10 - Taxe des Master 1,5%",       color: "#2db34b", title: "ETAT DE LA TAXE 1,5% DES MASTERS" },
  { key: "taxe_vehicule",  label: "11 - Taxe Vehicule",            color: "#2db34b", title: "TAXE DE VEHICULE" },
  { key: "taxe_formation", label: "12 - Taxe Formation",           color: "#2db34b", title: "TAXE DE FORMATION" },
  { key: "acompte",        label: "13 - Acompte Provisionnel",     color: "#2db34b", title: "SITUATION DE L'ACOMPTE PROVISIONNEL DE L'ANNEE EN COURS" },
  { key: "ibs",            label: "14 - IBS Fournisseurs Etrangers", color: "#2db34b", title: "IBS SUR FOURNISSEURS ETRANGERS" },
  { key: "taxe_domicil",  label: "15 - Taxe Domiciliation",        color: "#2db34b", title: "TAXE DOMICILIATION BANCAIRE SUR FOURNISSEURS ETRANGERS" },
  { key: "tva_autoliq",   label: "16 - TVA Auto Liquidation",      color: "#2db34b", title: "TVA AUTO LIQUIDATION SUR FOURNISSEURS ETRANGERS" },
]

type FiscalTabKey =
  | "encaissement"
  | "tva_immo"
  | "tva_biens"
  | "droits_timbre"
  | "ca_tap"
  | "etat_tap"
  | "ca_siege"
  | "irg"
  | "taxe2"
  | "taxe_masters"
  | "taxe_vehicule"
  | "taxe_formation"
  | "acompte"
  | "ibs"
  | "taxe_domicil"
  | "tva_autoliq"

interface SavedDeclaration {
  id: string
  createdAt: string
  direction: string
  mois: string
  annee: string
  encRows?: EncRow[]
  tvaImmoRows?: TvaRow[]
  tvaBiensRows?: TvaRow[]
  timbreRows?: TimbreRow[]
  b12?: string
  b13?: string
  tapRows?: TAPRow[]
  caSiegeRows?: SiegeEncRow[]
  irgRows?: IrgRow[]
  taxe2Rows?: Taxe2Row[]
  masterRows?: MasterRow[]
  taxe11Montant?: string
  taxe12Rows?: Taxe12Row[]
  acompteMonths?: string[]
  ibs14Rows?: Ibs14Row[]
  taxe15Rows?: Taxe15Row[]
  tva16Rows?: Tva16Row[]
}

type ApiFiscalDeclaration = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

type RecapMode = "declaration" | "etats_sortie"

type RecapKey = "tva_collectee" | "tva_a_payer" | "tva_situation" | "droits_timbre" | "tacp7" | "tnfdal1" | "tap15" | "masters15" | "g50"

type RecapColumn = {
  key: string
  label: string
  right?: boolean
}

type RecapDefinition = {
  key: RecapKey
  title: string
  columns: RecapColumn[]
}

const RECAP_TABS: RecapDefinition[] = [
  {
    key: "tva_collectee",
    title: "TVA collectee",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "ttc", label: "Montant des Encaissements TTC", right: true },
      { key: "exonere", label: "Montant Exonere", right: true },
      { key: "ht", label: "Montant des Encaissements HT", right: true },
      { key: "tva", label: "Montant de la TVA", right: true },
    ],
  },
  {
    key: "tva_a_payer",
    title: "TVA a payer",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "collectee", label: "TVA Collectee", right: true },
      { key: "immo", label: "TVA Deductible sur Immobilisation", right: true },
      { key: "biens", label: "TVA Deductible sur Biens et Services", right: true },
      { key: "totalDed", label: "Total TVA Deductible", right: true },
      { key: "payer", label: "TVA a Payer", right: true },
    ],
  },
  {
    key: "tva_situation",
    title: "TVA deductible",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "immo", label: "TVA Deductible sur Immobilisation", right: true },
      { key: "biens", label: "TVA Deductible sur Biens et services", right: true },
      { key: "totalDed", label: "Total TVA Deductible", right: true },
    ],
  },
  {
    key: "masters15",
    title: "TAXE MASTERS 1.5%",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "base", label: "Montant de la Base", right: true },
      { key: "taxe", label: "Montant de la Taxe 1,5%", right: true },
    ],
  },
  {
    key: "tap15",
    title: "TAP 1.5%",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "caHt", label: "Chiffres d'Affaires E HT", right: true },
      { key: "taxe", label: "Montant du TAP 1,5%", right: true },
    ],
  },
  {
    key: "tnfdal1",
    title: "Situation de la Taxe TNFDAL 1%",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "caHt", label: "Chiffres d'Affaires E HT", right: true },
      { key: "taxe", label: "Montant du TNFFDAL 1%", right: true },
    ],
  },
  {
    key: "tacp7",
    title: "Situation de la Taxe TACP 7%",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "base", label: "Montant des Recharges HT", right: true },
      { key: "taxe", label: "Montant du TACP 7%", right: true },
    ],
  },
  {
    key: "droits_timbre",
    title: "Situation des Droits de Timbre",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "caHt", label: "Chiffres d'Affaires Encaisse HT", right: true },
      { key: "montant", label: "Montant des Droits de Timbre", right: true },
    ],
  },
  {
    key: "g50",
    title: "RECAP DECLARATION G50",
    columns: [
      { key: "designation", label: "Designation" },
      { key: "montant", label: "Montant", right: true },
    ],
  },
]

const TVA_SITUATION_RECAP_ROWS = [
  "Direction Generale",
  "Direction AutoLiquidation",
  "DR Alger",
  "DR Setif",
  "DR Constantine",
  "DR Annaba",
  "DR Chlef",
  "DR Oran",
  "DR Bechar",
  "DR Ouargla",
  "Total",
]

const TVA_A_PAYER_RECAP_ROWS = [
  "Precompte",
  "Reversement",
  "Direction Generale",
  "TVA AutoLiquidation",
  "DR Alger",
  "DR Setif",
  "DR Constantine",
  "DR Annaba",
  "DR Chlef",
  "DR Oran",
  "DR Bechar",
  "DR Ouargla",
  "Total",
]

const TVA_COLLECTEE_RECAP_ROWS = [
  "BNA EXPLOITATION (Siege)",
  "CCP POST PAID (Siege)",
  "CCP MOBIPOSTE (Siege)",
  "CCP RACIMO (Siege)",
  "SOFIA CCP",
  "CCP DME",
  "ALGERIE POSTE",
  "VENTE TERMINAUX",
  "CCP RECOUVREMENT A",
  "CCP RECOUVREMENT B",
  "ENCAISSEMENT TPE CCP",
  "ENCAISSEMENT TPE BNA",
  "Total (1)",
  "DR Alger",
  "DR Setif",
  "DR Constantine",
  "DR Annaba",
  "DR Chlef",
  "DR Oran",
  "DR Bechar",
  "DR Ouargla",
  "Total (2)",
  "Total (1)+(2)",
]

const TVA_COLLECTEE_RECAP_DR_ROWS = [
  "DR Alger",
  "DR Setif",
  "DR Constantine",
  "DR Annaba",
  "DR Chlef",
  "DR Oran",
  "DR Bechar",
  "DR Ouargla",
] as const

const DROITS_TIMBRE_RECAP_ROWS = [
  "DR Alger",
  "DR Setif",
  "DR Constantine",
  "DR Annaba",
  "DR Chlef",
  "DR Oran",
  "DR Bechar",
  "DR Ouargla",
  "Total",
] as const

const TACP7_RECAP_ROWS = [
  "Masters",
  "Mobiposte",
  "Racimo",
  "Algerie Poste",
  "DR Alger",
  "DR Setif",
  "DR Constantine",
  "DR Annaba",
  "DR Chlef",
  "DR Oran",
  "DR Bechar",
  "DR Ouargla",
  "Total",
] as const

const TNFDAL1_RECAP_ROWS = [
  "Direction Generale",
  "DR Alger",
  "DR Setif",
  "DR Constantine",
  "DR Annaba",
  "DR Chlef",
  "DR Oran",
  "DR Bechar",
  "DR Ouargla",
  "Regul CA du Janvier 2025 a Juin 2025",
  "Total",
] as const

const MASTERS15_RECAP_ROWS = [
  "Masters",
  "ASSILOU COM",
  "GTS PHONE",
  "ALGERIE POSTE",
  "Total",
] as const

const G50_RECAP_ROWS = [
  "ACOMPTE PROVISIONEL",
  "TVA COLLECTEE",
  "TVA DEDUCTIBLE",
  "Total TVA a Payer (Voir la Piece)",
  "DROIT DE TIMBRE",
  "TACP 7%",
  "TNFPDAL 1%",
  "IRG SALAIRE",
  "AUTRE IRG",
  "TAXE DE FORMATION",
  "TAXE VEHICULE",
  "LA TAP",
  "TAXE 2%",
  "Total Declaration G 50 (Voir la Piece)",
  "TAXE 1,5% SUR MASTERS (Voir la Piece)",
  "Total",
] as const

const parseRecapAmount = (value: unknown): number => {
  const raw = String(value ?? "").replace(/\u00A0/g, " ").trim()
  if (!raw) return 0
  const standardized = raw.replace(/\s/g, "").replace(/,/g, ".")
  const normalizedDots = standardized.replace(/\.(?=.*\.)/g, "")
  const parsed = Number.parseFloat(normalizedDots)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatRecapAmount = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0
  const [intPart, decPart] = safe.toFixed(2).split(".")
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${formattedInt},${decPart}`
}

const normalizeRecapDesignation = (value: string): string => {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

const isTvaCollecteeRecapDrRow = (designation: string): boolean => {
  return (TVA_COLLECTEE_RECAP_DR_ROWS as readonly string[]).includes(designation)
}

const isTvaCollecteeRecapManualRow = (designation: string): boolean => {
  return TVA_COLLECTEE_RECAP_ROWS.slice(0, 12).includes(designation)
}

const isTvaCollecteeRecapTotalRow = (designation: string): boolean => {
  return designation === "Total (1)" || designation === "Total (2)" || designation === "Total (1)+(2)"
}

const resolveRegionalRecapRowByDirection = (direction: string): string | null => {
  const normalized = (direction ?? "").trim().toLowerCase()
  if (!normalized) return null

  if (
    normalized === "siege"
    || normalized === "siège"
    || normalized.includes("siege")
    || normalized.includes("siège")
    || normalized.includes("direction generale")
    || normalized.includes("direction générale")
    || normalized.includes("autoliquidation")
    || normalized.includes("auto liquidation")
  ) {
    return null
  }

  if (normalized.includes("alger")) return "DR Alger"
  if (normalized.includes("setif") || normalized.includes("sétif")) return "DR Setif"
  if (normalized.includes("constantine")) return "DR Constantine"
  if (normalized.includes("annaba")) return "DR Annaba"
  if (normalized.includes("chlef")) return "DR Chlef"
  if (normalized.includes("oran") || normalized.includes("oron") || normalized.includes("ouest")) return "DR Oran"
  if (normalized.includes("bechar") || normalized.includes("béchar")) return "DR Bechar"
  if (normalized.includes("ouargla")) return "DR Ouargla"

  return null
}

const resolveTvaSituationRecapRowByDirection = (direction: string): string | null => {
  const normalized = (direction ?? "").trim().toLowerCase()
  if (!normalized) return null

  if (
    normalized === "siege"
    || normalized === "siège"
    || normalized.includes("siege")
    || normalized.includes("siège")
    || normalized.includes("direction generale")
    || normalized.includes("direction générale")
  ) {
    return "Direction Generale"
  }

  if (normalized.includes("autoliquidation") || normalized.includes("auto liquidation")) {
    return "Direction AutoLiquidation"
  }

  return resolveRegionalRecapRowByDirection(direction)
}

const parseFiscalDataPayload = (dataJson: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(dataJson ?? "{}")
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }

  return {}
}

const getTvaAmountForRecap = (row: TvaRow): number => {
  const explicitTva = parseRecapAmount(row.tva)
  if (explicitTva > 0) return explicitTva

  const ht = parseRecapAmount(row.montantHT)
  const rate = row.tauxTVA === "9" ? 0.09 : 0.19
  return ht * rate
}

const recalcTvaCollecteeRecapRows = (rows: Record<string, string>[]): Record<string, string>[] => {
  const nextRows = rows.map((row) => ({ ...row }))

  let total1Ttc = 0
  let total1Exonere = 0
  let total1Ht = 0
  let total2Ttc = 0
  let total2Exonere = 0
  let total2Ht = 0

  for (const row of nextRows) {
    const designation = String(row.designation ?? "")
    if (isTvaCollecteeRecapTotalRow(designation)) continue

    const ttc = parseRecapAmount(row.ttc)
    const exonere = parseRecapAmount(row.exonere)
    const ht = parseRecapAmount(row.ht)
    row.tva = formatRecapAmount((ht - exonere) * 0.19)

    if (isTvaCollecteeRecapManualRow(designation)) {
      total1Ttc += ttc
      total1Exonere += exonere
      total1Ht += ht
    } else if (isTvaCollecteeRecapDrRow(designation)) {
      total2Ttc += ttc
      total2Exonere += exonere
      total2Ht += ht
    }
  }

  const total1 = nextRows.find((row) => String(row.designation ?? "") === "Total (1)")
  if (total1) {
    total1.ttc = formatRecapAmount(total1Ttc)
    total1.exonere = formatRecapAmount(total1Exonere)
    total1.ht = formatRecapAmount(total1Ht)
    total1.tva = formatRecapAmount((total1Ht - total1Exonere) * 0.19)
  }

  const total2 = nextRows.find((row) => String(row.designation ?? "") === "Total (2)")
  if (total2) {
    total2.ttc = formatRecapAmount(total2Ttc)
    total2.exonere = formatRecapAmount(total2Exonere)
    total2.ht = formatRecapAmount(total2Ht)
    total2.tva = formatRecapAmount((total2Ht - total2Exonere) * 0.19)
  }

  const total12 = nextRows.find((row) => String(row.designation ?? "") === "Total (1)+(2)")
  if (total12) {
    const ttc = total1Ttc + total2Ttc
    const exonere = total1Exonere + total2Exonere
    const ht = total1Ht + total2Ht
    total12.ttc = formatRecapAmount(ttc)
    total12.exonere = formatRecapAmount(exonere)
    total12.ht = formatRecapAmount(ht)
    total12.tva = formatRecapAmount((ht - exonere) * 0.19)
  }

  return nextRows
}

const recalcTvaSituationRecapRows = (rows: Record<string, string>[]): Record<string, string>[] => {
  const nextRows = rows.map((row) => ({ ...row }))

  let totalImmo = 0
  let totalBiens = 0

  for (const row of nextRows) {
    const designation = String(row.designation ?? "")
    if (designation === "Total") continue

    const immo = parseRecapAmount(row.immo)
    const biens = parseRecapAmount(row.biens)

    row.totalDed = formatRecapAmount(immo + biens)
    totalImmo += immo
    totalBiens += biens
  }

  const totalRow = nextRows.find((row) => String(row.designation ?? "") === "Total")
  if (totalRow) {
    totalRow.immo = formatRecapAmount(totalImmo)
    totalRow.biens = formatRecapAmount(totalBiens)
    totalRow.totalDed = formatRecapAmount(totalImmo + totalBiens)
  }

  return nextRows
}

const recalcTvaAPayerRecapRows = (rows: Record<string, string>[]): Record<string, string>[] => {
  const nextRows = rows.map((row) => ({ ...row }))

  let totalCollectee = 0
  let totalImmo = 0
  let totalBiens = 0

  for (const row of nextRows) {
    const designation = normalizeRecapDesignation(String(row.designation ?? ""))
    if (designation === "total") continue

    const collectee = parseRecapAmount(row.collectee)
    const immo = parseRecapAmount(row.immo)
    const biens = parseRecapAmount(row.biens)
    const totalDed = immo + biens

    row.totalDed = formatRecapAmount(totalDed)
    row.payer = formatRecapAmount(collectee - totalDed)

    totalCollectee += collectee
    totalImmo += immo
    totalBiens += biens
  }

  const totalRow = nextRows.find((row) => normalizeRecapDesignation(String(row.designation ?? "")) === "total")
  if (totalRow) {
    const totalDed = totalImmo + totalBiens
    totalRow.collectee = formatRecapAmount(totalCollectee)
    totalRow.immo = formatRecapAmount(totalImmo)
    totalRow.biens = formatRecapAmount(totalBiens)
    totalRow.totalDed = formatRecapAmount(totalDed)
    totalRow.payer = formatRecapAmount(totalCollectee - totalDed)
  }

  return nextRows
}

const buildTvaCollecteeRecapRows = (mois: string, annee: string, declarations: ApiFiscalDeclaration[]): Record<string, string>[] => {
  const drTtcByRow = new Map<string, number>()
  const drHtByRow = new Map<string, number>()

  for (const declaration of declarations) {
    if (declaration.mois !== mois || declaration.annee !== annee) continue
    if (declaration.tabKey !== "encaissement") continue

    const rowLabel = resolveRegionalRecapRowByDirection(declaration.direction)
    if (!rowLabel) continue

    const payload = parseFiscalDataPayload(declaration.dataJson)
    const rows = Array.isArray(payload.encRows) ? (payload.encRows as EncRow[]) : []
    const totalTtc = rows.reduce((sum, row) => sum + parseRecapAmount(row.ht) * 1.19, 0)
    const totalHt = rows.reduce((sum, row) => sum + parseRecapAmount(row.ht), 0)

    drTtcByRow.set(rowLabel, (drTtcByRow.get(rowLabel) ?? 0) + totalTtc)
    drHtByRow.set(rowLabel, (drHtByRow.get(rowLabel) ?? 0) + totalHt)
  }

  const rows = TVA_COLLECTEE_RECAP_ROWS.map((designation) => {
    if (isTvaCollecteeRecapDrRow(designation)) {
      return {
        designation,
        ttc: formatRecapAmount(drTtcByRow.get(designation) ?? 0),
        exonere: "0,00",
        ht: formatRecapAmount(drHtByRow.get(designation) ?? 0),
        tva: "0,00",
      }
    }

    return {
      designation,
      ttc: "0,00",
      exonere: "0,00",
      ht: "0,00",
      tva: "0,00",
    }
  })

  return recalcTvaCollecteeRecapRows(rows)
}

const buildTvaSituationRecapRows = (mois: string, annee: string, declarations: ApiFiscalDeclaration[]): Record<string, string>[] => {
  const immoByRow = new Map<string, number>()
  const biensByRow = new Map<string, number>()

  for (const declaration of declarations) {
    if (declaration.mois !== mois || declaration.annee !== annee) continue
    if (declaration.tabKey !== "tva_immo" && declaration.tabKey !== "tva_biens") continue

    const rowLabel = resolveTvaSituationRecapRowByDirection(declaration.direction)
    if (!rowLabel) continue

    const payload = parseFiscalDataPayload(declaration.dataJson)
    const sourceRows = declaration.tabKey === "tva_immo"
      ? (Array.isArray(payload.tvaImmoRows) ? (payload.tvaImmoRows as TvaRow[]) : [])
      : (Array.isArray(payload.tvaBiensRows) ? (payload.tvaBiensRows as TvaRow[]) : [])
    const totalTva = sourceRows.reduce((sum, row) => sum + getTvaAmountForRecap(row), 0)

    if (declaration.tabKey === "tva_immo") {
      immoByRow.set(rowLabel, (immoByRow.get(rowLabel) ?? 0) + totalTva)
    } else {
      biensByRow.set(rowLabel, (biensByRow.get(rowLabel) ?? 0) + totalTva)
    }
  }

  let totalImmo = 0
  let totalBiens = 0

  return TVA_SITUATION_RECAP_ROWS.map((designation) => {
    if (designation === "Direction Generale" || designation === "Direction AutoLiquidation") {
      return {
        designation,
        immo: "0,00",
        biens: "0,00",
        totalDed: "0,00",
      }
    }

    if (designation === "Total") {
      const totalDed = totalImmo + totalBiens
      return {
        designation,
        immo: formatRecapAmount(totalImmo),
        biens: formatRecapAmount(totalBiens),
        totalDed: formatRecapAmount(totalDed),
      }
    }

    const immo = immoByRow.get(designation) ?? 0
    const biens = biensByRow.get(designation) ?? 0
    const totalDed = immo + biens

    totalImmo += immo
    totalBiens += biens

    return {
      designation,
      immo: formatRecapAmount(immo),
      biens: formatRecapAmount(biens),
      totalDed: formatRecapAmount(totalDed),
    }
  })
}

const buildTvaAPayerRecapRows = (
  tvaCollecteeRows: Record<string, string>[],
  tvaSituationRows: Record<string, string>[],
): Record<string, string>[] => {
  const collecteeByDesignation = new Map<string, number>()
  for (const row of tvaCollecteeRows) {
    collecteeByDesignation.set(normalizeRecapDesignation(String(row.designation ?? "")), parseRecapAmount(row.tva))
  }

  const deductibleImmoByDesignation = new Map<string, number>()
  const deductibleBiensByDesignation = new Map<string, number>()
  for (const row of tvaSituationRows) {
    const key = normalizeRecapDesignation(String(row.designation ?? ""))
    deductibleImmoByDesignation.set(key, parseRecapAmount(row.immo))
    deductibleBiensByDesignation.set(key, parseRecapAmount(row.biens))
  }

  const rows = TVA_A_PAYER_RECAP_ROWS.map((designation) => {
    const normalized = normalizeRecapDesignation(designation)

    let collectee = 0
    if (normalized === "direction generale") {
      collectee = collecteeByDesignation.get(normalizeRecapDesignation("Total (1)")) ?? 0
    } else if (normalized.startsWith("dr ")) {
      collectee = collecteeByDesignation.get(normalized) ?? 0
    }

    let immo = 0
    let biens = 0
    if (normalized === "direction generale") {
      immo = deductibleImmoByDesignation.get(normalizeRecapDesignation("Direction Generale")) ?? 0
      biens = deductibleBiensByDesignation.get(normalizeRecapDesignation("Direction Generale")) ?? 0
    } else if (normalized === "tva autoliquidation") {
      immo = deductibleImmoByDesignation.get(normalizeRecapDesignation("Direction AutoLiquidation")) ?? 0
      biens = deductibleBiensByDesignation.get(normalizeRecapDesignation("Direction AutoLiquidation")) ?? 0
    } else if (normalized.startsWith("dr ")) {
      immo = deductibleImmoByDesignation.get(normalized) ?? 0
      biens = deductibleBiensByDesignation.get(normalized) ?? 0
    }

    const totalDed = immo + biens
    return {
      designation,
      collectee: formatRecapAmount(collectee),
      immo: formatRecapAmount(immo),
      biens: formatRecapAmount(biens),
      totalDed: formatRecapAmount(totalDed),
      payer: formatRecapAmount(collectee - totalDed),
    }
  })

  return recalcTvaAPayerRecapRows(rows)
}

const buildDroitsTimbreRecapRows = (
  mois: string,
  annee: string,
  declarations: ApiFiscalDeclaration[],
): Record<string, string>[] => {
  const caByRow = new Map<string, number>()
  const montantByRow = new Map<string, number>()

  for (const declaration of declarations) {
    if (declaration.mois !== mois || declaration.annee !== annee) continue
    if (declaration.tabKey !== "droits_timbre") continue

    const rowLabel = resolveRegionalRecapRowByDirection(declaration.direction)
    if (!rowLabel) continue

    const payload = parseFiscalDataPayload(declaration.dataJson)
    const rows = Array.isArray(payload.timbreRows) ? (payload.timbreRows as TimbreRow[]) : []
    const totalCa = rows.reduce((sum, row) => sum + parseRecapAmount(row.caTTCEsp), 0)
    const totalMontant = rows.reduce((sum, row) => sum + parseRecapAmount(row.droitTimbre), 0)

    caByRow.set(rowLabel, (caByRow.get(rowLabel) ?? 0) + totalCa)
    montantByRow.set(rowLabel, (montantByRow.get(rowLabel) ?? 0) + totalMontant)
  }

  let totalCa = 0
  let totalMontant = 0

  return DROITS_TIMBRE_RECAP_ROWS.map((designation) => {
    if (designation === "Total") {
      return {
        designation,
        caHt: formatRecapAmount(totalCa),
        montant: formatRecapAmount(totalMontant),
      }
    }

    const ca = caByRow.get(designation) ?? 0
    const montant = montantByRow.get(designation) ?? 0
    totalCa += ca
    totalMontant += montant

    return {
      designation,
      caHt: formatRecapAmount(ca),
      montant: formatRecapAmount(montant),
    }
  })
}

const buildTap15RecapRows = (
  mois: string,
  annee: string,
  declarations: ApiFiscalDeclaration[],
): Record<string, string>[] => {
  const baseByRow = new Map<string, number>()

  for (const declaration of declarations) {
    if (declaration.mois !== mois || declaration.annee !== annee) continue
    if (declaration.tabKey !== "etat_tap") continue

    const rowLabel = resolveRegionalRecapRowByDirection(declaration.direction)
    if (!rowLabel) continue

    const payload = parseFiscalDataPayload(declaration.dataJson)
    const rows = Array.isArray(payload.tapRows) ? (payload.tapRows as TAPRow[]) : []
    const totalBase = rows.reduce((sum, row) => sum + parseRecapAmount(row.tap2), 0)

    baseByRow.set(rowLabel, (baseByRow.get(rowLabel) ?? 0) + totalBase)
  }

  let totalBase = 0
  let totalTaxe = 0

  return TNFDAL1_RECAP_ROWS.map((designation, index) => {
    if (index === 0) {
      return {
        designation,
        caHt: "0,00",
        taxe: "0,00",
      }
    }

    if (designation === "Total") {
      return {
        designation,
        caHt: formatRecapAmount(totalBase),
        taxe: formatRecapAmount(totalTaxe),
      }
    }

    const base = baseByRow.get(designation) ?? 0
    const taxe = base * 0.015
    totalBase += base
    totalTaxe += taxe

    return {
      designation,
      caHt: formatRecapAmount(base),
      taxe: formatRecapAmount(taxe),
    }
  })
}

const buildTacp7RecapRows = (): Record<string, string>[] => {
  return TACP7_RECAP_ROWS.map((designation) => ({
    designation,
    base: "0,00",
    taxe: "0,00",
  }))
}

const buildMasters15RecapRows = (): Record<string, string>[] => {
  return MASTERS15_RECAP_ROWS.map((designation) => ({
    designation,
    base: "0",
    taxe: "0",
  }))
}

const recalcTacp7RecapRows = (rows: Record<string, string>[]): Record<string, string>[] => {
  const nextRows = rows.map((row) => ({ ...row }))
  let totalBase = 0
  let totalTaxe = 0

  for (const row of nextRows) {
    const designation = String(row.designation ?? "")
    if (designation === "Total") continue
    totalBase += parseRecapAmount(row.base)
    totalTaxe += parseRecapAmount(row.taxe)
  }

  const totalRow = nextRows.find((row) => String(row.designation ?? "") === "Total")
  if (totalRow) {
    totalRow.base = formatRecapAmount(totalBase)
    totalRow.taxe = formatRecapAmount(totalTaxe)
  }

  return nextRows
}

const recalcMasters15RecapRows = (rows: Record<string, string>[]): Record<string, string>[] => {
  const nextRows = rows.map((row) => ({ ...row }))
  let totalBase = 0
  let totalTaxe = 0

  for (const row of nextRows) {
    const designation = String(row.designation ?? "")
    if (designation === "Total") continue

    const base = parseRecapAmount(row.base)
    const taxe = parseRecapAmount(row.taxe)
    const resolvedTaxe = taxe > 0 ? taxe : base * 0.015

    row.taxe = formatRecapAmount(resolvedTaxe)
    totalBase += base
    totalTaxe += resolvedTaxe
  }

  const totalRow = nextRows.find((row) => String(row.designation ?? "") === "Total")
  if (totalRow) {
    totalRow.base = formatRecapAmount(totalBase)
    totalRow.taxe = formatRecapAmount(totalTaxe)
  }

  return nextRows
}

const getRecapRowAmount = (rows: Record<string, string>[], designation: string, key: string): number => {
  const normalized = normalizeRecapDesignation(designation)
  const row = rows.find((item) => normalizeRecapDesignation(String(item.designation ?? "")) === normalized)
  return parseRecapAmount(row?.[key])
}

const buildG50RecapRows = (
  mois: string,
  annee: string,
  declarations: ApiFiscalDeclaration[],
): Record<string, string>[] => {
  const tvaAPayerRows = buildTvaAPayerRecapRows(
    buildTvaCollecteeRecapRows(mois, annee, declarations),
    buildTvaSituationRecapRows(mois, annee, declarations),
  )
  const tvaSituationRows = buildTvaSituationRecapRows(mois, annee, declarations)
  const droitsTimbreRows = buildDroitsTimbreRecapRows(mois, annee, declarations)
  const tapRows = buildTap15RecapRows(mois, annee, declarations)

  const values = {
    acompte: 0,
    tvaCollectee: getRecapRowAmount(tvaAPayerRows, "Total", "collectee"),
    tvaDeductible: getRecapRowAmount(tvaSituationRows, "Total", "totalDed"),
    tvaAPayer: getRecapRowAmount(tvaAPayerRows, "Total", "payer"),
    droitsTimbre: getRecapRowAmount(droitsTimbreRows, "Total", "montant"),
    tacp7: 0,
    tnfpdal1: 0,
    irgSalaire: 0,
    autreIrg: 0,
    taxeFormation: 0,
    taxeVehicule: 0,
    tap: getRecapRowAmount(tapRows, "Total", "taxe"),
    taxe2: 0,
    masters15: 0,
  }

  for (const declaration of declarations) {
    if (declaration.mois !== mois || declaration.annee !== annee) continue

    const payload = parseFiscalDataPayload(declaration.dataJson)

    if (declaration.tabKey === "acompte") {
      const months = Array.isArray(payload.acompteMonths) ? (payload.acompteMonths as string[]) : []
      values.acompte += months.reduce((sum, value) => sum + parseRecapAmount(value), 0)
      continue
    }

    if (declaration.tabKey === "ca_tap") {
      const b12 = parseRecapAmount(payload.b12)
      const b13 = parseRecapAmount(payload.b13)
      values.tacp7 += b12 * 0.07
      values.tnfpdal1 += b13 * 0.01
      continue
    }

    if (declaration.tabKey === "irg") {
      const rows = Array.isArray(payload.irgRows) ? (payload.irgRows as IrgRow[]) : []
      values.irgSalaire += parseRecapAmount(rows[0]?.montant)
      values.autreIrg += rows.slice(1).reduce((sum, row) => sum + parseRecapAmount(row.montant), 0)
      continue
    }

    if (declaration.tabKey === "taxe_formation") {
      const rows = Array.isArray(payload.taxe12Rows) ? (payload.taxe12Rows as Taxe12Row[]) : []
      values.taxeFormation += rows.reduce((sum, row) => sum + parseRecapAmount(row.montant), 0)
      continue
    }

    if (declaration.tabKey === "taxe_vehicule") {
      values.taxeVehicule += parseRecapAmount(payload.taxe11Montant)
      continue
    }

    if (declaration.tabKey === "taxe2") {
      const rows = Array.isArray(payload.taxe2Rows) ? (payload.taxe2Rows as Taxe2Row[]) : []
      values.taxe2 += rows.reduce((sum, row) => sum + parseRecapAmount(row.montant), 0)
      continue
    }

    if (declaration.tabKey === "taxe_masters") {
      const rows = Array.isArray(payload.masterRows) ? (payload.masterRows as MasterRow[]) : []
      values.masters15 += rows.reduce((sum, row) => {
        const taxe = parseRecapAmount(row.taxe15)
        if (taxe > 0) return sum + taxe
        return sum + (parseRecapAmount(row.montantHT) * 0.015)
      }, 0)
      continue
    }
  }

  const totalDeclarationG50 = values.acompte
    + values.tvaCollectee
    + values.tvaDeductible
    + values.tvaAPayer
    + values.droitsTimbre
    + values.tacp7
    + values.tnfpdal1
    + values.irgSalaire
    + values.autreIrg
    + values.taxeFormation
    + values.taxeVehicule
    + values.tap
    + values.taxe2

  const totalGeneral = totalDeclarationG50 + values.masters15

  const amountByDesignation = new Map<string, number>([
    ["acompte provisionel", values.acompte],
    ["tva collectee", values.tvaCollectee],
    ["tva deductible", values.tvaDeductible],
    ["total tva a payer (voir la piece)", values.tvaAPayer],
    ["droit de timbre", values.droitsTimbre],
    ["tacp 7%", values.tacp7],
    ["tnfpdal 1%", values.tnfpdal1],
    ["irg salaire", values.irgSalaire],
    ["autre irg", values.autreIrg],
    ["taxe de formation", values.taxeFormation],
    ["taxe vehicule", values.taxeVehicule],
    ["la tap", values.tap],
    ["taxe 2%", values.taxe2],
    ["total declaration g 50 (voir la piece)", totalDeclarationG50],
    ["taxe 1,5% sur masters (voir la piece)", values.masters15],
    ["total", totalGeneral],
  ])

  return G50_RECAP_ROWS.map((designation) => ({
    designation,
    montant: formatRecapAmount(amountByDesignation.get(normalizeRecapDesignation(designation)) ?? 0),
  }))
}

const isRecapCellEditable = (recapKey: RecapKey, designation: string, columnKey: string): boolean => {
  if (columnKey === "designation") return false

  if (recapKey === "tva_collectee") {
    if (isTvaCollecteeRecapTotalRow(designation)) return false
    if (columnKey === "tva") return false
    if (isTvaCollecteeRecapDrRow(designation) && (columnKey === "ttc" || columnKey === "ht")) return false
    return true
  }

  if (recapKey === "tva_situation") {
    if (designation === "Total") return false
    if (columnKey === "totalDed") return false
    if (designation === "Direction Generale" || designation === "Direction AutoLiquidation") {
      return columnKey === "immo" || columnKey === "biens"
    }
    return false
  }

  if (recapKey === "masters15") {
    return designation !== "Total" && (columnKey === "base" || columnKey === "taxe")
  }

  if (recapKey === "tacp7") {
    return designation !== "Total" && (columnKey === "base" || columnKey === "taxe")
  }

  if (recapKey === "tap15" || recapKey === "tnfdal1" || recapKey === "droits_timbre" || recapKey === "tva_a_payer" || recapKey === "g50") return false

  return false
}

const isRecapCellMandatory = (recapKey: RecapKey, designation: string, columnKey: string): boolean => {
  if (!isRecapCellEditable(recapKey, designation, columnKey)) return false

  if (recapKey === "tva_collectee") {
    return columnKey === "ttc" || columnKey === "exonere" || columnKey === "ht"
  }

  if (recapKey === "tva_situation") {
    return columnKey === "immo" || columnKey === "biens"
  }

  return false
}

const blankZeroManualRecapCells = (recapKey: RecapKey, rows: Record<string, string>[]): Record<string, string>[] => {
  const definition = RECAP_TABS.find((item) => item.key === recapKey)
  if (!definition) return rows

  return rows.map((row) => {
    const designation = String(row.designation ?? "")
    const nextRow: Record<string, string> = { ...row }

    for (const column of definition.columns) {
      if (column.key === "designation") continue
      if (!isRecapCellEditable(recapKey, designation, column.key)) continue

      const rawValue = safeString(nextRow[column.key]).trim()
      if (!rawValue) continue

      if (parseRecapAmount(rawValue) === 0) {
        nextRow[column.key] = ""
      }
    }

    return nextRow
  })
}

const getRecapCellFormula = (recapKey: RecapKey, designation: string, columnKey: string): string => {
  const row = normalizeRecapDesignation(designation)

  if (columnKey === "designation") return "Saisie manuelle"

  if (recapKey === "g50" && columnKey === "montant") {
    if (row === "tva collectee") return "TVA collectee = TVA_a_payer.Total(colonne TVA collectee)"
    if (row === "tva deductible") return "TVA deductible = TVA_situation.Total = (TVA immo + TVA biens)"
    if (row === "total tva a payer (voir la piece)") return "TVA a payer = TVA_a_payer.Total(colonne TVA a payer) = (TVA collectee - TVA deductible)"
    if (row === "droit de timbre") return "Droit de timbre = Droits_timbre.Total"
    if (row === "tacp 7%") return "TACP 7% = SUM(CA_TAP.B12) * (7 / 100)"
    if (row === "tnfpdal 1%") return "TNFPDAL 1% = SUM(CA_TAP.B13) * (1 / 100)"
    if (row === "irg salaire") return "IRG salaire = SUM(IRG.ligne1)"
    if (row === "autre irg") return "Autre IRG = SUM(IRG.lignes2..n)"
    if (row === "taxe de formation") return "Taxe formation = (Taxe formation pro) + (Taxe d'apprentissage)"
    if (row === "taxe vehicule") return "Taxe vehicule = SUM(Tableau taxe vehicule)"
    if (row === "la tap") return "LA TAP = TAP_1.5%.Total"
    if (row === "taxe 2%") return "Taxe 2% = SUM(Tableau taxe 2%.montant)"
    if (row === "total declaration g 50 (voir la piece)") return "Total declaration G50 = (Acompte + TVA collectee + TVA deductible + TVA a payer + Droit de timbre + TACP 7% + TNFPDAL 1% + IRG salaire + Autre IRG + Taxe formation + Taxe vehicule + LA TAP + Taxe 2%)"
    if (row === "taxe 1,5% sur masters (voir la piece)") return "Taxe masters = SUM( IF(taxe15 > 0, taxe15, montantHT * (1.5 / 100)) )"
    if (row === "total") return "Total general = (Total declaration G50) + (Taxe 1.5% sur masters)"
    return "Saisie manuelle"
  }

  if (recapKey === "tva_a_payer") {
    if (row === "precompte" || row === "reversement") return "Saisie automatique"
    if (row === "total") {
      if (columnKey === "collectee") return "Somme colonne TVA Collectee"
      if (columnKey === "immo") return "Somme colonne TVA Deductible sur Immobilisation"
      if (columnKey === "biens") return "Somme colonne TVA Deductible sur Biens et Services"
      if (columnKey === "totalDed") return "Somme colonne Total de la TVA Deductible"
      if (columnKey === "payer") return "Somme colonne TVA a Payer"
    }

    if (columnKey === "collectee") return "Extrait depuis le tableau TVA collectee"
    if (columnKey === "immo") return "Extrait depuis le tableau TVA deductible"
    if (columnKey === "biens") return "Extrait depuis le tableau TVA deductible"
    if (columnKey === "totalDed") return "Total TVA deductible = (TVA immo + TVA biens)"
    if (columnKey === "payer") return "TVA a payer = (TVA collectee - Total TVA deductible)"
  }

  if (recapKey === "tva_situation") {
    if (row === "total") {
      if (columnKey === "immo") return "Somme colonne TVA Deductible sur Immobilisation"
      if (columnKey === "biens") return "Somme colonne TVA Deductible sur Biens et Services"
    }

    if (designation === "Direction Generale" || designation === "Direction AutoLiquidation") {
      if (columnKey === "immo") return "Saisie manuelle"
      if (columnKey === "biens") return "Saisie manuelle"
    } else {
      if (columnKey === "immo") return "Extrait depuis les declarations TVA / IMMO"
      if (columnKey === "biens") return "Extrait depuis les declarations TVA / Biens & Services"
    }

    if (columnKey === "totalDed") return "Total TVA deductible = (TVA immo + TVA biens)"
  }

  if (recapKey === "tva_collectee") {
    if (isTvaCollecteeRecapTotalRow(designation)) {
      if (columnKey === "ttc") return "Somme automatique"
      if (columnKey === "exonere") return "Somme automatique"
      if (columnKey === "ht") return "Somme automatique"
      if (columnKey === "tva") return "TVA = (HT - Exonere) * 19%"
    }

    if (isTvaCollecteeRecapDrRow(designation)) {
      if (columnKey === "ttc") return "Extrait depuis le tableau 1 (Encaissement TTC)"
      if (columnKey === "ht") return "Extrait depuis le tableau 1 (Encaissement HT)"
      if (columnKey === "exonere") return "Saisie manuelle"
      if (columnKey === "tva") return "TVA = (HT - Exonere) * 19%"
    }

    if (isTvaCollecteeRecapManualRow(designation)) {
      if (columnKey === "ttc") return "Saisie manuelle"
      if (columnKey === "exonere") return "Saisie manuelle"
      if (columnKey === "ht") return "Saisie manuelle"
      if (columnKey === "tva") return "TVA = (HT - Exonere) * 19%"
    }
  }

  if (recapKey === "droits_timbre") {
    if (columnKey === "caHt") return "Base CA = SUM(Droits de timbre.CA TTC especes)"
    if (columnKey === "montant") return "Montant = SUM(Droits de timbre.droit timbre)"
  }

  if (recapKey === "tnfdal1" || recapKey === "tap15") {
    if (columnKey === "caHt") return "Base = SUM(ETAT_TAP.montant imposable)"
    if (columnKey === "taxe") return "Taxe = Base * (1.5 / 100)"
  }

  if (recapKey === "masters15" && columnKey === "taxe") {
    return "Taxe proposee = Base * (1.5 / 100)"
  }

  return "Saisie manuelle"
}

const isFiscalTabKey = (value: string): value is FiscalTabKey => {
  return [
    "encaissement",
    "tva_immo",
    "tva_biens",
    "droits_timbre",
    "ca_tap",
    "etat_tap",
    "ca_siege",
    "irg",
    "taxe2",
    "taxe_masters",
    "taxe_vehicule",
    "taxe_formation",
    "acompte",
    "ibs",
    "taxe_domicil",
    "tva_autoliq",
  ].includes(value)
}

const isRecapKey = (value: string): value is RecapKey => {
  return ["tva_collectee", "tva_a_payer", "tva_situation", "droits_timbre", "tacp7", "tnfdal1", "tap15", "masters15", "g50"].includes(value)
}

const normalizeMonthValue = (value: string) => {
  return MONTHS.some((month) => month.value === value)
    ? value
    : String(new Date().getMonth() + 1).padStart(2, "0")
}

const normalizeYearValue = (value: string) => {
  return YEARS.includes(value) ? value : String(CURRENT_YEAR)
}

const fillRows = <T,>(rows: T[], size: number, makeDefault: () => T) => {
  const next = rows.slice(0, size)
  while (next.length < size) {
    next.push(makeDefault())
  }
  return next
}

const normalizeEncRows = (rows?: EncRow[]) => {
  const normalized = (rows ?? []).map((row) => {
    const source = row as Partial<EncRow> & { ttc?: string }
    const existingHt = safeString(source.ht)
    const legacyTtc = safeString(source.ttc)
    const migratedHt = legacyTtc.trim() ? (num(legacyTtc) / 1.19).toFixed(2) : ""

    return {
      designation: safeString(source.designation),
      ht: existingHt || migratedHt,
    }
  })

  return normalized.length > 0 ? normalized : [{ designation: "", ht: "" }]
}

const normalizeTvaRows = (rows?: TvaRow[]) => {
  const normalized = (rows ?? []).map((row) => {
    const source = row as Partial<TvaRow>
    return {
      ...EMPTY_TVA,
      fournisseurId: safeString(source.fournisseurId),
      nomRaisonSociale: safeString(source.nomRaisonSociale),
      adresse: safeString(source.adresse),
      nif: safeString(source.nif),
      authNif: safeString(source.authNif),
      numRC: safeString(source.numRC),
      authRC: safeString(source.authRC),
      numFacture: safeString(source.numFacture),
      dateFacture: safeString(source.dateFacture),
      montantHT: safeString(source.montantHT),
      tva: safeString(source.tva),
      tauxTVA: normalizeTvaRate(source.tauxTVA),
    }
  })
  return normalized.length > 0 ? normalized : [{ ...EMPTY_TVA }]
}

const normalizeTimbreRows = (rows?: TimbreRow[]) => {
  const normalized = (rows ?? []).map((row) => ({
    designation: safeString((row as Partial<TimbreRow>).designation),
    caTTCEsp: safeString((row as Partial<TimbreRow>).caTTCEsp),
    droitTimbre: safeString((row as Partial<TimbreRow>).droitTimbre),
  }))
  return normalized.length > 0 ? normalized : [{ designation: "", caTTCEsp: "", droitTimbre: "" }]
}

const normalizeTapRows = (rows?: TAPRow[]) => {
  const normalized = (rows ?? []).map((row) => ({
    wilayaCode: safeString((row as Partial<TAPRow>).wilayaCode),
    commune: safeString((row as Partial<TAPRow>).commune),
    tap2: safeString((row as Partial<TAPRow>).tap2),
  }))
  return normalized.length > 0 ? normalized : [{ wilayaCode: "", commune: "", tap2: "" }]
}

const normalizeSiegeRows = (rows?: SiegeEncRow[]) => {
  const normalized = (rows ?? []).map((row) => ({
    ttc: safeString((row as Partial<SiegeEncRow>).ttc),
    ht: safeString((row as Partial<SiegeEncRow>).ht),
  }))
  return fillRows(normalized, 12, () => ({ ttc: "", ht: "" }))
}

const normalizeIrgRows = (rows?: IrgRow[]) => {
  const normalized = (rows ?? []).map((row) => ({
    assietteImposable: safeString((row as Partial<IrgRow>).assietteImposable),
    montant: safeString((row as Partial<IrgRow>).montant),
  }))
  return fillRows(normalized, 5, () => ({ assietteImposable: "", montant: "" }))
}

const normalizeTaxe2Rows = (rows?: Taxe2Row[]) => {
  const normalized = (rows ?? []).map((row) => ({
    base: safeString((row as Partial<Taxe2Row>).base),
    montant: safeString((row as Partial<Taxe2Row>).montant),
  }))
  return fillRows(normalized, 1, () => ({ base: "", montant: "" }))
}

const normalizeMasterRows = (rows?: MasterRow[]) => {
  const normalized = (rows ?? []).map((row) => {
    const source = row as Partial<MasterRow>
    return {
      ...EMPTY_MASTER,
      date: safeString(source.date),
      nomMaster: safeString(source.nomMaster),
      numFacture: safeString(source.numFacture),
      dateFacture: safeString(source.dateFacture),
      montantHT: safeString(source.montantHT),
      taxe15: safeString(source.taxe15),
      mois: safeString(source.mois),
      observation: safeString(source.observation),
    }
  })
  return normalized.length > 0 ? normalized : [{ ...EMPTY_MASTER }]
}

const normalizeTaxe12Rows = (rows?: Taxe12Row[]) => {
  const normalized = (rows ?? []).map((row) => ({
    montant: safeString((row as Partial<Taxe12Row>).montant),
  }))
  return fillRows(normalized, 2, () => ({ montant: "" }))
}

const normalizeAcompteMonths = (months?: string[]) => {
  return Array.from({ length: 12 }, (_, idx) => safeString(months?.[idx]))
}

const normalizeIbsRows = (rows?: Ibs14Row[]) => {
  const normalized = (rows ?? []).map((row) => {
    const source = row as Partial<Ibs14Row>
    return {
      ...EMPTY_IBS14,
      numFacture: safeString(source.numFacture),
      montantBrutDevise: safeString(source.montantBrutDevise),
      tauxChange: safeString(source.tauxChange),
      montantBrutDinars: safeString(source.montantBrutDinars),
      montantNetDevise: safeString(source.montantNetDevise),
      montantIBS: safeString(source.montantIBS),
      montantNetDinars: safeString(source.montantNetDinars),
    }
  })
  return normalized.length > 0 ? normalized : [{ ...EMPTY_IBS14 }]
}

const normalizeTaxe15Rows = (rows?: Taxe15Row[]) => {
  const normalized = (rows ?? []).map((row) => {
    const source = row as Partial<Taxe15Row>
    return {
      ...EMPTY_TAXE15,
      numFacture: safeString(source.numFacture),
      dateFacture: safeString(source.dateFacture),
      raisonSociale: safeString(source.raisonSociale),
      montantNetDevise: safeString(source.montantNetDevise),
      monnaie: safeString(source.monnaie),
      tauxChange: safeString(source.tauxChange),
      montantDinars: safeString(source.montantDinars),
      tauxTaxe: safeString(source.tauxTaxe),
      montantAPayer: safeString(source.montantAPayer),
    }
  })
  return normalized.length > 0 ? normalized : [{ ...EMPTY_TAXE15 }]
}

const normalizeTva16Rows = (rows?: Tva16Row[]) => {
  const normalized = (rows ?? []).map((row) => {
    const source = row as Partial<Tva16Row>
    return {
      ...EMPTY_TVA16,
      numFacture: safeString(source.numFacture),
      montantBrutDevise: safeString(source.montantBrutDevise),
      tauxChange: safeString(source.tauxChange),
      montantBrutDinars: safeString(source.montantBrutDinars),
      tva19: safeString(source.tva19),
    }
  })
  return normalized.length > 0 ? normalized : [{ ...EMPTY_TVA16 }]
}

const resolveDeclarationTabKey = (decl: SavedDeclaration): FiscalTabKey => {
  if ((decl.encRows?.length ?? 0) > 0) return "encaissement"
  if ((decl.tvaImmoRows?.length ?? 0) > 0) return "tva_immo"
  if ((decl.tvaBiensRows?.length ?? 0) > 0) return "tva_biens"
  if ((decl.timbreRows?.length ?? 0) > 0) return "droits_timbre"
  if (safeString(decl.b12).trim() || safeString(decl.b13).trim()) return "ca_tap"
  if ((decl.tapRows?.length ?? 0) > 0) return "etat_tap"
  if ((decl.caSiegeRows?.length ?? 0) > 0) return "ca_siege"
  if ((decl.irgRows?.length ?? 0) > 0) return "irg"
  if ((decl.taxe2Rows?.length ?? 0) > 0) return "taxe2"
  if ((decl.masterRows?.length ?? 0) > 0) return "taxe_masters"
  if (safeString(decl.taxe11Montant).trim()) return "taxe_vehicule"
  if ((decl.taxe12Rows?.length ?? 0) > 0) return "taxe_formation"
  if ((decl.acompteMonths?.length ?? 0) > 0) return "acompte"
  if ((decl.ibs14Rows?.length ?? 0) > 0) return "ibs"
  if ((decl.taxe15Rows?.length ?? 0) > 0) return "taxe_domicil"
  if ((decl.tva16Rows?.length ?? 0) > 0) return "tva_autoliq"
  return "encaissement"
}

type TvaInvoiceDuplicateInfo = {
  fournisseur: string
  reference: string
  date: string
}

const normalizeInvoicePart = (value: unknown) => safeString(value).trim().toUpperCase()

const normalizeInvoiceDate = (value: unknown) => {
  const raw = safeString(value).trim()
  if (!raw) return ""
  if (raw.includes("T")) return raw.slice(0, 10)
  return raw
}

const getInvoiceSupplierKey = (row: TvaRow) => {
  const supplierId = normalizeInvoicePart(row.fournisseurId)
  if (supplierId) return `ID:${supplierId}`
  const supplierName = normalizeInvoicePart(row.nomRaisonSociale)
  if (supplierName) return `NAME:${supplierName}`
  return ""
}

const getInvoiceDisplayInfo = (row: TvaRow): TvaInvoiceDuplicateInfo => ({
  fournisseur: safeString(row.nomRaisonSociale).trim() || safeString(row.fournisseurId).trim() || "-",
  reference: safeString(row.numFacture).trim(),
  date: normalizeInvoiceDate(row.dateFacture),
})

const getInvoiceCompositeKey = (row: TvaRow) => {
  const supplierKey = getInvoiceSupplierKey(row)
  const reference = normalizeInvoicePart(row.numFacture)
  const date = normalizeInvoiceDate(row.dateFacture)
  if (!supplierKey || !reference || !date) return ""
  return `${supplierKey}|${reference}|${date}`
}

const findDuplicateInTvaRows = (rows: TvaRow[]): TvaInvoiceDuplicateInfo | null => {
  const seen = new Set<string>()
  for (const row of rows) {
    const key = getInvoiceCompositeKey(row)
    if (!key) continue
    if (seen.has(key)) {
      return getInvoiceDisplayInfo(row)
    }
    seen.add(key)
  }
  return null
}

const findDuplicateAcrossSavedDeclarations = (
  rows: TvaRow[],
  declarations: SavedDeclaration[],
  editingDeclarationId: string | null,
): TvaInvoiceDuplicateInfo | null => {
  const existingKeys = new Set<string>()

  for (const declaration of declarations) {
    if (editingDeclarationId && safeString(declaration.id) === editingDeclarationId) {
      continue
    }

    const historicalRows = [
      ...(declaration.tvaImmoRows ?? []),
      ...(declaration.tvaBiensRows ?? []),
    ]

    for (const historicalRow of historicalRows) {
      const key = getInvoiceCompositeKey(historicalRow)
      if (key) {
        existingKeys.add(key)
      }
    }
  }

  for (const row of rows) {
    const key = getInvoiceCompositeKey(row)
    if (!key) continue
    if (existingKeys.has(key)) {
      return getInvoiceDisplayInfo(row)
    }
  }

  return null
}

// 
// PRINT ZONE - hidden on screen, visible only when printing
// Renders a static read-only A4 landscape version of the active tab's data
// 
interface PrintZoneProps {
  activeTab: string
  direction: string
  mois: string
  annee: string
  encRows: EncRow[]
  tvaImmoRows: TvaRow[]
  tvaBiensRows: TvaRow[]
  timbreRows: TimbreRow[]
  b12: string; b13: string
  tapRows: TAPRow[]
  caSiegeRows: SiegeEncRow[]
  irgRows: IrgRow[]
  taxe2Rows: Taxe2Row[]
  masterRows: MasterRow[]
  taxe11Montant: string
  taxe12Rows: Taxe12Row[]
  acompteMonths: string[]
  ibs14Rows: Ibs14Row[]
  taxe15Rows: Taxe15Row[]
  tva16Rows: Tva16Row[]
}

function PrintZone({ activeTab, direction, mois, annee, encRows, tvaImmoRows, tvaBiensRows, timbreRows, b12, b13, tapRows, caSiegeRows, irgRows, taxe2Rows, masterRows, taxe11Montant, taxe12Rows, acompteMonths, ibs14Rows, taxe15Rows, tva16Rows }: PrintZoneProps) {
  const tab  = TABS.find((t) => t.key === activeTab)!
  const mon  = MONTHS.find((m) => m.value === mois)?.label ?? mois
  const c12  = num(b12) * 0.07
  const c13  = num(b13) * 0.01

  const thStyle: React.CSSProperties = {
    border: "1px solid #000", padding: "4px 6px", backgroundColor: "#fff", color: "#000",
    fontSize: 11, fontWeight: 700, textAlign: "left", whiteSpace: "nowrap", verticalAlign: "middle",
  }
  const tdStyle: React.CSSProperties = {
    border: "1px solid #000", padding: "3px 6px", fontSize: 9, backgroundColor: "#fff", color: "#000", verticalAlign: "middle",
  }

  return (
    <div id="print-zone" style={{ display: "none" }}>
      <style>{`
        #print-zone table th,
        #print-zone table td {
          color: #000 !important;
          text-align: center !important;
          vertical-align: middle !important;
          direction: ltr !important;
        }
        #print-zone table tbody td {
          background-color: #fff !important;
        }
        #print-zone table thead th,
        #print-zone table tfoot td,
        #print-zone table tbody tr[style*="font-weight:700"] td,
        #print-zone table tbody tr[style*="font-weight: 700"] td,
        #print-zone table tbody tr[style*="font-weight:bold"] td,
        #print-zone table tbody tr[style*="font-weight: bold"] td {
          background-color: #2db34b !important;
          color: #000 !important;
          font-weight: 800 !important;
        }
      `}</style>
      {/*  PDF header  */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 12, borderBottom: "2px solid #000", marginBottom: 20 }}>
        {/* LEFT - logo + stacked info boxes */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" style={{ height: 52, objectFit: "contain" }} />
          <div style={{ width: 260, border: "3px solid #000", backgroundColor: "#fff" }}>
            <div
              style={{
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                textAlign: "left",
                direction: "ltr",
                padding: "0 10px",
                borderBottom: "3px solid #000",
                fontSize: 13,
                fontWeight: 700,
                color: "#000",
                textTransform: "uppercase",
              }}
            >
              ATM MOBILIS
            </div>
            <div
              style={{
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                textAlign: "left",
                direction: "ltr",
                padding: "0 10px",
                fontSize: 13,
                fontWeight: 700,
                color: "#000",
              }}
            >
              DR : {direction || "-"}
            </div>
          </div>
        </div>
        {/* RIGHT - stacked month/year boxes */}
        <div
          style={{
            width: 260,
            border: "3px solid #000",
            backgroundColor: "#fff",
          }}
        >
          <div
            style={{
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              textAlign: "left",
              direction: "ltr",
              padding: "0 10px",
              borderBottom: "3px solid #000",
              fontSize: 13,
              fontWeight: 700,
              color: "#000",
            }}
          >
            Declaration Mois : {mon}
          </div>
          <div
            style={{
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              textAlign: "left",
              direction: "ltr",
              padding: "0 10px",
              fontSize: 13,
              fontWeight: 700,
              color: "#000",
            }}
          >
            Annee : {annee}
          </div>
        </div>
      </div>
      {/*  Centered title  */}
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "#000", marginBottom: 20 }}>
        {tab.title}
      </div>

      {/*  Table content per tab  */}
      {activeTab === "encaissement" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Designation</th>
            <th style={thStyle}>Encaissement HT</th>
            <th style={thStyle}>TVA</th>
            <th style={thStyle}>Encaissement TTC</th>
          </tr></thead>
          <tbody>
            {encRows.map((r, i) => {
              const ht = num(r.ht)
              const tva = ht * 0.19
              const ttc = ht + tva
              return <tr key={i} style={{ background: "#fff", color: "#000" }}>
                <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#fff", color: "#000" }}>{i + 1}</td>
                <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{r.designation}</td>
                <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{r.ht ? fmt(ht) : ""}</td>
                <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{r.ht ? fmt(tva) : ""}</td>
                <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{r.ht ? fmt(ttc) : ""}</td>
              </tr>
            })}
          </tbody>
          <tfoot><tr style={{ background: "#ddd", fontWeight: 700, color: "#000" }}>
            <td colSpan={2} style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>TOTAL</td>
            <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(encRows.reduce((s, r) => s + num(r.ht), 0))}</td>
            <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(encRows.reduce((s, r) => s + num(r.ht) * 0.19, 0))}</td>
            <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(encRows.reduce((s, r) => s + num(r.ht) * 1.19, 0))}</td>
          </tr></tfoot>
        </table>
      )}

      {(activeTab === "tva_immo" || activeTab === "tva_biens") && (() => {
        const rows = activeTab === "tva_immo" ? tvaImmoRows : tvaBiensRows
        const tHT  = rows.reduce((s, r) => s + num(r.montantHT), 0)
        const tTVA = rows.reduce((s, r) => s + getTvaAmount(r, true), 0)
        const tTTC = tHT + tTVA
        const totalLabel = activeTab === "tva_immo"
          ? "TOTAL TVA SUR IMMOBILISATION 445620"
          : "TOTAL TVA SUR BIENS ET SERVICES"
        return (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["Nom et prénoms /Raison sociale","Adresse","NIF","Authentification du NIF","RC n°","Authentification du n°RC","Facture n°","Date","Montant HT", "TVA", "Montant TTC"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const rowTva = getTvaAmount(r, true)
                const rowTTC = num(r.montantHT) + rowTva
                return <tr key={i} style={{ background: "#fff", color: "#000" }}>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{printNullableText(r.nomRaisonSociale)}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{printNullableText(r.adresse)}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{printNullableText(r.nif)}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{printNullableText(r.authNif)}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{printNullableText(r.numRC)}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{printNullableText(r.authRC)}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{r.numFacture}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{r.dateFacture}</td>
                  <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{r.montantHT ? fmt(num(r.montantHT)) : ""}</td>
                  <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{fmt(rowTva)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{r.montantHT || rowTva ? fmt(rowTTC) : ""}</td>
                </tr>
              })}
            </tbody>
            <tfoot><tr style={{ background: "#ddd", fontWeight: 700, color: "#000" }}>
              <td colSpan={8} style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{totalLabel}</td>
              <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(tHT)}</td>
              <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(tTVA)}</td>
              <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(tTTC)}</td>
            </tr></tfoot>
          </table>
        )
      })()}

      {activeTab === "droits_timbre" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            {["#","Designation","CA TTC Esp.","Droit de Timbre"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {timbreRows.map((r, i) => (
              <tr key={i} style={{ background: "#fff", color: "#000" }}>
                <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#fff", color: "#000" }}>{i+1}</td>
                <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{r.designation}</td>
                <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{r.caTTCEsp ? fmt(num(r.caTTCEsp)) : ""}</td>
                <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{r.droitTimbre ? fmt(num(r.droitTimbre)) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{ background: "#ddd", fontWeight: 700, color: "#000" }}>
            <td colSpan={2} style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>TOTAL</td>
            <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(timbreRows.reduce((s,r) => s+num(r.caTTCEsp),0))}</td>
            <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(timbreRows.reduce((s,r) => s+num(r.droitTimbre),0))}</td>
          </tr></tfoot>
        </table>
      )}

      {activeTab === "ca_tap" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            {["Designation","Chiffre d'affaires HT","Montant Taxe a verser"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            <tr style={{ background: "#fff", color: "#000" }}>
              <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>Chiffre d'affaires soumis a 7%</td>
              <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{b12 ? fmt(num(b12)) : ""}</td>
              <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{b12 ? fmt(c12) : ""}</td>
            </tr>
            <tr style={{ background: "#eee", color: "#000" }}>
              <td style={{ ...tdStyle, backgroundColor: "#eee", color: "#000" }}>Chiffre d'affaires global soumis a 1%</td>
              <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#eee", color: "#000" }}>{b13 ? fmt(num(b13)) : ""}</td>
              <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#eee", color: "#000" }}>{b13 ? fmt(c13) : ""}</td>
            </tr>
          </tbody>
          <tfoot><tr style={{ background: "#ddd", fontWeight: 700, color: "#000" }}>
            <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>TOTAL</td>
            <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(num(b12)+num(b13))}</td>
            <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>{fmt(c12+c13)}</td>
          </tr></tfoot>
        </table>
      )}

      {activeTab === "etat_tap" && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["#","Code Wilaya","Wilaya","Commune","TAP 2%"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {tapRows.map((r, i) => {
                const w = WILAYA_COMMUNE_DATA.find((w) => w.code === r.wilayaCode)
                return <tr key={i} style={{ background: "#fff", color: "#000" }}>
                  <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#fff", color: "#000" }}>{i+1}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, backgroundColor: "#fff", color: "#000" }}>{r.wilayaCode}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{w?.wilaya ?? ""}</td>
                  <td style={{ ...tdStyle, backgroundColor: "#fff", color: "#000" }}>{r.commune}</td>
                  <td style={{ ...tdStyle, textAlign: "right", backgroundColor: "#fff", color: "#000" }}>{r.tap2 ? fmt(num(r.tap2)) : ""}</td>
                </tr>
              })}
            </tbody>
            <tfoot><tr style={{ background: "#ddd", fontWeight: 700, color: "#000" }}>
              <td colSpan={4} style={{ ...tdStyle, textAlign: "right", backgroundColor: "#ddd", color: "#000" }}>MONTANT TAP</td>
              <td style={{ ...tdStyle, textAlign: "right", fontSize: 11, backgroundColor: "#ddd", color: "#000" }}>{fmt(tapRows.reduce((s,r) => s+num(r.tap2),0))} DZD</td>
            </tr></tfoot>
          </table>
        </>
      )}

      {activeTab === "ca_siege" && (() => {
        const g1 = caSiegeRows.slice(0, 2)
        const g2 = caSiegeRows.slice(2, 12)
        const t1ttc = g1.reduce((s, r) => s + num(r.ttc), 0)
        const t1ht  = g1.reduce((s, r) => s + num(r.ht), 0)
        const t2ttc = g2.reduce((s, r) => s + num(r.ttc), 0)
        const t2ht  = g2.reduce((s, r) => s + num(r.ht), 0)
        return (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["D\u00e9signation", "TTC", "HT"].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {SIEGE_G1_LABELS.map((lbl, i) => (
                <tr key={i}><td style={tdStyle}>{lbl}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{caSiegeRows[i]?.ttc ? fmt(num(caSiegeRows[i].ttc)) : ""}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{caSiegeRows[i]?.ht ? fmt(num(caSiegeRows[i].ht)) : ""}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}><td style={tdStyle}>TOTAL 1</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(t1ttc)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(t1ht)}</td>
              </tr>
              {SIEGE_G2_LABELS.map((lbl, i) => (
                <tr key={i}><td style={tdStyle}>{lbl}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{caSiegeRows[i + 2]?.ttc ? fmt(num(caSiegeRows[i + 2].ttc)) : ""}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{caSiegeRows[i + 2]?.ht ? fmt(num(caSiegeRows[i + 2].ht)) : ""}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}><td style={tdStyle}>TOTAL 2</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(t2ttc)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(t2ht)}</td>
              </tr>
              <tr style={{ fontWeight: 700 }}><td style={tdStyle}>TOTAL G\u00c9N\u00c9RAL</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(t1ttc + t2ttc)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(t1ht + t2ht)}</td>
              </tr>
            </tbody>
          </table>
        )
      })()}

      {activeTab === "irg" && (() => {
        const totalAssiette = irgRows.reduce((s,r)=>s+num(r.assietteImposable),0)
        const totalMontant  = irgRows.reduce((s,r)=>s+num(r.montant),0)
        return (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Designation","Assiette Imposable","Montant"].map(h=><th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {IRG_LABELS.map((lbl,i)=>(
                <tr key={i}>
                  <td style={tdStyle}>{lbl}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{irgRows[i]?.assietteImposable?fmt(num(irgRows[i].assietteImposable)):""}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{irgRows[i]?.montant?fmt(num(irgRows[i].montant)):""}</td>
                </tr>
              ))}
              <tr style={{fontWeight:700}}>
                <td style={tdStyle}>TOTAL</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(totalAssiette)}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(totalMontant)}</td>
              </tr>
            </tbody>
          </table>
        )
      })()}

      {activeTab === "taxe2" && (() => {
        const totalBase = taxe2Rows.reduce((s,r)=>s+num(r.base),0)
        const totalMont = taxe2Rows.reduce((s,r)=>s+num(r.montant),0)
        return (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Designation","Montant de la base","Montant de la Taxe 2%"].map(h=><th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {TAXE2_LABELS.map((lbl,i)=>(
                <tr key={i}>
                  <td style={tdStyle}>{lbl}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{taxe2Rows[i]?.base?fmt(num(taxe2Rows[i].base)):""}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{taxe2Rows[i]?.montant?fmt(num(taxe2Rows[i].montant)):""}</td>
                </tr>
              ))}
              <tr style={{fontWeight:700}}><td style={tdStyle}>TOTAL</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(totalBase)}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(totalMont)}</td>
              </tr>
            </tbody>
          </table>
        )
      })()}

      {activeTab === "taxe_masters" && (() => {
        const totalHT   = masterRows.reduce((s,r)=>s+num(r.montantHT),0)
        const totalTaxe = masterRows.reduce((s,r)=>s+num(r.montantHT)*0.015,0)
        return (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["#","Date","Nom du Master","N° Facture","Date Facture","Montant de la Facture HT","Taxe 1,5%","Mois","Observation"].map(h=><th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {masterRows.map((r,i)=>(
                <tr key={i}>
                  <td style={{...tdStyle,textAlign:"center"}}>{i+1}</td>
                  <td style={tdStyle}>{r.date}</td>
                  <td style={tdStyle}>{r.nomMaster}</td>
                  <td style={tdStyle}>{r.numFacture}</td>
                  <td style={tdStyle}>{r.dateFacture}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{r.montantHT?fmt(num(r.montantHT)):""}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{r.montantHT?fmt(num(r.montantHT)*0.015):""}</td>
                  <td style={tdStyle}>{r.mois}</td>
                  <td style={tdStyle}>{r.observation}</td>
                </tr>
              ))}
              <tr style={{fontWeight:700}}>
                <td style={tdStyle} colSpan={5}>TOTAL</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(totalHT)}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(totalTaxe)}</td>
                <td colSpan={2} style={tdStyle}/>
              </tr>
            </tbody>
          </table>
        )
      })()}

      {activeTab === "taxe_vehicule" && (
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Designation","Montant"].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            <tr><td style={tdStyle}>Taxe de vehicule</td><td style={{...tdStyle,textAlign:"right"}}>{taxe11Montant?fmt(num(taxe11Montant)):""}</td></tr>
          </tbody>
        </table>
      )}

      {activeTab === "taxe_formation" && (() => {
        const total = taxe12Rows.reduce((s,r)=>s+num(r.montant),0)
        return (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Designation","Montant"].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {TAXE12_LABELS.map((lbl,i)=>(
                <tr key={i}><td style={tdStyle}>{lbl}</td><td style={{...tdStyle,textAlign:"right"}}>{taxe12Rows[i]?.montant?fmt(num(taxe12Rows[i].montant)):""}</td></tr>
              ))}
              <tr style={{fontWeight:700}}><td style={tdStyle}>TOTAL</td><td style={{...tdStyle,textAlign:"right"}}>{fmt(total)}</td></tr>
            </tbody>
          </table>
        )
      })()}

      {activeTab === "acompte" && (() => {
        const yy = annee.slice(-2)
        return (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              <th style={thStyle}>Designation</th>
              {MONTH_LABELS_SHORT.map(m=><th key={m} style={thStyle}>{m} {yy}</th>)}
            </tr></thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Montant</td>
                {acompteMonths.map((v,i)=>(<td key={i} style={{...tdStyle,textAlign:"right"}}>{v?fmt(num(v)):""}</td>))}
              </tr>
            </tbody>
          </table>
        )
      })()}

      {activeTab === "ibs" && (() => {
        const numCols: (keyof Ibs14Row)[] = ["montantBrutDevise","montantBrutDinars","montantNetDevise","montantIBS","montantNetDinars"]
        return (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["#","N° Facture","Montant Brut Devise","Taux Change/Date","Montant Brut Dinars","Montant Net Devise","Montant IBS","Montant Net Dinars"].map(h=><th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {ibs14Rows.map((r,i)=>(
                <tr key={i}>
                  <td style={{...tdStyle,textAlign:"center"}}>{i+1}</td>
                  <td style={tdStyle}>{r.numFacture}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{r.montantBrutDevise?fmt(num(r.montantBrutDevise)):""}</td>
                  <td style={tdStyle}>{r.tauxChange}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{r.montantBrutDinars?fmt(num(r.montantBrutDinars)):""}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{r.montantNetDevise?fmt(num(r.montantNetDevise)):""}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{r.montantIBS?fmt(num(r.montantIBS)):""}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{r.montantNetDinars?fmt(num(r.montantNetDinars)):""}</td>
                </tr>
              ))}
              <tr style={{fontWeight:700}}>
                <td style={tdStyle} colSpan={2}>TOTAL</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(ibs14Rows.reduce((s,r)=>s+num(r.montantBrutDevise),0))}</td>
                <td style={tdStyle}/>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(ibs14Rows.reduce((s,r)=>s+num(r.montantBrutDinars),0))}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(ibs14Rows.reduce((s,r)=>s+num(r.montantNetDevise),0))}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(ibs14Rows.reduce((s,r)=>s+num(r.montantIBS),0))}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{fmt(ibs14Rows.reduce((s,r)=>s+num(r.montantNetDinars),0))}</td>
              </tr>
            </tbody>
          </table>
        )
      })()}

      {activeTab === "taxe_domicil" && (
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            {["#","N° Facture","Date Facture","Raison Sociale","Mont. Net Devise","Monnaie","Taux Change","Mont. Dinars","Taux Taxe","Mont. a Payer"].map(h=><th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {taxe15Rows.map((r,i)=>(
              <tr key={i}>
                <td style={{...tdStyle,textAlign:"center"}}>{i+1}</td>
                <td style={tdStyle}>{r.numFacture}</td>
                <td style={tdStyle}>{r.dateFacture}</td>
                <td style={tdStyle}>{r.raisonSociale}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{r.montantNetDevise?fmt(num(r.montantNetDevise)):""}</td>
                <td style={tdStyle}>{r.monnaie}</td>
                <td style={tdStyle}>{r.tauxChange}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{r.montantDinars?fmt(num(r.montantDinars)):""}</td>
                <td style={tdStyle}>{r.tauxTaxe}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{r.montantAPayer?fmt(num(r.montantAPayer)):""}</td>
              </tr>
            ))}
            <tr style={{fontWeight:700}}>
              <td style={tdStyle} colSpan={4}>TOTAL</td>
              <td style={{...tdStyle,textAlign:"right"}}>{fmt(taxe15Rows.reduce((s,r)=>s+num(r.montantNetDevise),0))}</td>
              <td style={tdStyle}/><td style={tdStyle}/>
              <td style={{...tdStyle,textAlign:"right"}}>{fmt(taxe15Rows.reduce((s,r)=>s+num(r.montantDinars),0))}</td>
              <td style={tdStyle}/>
              <td style={{...tdStyle,textAlign:"right"}}>{fmt(taxe15Rows.reduce((s,r)=>s+num(r.montantAPayer),0))}</td>
            </tr>
          </tbody>
        </table>
      )}

      {activeTab === "tva_autoliq" && (
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>
            {["#","N° Facture","Montant Brut Devises","Taux Change/Date","Montant Brut Dinars","TVA 19%"].map(h=><th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {tva16Rows.map((r,i)=>(
              <tr key={i}>
                <td style={{...tdStyle,textAlign:"center"}}>{i+1}</td>
                <td style={tdStyle}>{r.numFacture}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{r.montantBrutDevise?fmt(num(r.montantBrutDevise)):""}</td>
                <td style={tdStyle}>{r.tauxChange}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{r.montantBrutDinars?fmt(num(r.montantBrutDinars)):""}</td>
                <td style={{...tdStyle,textAlign:"right"}}>{r.tva19?fmt(num(r.tva19)):""}</td>
              </tr>
            ))}
            <tr style={{fontWeight:700}}>
              <td style={tdStyle} colSpan={2}>TOTAL</td>
              <td style={{...tdStyle,textAlign:"right"}}>{fmt(tva16Rows.reduce((s,r)=>s+num(r.montantBrutDevise),0))}</td>
              <td style={tdStyle}/>
              <td style={{...tdStyle,textAlign:"right"}}>{fmt(tva16Rows.reduce((s,r)=>s+num(r.montantBrutDinars),0))}</td>
              <td style={{...tdStyle,textAlign:"right"}}>{fmt(tva16Rows.reduce((s,r)=>s+num(r.tva19),0))}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

// 
// PAGE
// 
export default function NouvelleDeclarationPage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const { toast } = useToast()
  const router    = useRouter()
  const printRef  = useRef<HTMLDivElement>(null)
  const [editQuery, setEditQuery] = useState<{ editId: string; tab: string }>({ editId: "", tab: "" })

  //  Regions (fetched from API) 
  const [regions, setRegions] = useState<{ id: number; name: string }[]>([])
  const [fiscalFournisseurs, setFiscalFournisseurs] = useState<FiscalFournisseurOption[]>([])
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
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
    fetch(`${API_BASE}/api/fiscal-fournisseurs`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`)
        }
        return r.json()
      })
      .then((data: unknown) => {
        const normalized = asArrayPayload(data)
          .map((item) => normalizeFiscalFournisseurOption(item))
          .filter((item): item is FiscalFournisseurOption => item !== null)
        setFiscalFournisseurs(normalized)
      })
      .catch((err) => {
        console.error("Erreur chargement fournisseurs fiscaux:", err)
        setFiscalFournisseurs([])
      })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)

    const requestedMode = safeString(params.get("entryMode")).trim()
    if (requestedMode === "etats_sortie") {
      setEntryMode("etats_sortie")
    }

    const requestedRecapTab = safeString(params.get("recapTab")).trim()
    if (isRecapKey(requestedRecapTab)) {
      setActiveRecapTab(requestedRecapTab)
    }

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

  //  Global meta 
  const [activeTab,  setActiveTab]  = useState("encaissement")
  const [entryMode, setEntryMode] = useState<RecapMode>("declaration")
  const [activeRecapTab, setActiveRecapTab] = useState<RecapKey>("tva_collectee")
  const [direction,  setDirection]  = useState("")
  const [mois,       setMois]       = useState(INITIAL_FISCAL_PERIOD.mois)
  const [annee,      setAnnee]      = useState(INITIAL_FISCAL_PERIOD.annee)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState("")
  const [editingSourceMois, setEditingSourceMois] = useState("")
  const [editingSourceAnnee, setEditingSourceAnnee] = useState("")
  const [fiscalPolicyRevision, setFiscalPolicyRevision] = useState(0)

  //  Tab data (lifted) 
  const [encRows,       setEncRows]       = useState<EncRow[]>([{ designation: "", ht: "" }])
  const [tvaImmoRows,   setTvaImmoRows]   = useState<TvaRow[]>([{ ...EMPTY_TVA }])
  const [tvaBiensRows,  setTvaBiensRows]  = useState<TvaRow[]>([{ ...EMPTY_TVA }])
  const [timbreRows,    setTimbreRows]    = useState<TimbreRow[]>([{ designation: "", caTTCEsp: "", droitTimbre: "" }])
  const [b12,           setB12]           = useState("")
  const [b13,           setB13]           = useState("")
  const [tapRows,       setTapRows]       = useState<TAPRow[]>([{ wilayaCode: "", commune: "", tap2: "" }])
  const [siegeEncRows,  setSiegeEncRows]  = useState<SiegeEncRow[]>(Array(12).fill(null).map(() => ({ ttc: "", ht: "" })))
  const [irgRows,        setIrgRows]        = useState<IrgRow[]>(Array(5).fill(null).map(() => ({ assietteImposable: "", montant: "" })))
  const [taxe2Rows,      setTaxe2Rows]      = useState<Taxe2Row[]>([{ base: "", montant: "" }])
  const [masterRows,     setMasterRows]     = useState<MasterRow[]>([{ ...EMPTY_MASTER }])
  const [taxe11Montant,  setTaxe11Montant]  = useState("")
  const [taxe12Rows,     setTaxe12Rows]     = useState<Taxe12Row[]>([{ montant: "" }, { montant: "" }])
  const [acompteMonths,  setAcompteMonths]  = useState<string[]>(Array(12).fill(""))
  const [ibs14Rows,      setIbs14Rows]      = useState<Ibs14Row[]>([{ ...EMPTY_IBS14 }])
  const [taxe15Rows,     setTaxe15Rows]     = useState<Taxe15Row[]>([{ ...EMPTY_TAXE15 }])
  const [tva16Rows,      setTva16Rows]      = useState<Tva16Row[]>([{ ...EMPTY_TVA16 }])
  const [fiscalDeclarations, setFiscalDeclarations] = useState<ApiFiscalDeclaration[]>([])
  const [recapRowsByKey, setRecapRowsByKey] = useState<Record<RecapKey, Record<string, string>[]>>({
    tva_collectee: [],
    tva_situation: [],
    tva_a_payer: [],
    masters15: [],
    tap15: [],
    tnfdal1: [],
    tacp7: [],
    droits_timbre: [],
    g50: [],
  })

  const userRole = user?.role ?? ""
  const isAdminRole = isAdminFiscalRole(userRole)
  const isRegionalRole = isRegionalFiscalRole(userRole)
  const isFinanceRole = isFinanceFiscalRole(userRole)
  const adminSelectedDirection = safeString(direction).trim()
  const manageableTabKeys = useMemo(
    () => new Set(getManageableFiscalTabKeysForDirection(userRole, isAdminRole ? adminSelectedDirection : undefined)),
    [adminSelectedDirection, fiscalPolicyRevision, isAdminRole, userRole],
  )
  const availableTabs = useMemo(() => TABS.filter((tab) => manageableTabKeys.has(tab.key)), [manageableTabKeys])
  const disabledTabKeys = useMemo(
    () => new Set(availableTabs.filter((tab) => isFiscalTabDisabledByPolicy(tab.key)).map((tab) => tab.key)),
    [availableTabs, fiscalPolicyRevision],
  )
  const selectableTabs = useMemo(
    () => availableTabs.map((tab) => ({ ...tab, isDisabled: disabledTabKeys.has(tab.key) })),
    [availableTabs, disabledTabKeys],
  )
  const selectableYears = useMemo(
    () => YEARS.filter((year) => MONTHS.some((month) => !isFiscalPeriodLocked(month.value, year, userRole))),
    [fiscalPolicyRevision, userRole],
  )
  const selectableMonths = useMemo(
    () => MONTHS.filter((month) => !isFiscalPeriodLocked(month.value, annee, userRole)),
    [annee, fiscalPolicyRevision, userRole],
  )
  const hasFiscalTabAccess = availableTabs.length > 0
  const isActiveTabDisabled = entryMode === "declaration" ? disabledTabKeys.has(activeTab) : false
  const activeRecapDefinition = useMemo(
    () => RECAP_TABS.find((item) => item.key === activeRecapTab) ?? RECAP_TABS[0],
    [activeRecapTab],
  )
  const activeRecapRows = recapRowsByKey[activeRecapTab] ?? []

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

  const isDirectionLocked = isRegionalRole || isFinanceRole
  const effectiveDirection = isAdminRole ? safeString(direction).trim() : resolveDirectionForRole(direction)

  useEffect(() => {
    if (!userRole) return

    let cancelled = false
    const requestedDirection = isAdminRole ? adminSelectedDirection : undefined

    const syncPolicy = async () => {
      await syncFiscalPolicy(requestedDirection)
      if (!cancelled) {
        setFiscalPolicyRevision((prev) => prev + 1)
      }
    }

    syncPolicy()

    return () => {
      cancelled = true
    }
  }, [adminSelectedDirection, isAdminRole, userRole])

  const canManageTabForDirection = useCallback(
    (tabKey: string, directionValue: string) => {
      return getManageableFiscalTabKeysForDirection(userRole, isAdminRole ? directionValue : undefined).includes(tabKey)
    },
    [fiscalPolicyRevision, isAdminRole, userRole],
  )

  useEffect(() => {
    if (availableTabs.length === 0) return
    const firstEnabledTab = selectableTabs.find((tab) => !tab.isDisabled)?.key ?? availableTabs[0].key
    if (!availableTabs.some((tab) => tab.key === activeTab) || disabledTabKeys.has(activeTab)) {
      setActiveTab(firstEnabledTab)
    }
  }, [activeTab, availableTabs, disabledTabKeys, selectableTabs])

  useEffect(() => {
    if (!selectableYears.includes(annee)) {
      const fallbackYear = selectableYears[0]
      if (fallbackYear) {
        setAnnee(fallbackYear)
        return
      }
    }

    if (!selectableMonths.some((month) => month.value === mois)) {
      const fallbackMonth = selectableMonths[0]?.value
      if (fallbackMonth) {
        setMois(fallbackMonth)
      }
    }
  }, [annee, mois, selectableMonths, selectableYears])

  //  Auto-set direction based on user role 
  useEffect(() => {
    if (!user || isAdminRole) return
    setDirection((prev) => resolveDirectionForRole(prev))
  }, [user, isAdminRole, resolveDirectionForRole])

  useEffect(() => {
    if (!user || status !== "authenticated") {
      setFiscalDeclarations([])
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
          if (!cancelled) setFiscalDeclarations([])
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

        if (!cancelled) {
          setFiscalDeclarations(declarations)
        }
      } catch {
        if (!cancelled) setFiscalDeclarations([])
      }
    }

    loadDeclarations()

    return () => {
      cancelled = true
    }
  }, [status, user])

  useEffect(() => {
    const collecteeRows = buildTvaCollecteeRecapRows(mois, annee, fiscalDeclarations)
    const situationRows = buildTvaSituationRecapRows(mois, annee, fiscalDeclarations)
    const recapRows = buildTvaAPayerRecapRows(collecteeRows, situationRows)
    const masters15Rows = recalcMasters15RecapRows(buildMasters15RecapRows())
    const tap15Rows = buildTap15RecapRows(mois, annee, fiscalDeclarations)
    const tnfdal1Rows = buildTap15RecapRows(mois, annee, fiscalDeclarations)
    const tacp7Rows = recalcTacp7RecapRows(buildTacp7RecapRows())
    const droitsTimbreRows = buildDroitsTimbreRecapRows(mois, annee, fiscalDeclarations)
    const g50Rows = buildG50RecapRows(mois, annee, fiscalDeclarations)

    setRecapRowsByKey({
      tva_collectee: blankZeroManualRecapCells("tva_collectee", collecteeRows),
      tva_situation: blankZeroManualRecapCells("tva_situation", situationRows),
      tva_a_payer: recapRows,
      masters15: blankZeroManualRecapCells("masters15", masters15Rows),
      tap15: tap15Rows,
      tnfdal1: tnfdal1Rows,
      tacp7: blankZeroManualRecapCells("tacp7", tacp7Rows),
      droits_timbre: droitsTimbreRows,
      g50: g50Rows,
    })
  }, [annee, fiscalDeclarations, mois])

  useEffect(() => {
    if (isLoading || status !== "authenticated" || !user) {
      return
    }

    if (!editQuery.editId) {
      setEditingDeclarationId(null)
      setEditingCreatedAt("")
      setEditingSourceMois("")
      setEditingSourceAnnee("")
      return
    }

    try {
      const parsed = JSON.parse(localStorage.getItem("fiscal_declarations") ?? "[]")
      const declarations = Array.isArray(parsed) ? (parsed as SavedDeclaration[]) : []
      const declaration = declarations.find((item) => safeString(item.id) === editQuery.editId)

      if (!declaration) {
        toast({
          title: "Declaration introuvable",
          description: "La declaration demandee n'existe pas ou a deja ete supprimee.",
          variant: "destructive",
        })
        return
      }

      const requestedTab = isFiscalTabKey(editQuery.tab) ? editQuery.tab : resolveDeclarationTabKey(declaration)
      const loadedDirection = safeString(declaration.direction).trim()
      const scopedDirection = isAdminRole ? loadedDirection : resolveDirectionForRole(loadedDirection)

      if (!isAdminRole && !canManageTabForDirection(requestedTab, scopedDirection)) {
        toast({
          title: "Acces refuse",
          description: "Votre profil n'est pas autorise a modifier ce tableau fiscal.",
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

      setEncRows(normalizeEncRows(declaration.encRows))
      setTvaImmoRows(normalizeTvaRows(declaration.tvaImmoRows))
      setTvaBiensRows(normalizeTvaRows(declaration.tvaBiensRows))
      setTimbreRows(normalizeTimbreRows(declaration.timbreRows))
      setB12(safeString(declaration.b12))
      setB13(safeString(declaration.b13))
      setTapRows(normalizeTapRows(declaration.tapRows))
      setSiegeEncRows(normalizeSiegeRows(declaration.caSiegeRows))
      setIrgRows(normalizeIrgRows(declaration.irgRows))
      setTaxe2Rows(normalizeTaxe2Rows(declaration.taxe2Rows))
      setMasterRows(normalizeMasterRows(declaration.masterRows))
      setTaxe11Montant(safeString(declaration.taxe11Montant))
      setTaxe12Rows(normalizeTaxe12Rows(declaration.taxe12Rows))
      setAcompteMonths(normalizeAcompteMonths(declaration.acompteMonths))
      setIbs14Rows(normalizeIbsRows(declaration.ibs14Rows))
      setTaxe15Rows(normalizeTaxe15Rows(declaration.taxe15Rows))
      setTva16Rows(normalizeTva16Rows(declaration.tva16Rows))
    } catch {
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger la declaration a modifier.",
        variant: "destructive",
      })
    }
  }, [
    canManageTabForDirection,
    editQuery.editId,
    editQuery.tab,
    isAdminRole,
    isLoading,
    resolveDirectionForRole,
    router,
    status,
    user,
  ])

  const handleRecapCellChange = useCallback((rowIndex: number, columnKey: string, value: string) => {
    setRecapRowsByKey((prev) => {
      const sourceRows = prev[activeRecapTab] ?? []
      const updatedRows = sourceRows.map((row, index) => {
        if (index !== rowIndex) return row

        const designation = String(row.designation ?? "")
        if (!isRecapCellEditable(activeRecapTab, designation, columnKey)) {
          return row
        }

        const normalizedValue = normalizeAmountInput(value)
        return {
          ...row,
          [columnKey]: normalizedValue,
        }
      })

      // Recalculate computed recap tables, then keep manual zero values visually empty.
      if (activeRecapTab === "tva_collectee" || activeRecapTab === "tva_situation" || activeRecapTab === "tva_a_payer") {
        const nextRows =
          activeRecapTab === "tva_collectee"
            ? recalcTvaCollecteeRecapRows(updatedRows)
            : activeRecapTab === "tva_situation"
              ? recalcTvaSituationRecapRows(updatedRows)
              : recalcTvaAPayerRecapRows(updatedRows)

        const nextCollectee = activeRecapTab === "tva_collectee"
          ? blankZeroManualRecapCells("tva_collectee", nextRows)
          : prev.tva_collectee
        const nextSituation = activeRecapTab === "tva_situation"
          ? blankZeroManualRecapCells("tva_situation", nextRows)
          : prev.tva_situation

        return {
          ...prev,
          tva_collectee: nextCollectee,
          tva_situation: nextSituation,
          tva_a_payer: buildTvaAPayerRecapRows(nextCollectee, nextSituation),
        }
      }

      if (activeRecapTab === "tacp7") {
        return {
          ...prev,
          tacp7: blankZeroManualRecapCells("tacp7", recalcTacp7RecapRows(updatedRows)),
        }
      }

      if (activeRecapTab === "masters15") {
        return {
          ...prev,
          masters15: blankZeroManualRecapCells("masters15", recalcMasters15RecapRows(updatedRows)),
        }
      }

      // For other tables, just update the rows without recalculation
      return {
        ...prev,
        [activeRecapTab]: updatedRows,
      }
    })
  }, [activeRecapTab])

  const handleSaveEtatsSortie = useCallback(async () => {
    const currentRows = recapRowsByKey[activeRecapTab] ?? []
    const missingRequired = currentRows.some((row) => {
      const designation = String(row.designation ?? "")
      return activeRecapDefinition.columns.some((column) => {
        if (!isRecapCellMandatory(activeRecapTab, designation, column.key)) return false
        const rawValue = safeString(row[column.key]).trim()
        return rawValue === ""
      })
    })

    if (missingRequired) {
      toast({
        title: "Champs obligatoires",
        description: "Veuillez renseigner tous les champs obligatoires avant d'enregistrer l'etat de sortie.",
        variant: "destructive",
      })
      return
    }

    if (!mois || !annee) {
      toast({
        title: "Periode requise",
        description: "Le mois et l'annee sont obligatoires.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      const response = await fetch(`${API_BASE}/api/fiscal-recaps/save`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          key: activeRecapTab,
          title: activeRecapDefinition.title,
          mois,
          annee,
          rows: currentRows,
          formulas: {},
          isGenerated: false,
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        const errorMessage = errorPayload && typeof errorPayload === "object" && "message" in errorPayload
          ? String((errorPayload as { message?: unknown }).message ?? "Erreur lors de l'enregistrement")
          : "Erreur lors de l'enregistrement"

        toast({
          title: "Erreur d'enregistrement",
          description: errorMessage,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      toast({
        title: "Etat de sortie enregistre",
        description: `Le tableau ${activeRecapDefinition.title} a ete enregistre avec succes.`,
      })
      setIsSubmitting(false)
      router.push("/fisca_dashbord")
    } catch (error) {
      setIsSubmitting(false)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de contacter le serveur",
        variant: "destructive",
      })
    }
  }, [activeRecapDefinition.columns, activeRecapDefinition.title, activeRecapTab, annee, mois, recapRowsByKey, router, toast])

  if (isLoading || !user || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  const handleSave = async () => {
    if (entryMode === "etats_sortie") {
      await handleSaveEtatsSortie()
      return
    }

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

    // Validation : direction, mois, annee obligatoires
    if (!saveDirection) {
      toast({ title: "Direction requise", description: "Veuillez saisir la direction avant d'enregistrer.", variant: "destructive" })
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

    const isSourcePeriodLocked =
      !!editingDeclarationId &&
      !!editingSourceMois &&
      !!editingSourceAnnee &&
      isFiscalPeriodLocked(editingSourceMois, editingSourceAnnee, userRole)

    if (isSourcePeriodLocked) {
      toast({
        title: "Periode cloturee",
        description: `${getFiscalPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification n'est autorisee.`,
        variant: "destructive",
      })
      return
    }

    if (isFiscalPeriodLocked(mois, annee, userRole)) {
      toast({
        title: "Periode cloturee",
        description: `${getFiscalPeriodLockMessage(mois, annee, userRole)} Aucune creation ou modification n'est autorisee.`,
        variant: "destructive",
      })
      return
    }

    // Validation : aucune case du tableau actif ne doit etre vide
    let validationError = false
    switch (activeTab) {
      case "encaissement":
        if (encRows.some(r => !r.designation.trim() || !r.ht)) {
          toast({ title: "Champs incomplets", description: "Tous les champs du tableau doivent etre remplis.", variant: "destructive" })
          validationError = true
        }
        break
      case "tva_immo":
        if (tvaImmoRows.some(r => !r.fournisseurId || !r.nomRaisonSociale.trim() || !r.nif.trim() || !r.adresse.trim() || !r.numRC.trim() || !r.dateFacture || !r.numFacture.trim() || !r.montantHT || !normalizeTvaRate(r.tauxTVA))) {
          toast({ title: "Champs incomplets", description: "Tous les champs du tableau doivent etre remplis.", variant: "destructive" })
          validationError = true
        }
        break
      case "tva_biens":
        if (tvaBiensRows.some(r => !r.fournisseurId || !r.nomRaisonSociale.trim() || !r.nif.trim() || !r.adresse.trim() || !r.numRC.trim() || !r.dateFacture || !r.numFacture.trim() || !r.montantHT || !normalizeTvaRate(r.tauxTVA))) {
          toast({ title: "Champs incomplets", description: "Tous les champs du tableau doivent etre remplis.", variant: "destructive" })
          validationError = true
        }
        break
      case "droits_timbre":
        if (timbreRows.some(r => !r.designation.trim() || !r.caTTCEsp || !r.droitTimbre)) {
          toast({ title: "Champs incomplets", description: "Tous les champs du tableau doivent etre remplis.", variant: "destructive" })
          validationError = true
        }
        break
      case "ca_tap":
        if (!b12 || !b13) {
          toast({ title: "Champs incomplets", description: "Tous les champs doivent etre remplis.", variant: "destructive" })
          validationError = true
        }
        break
      case "etat_tap":
        if (tapRows.some(r => !r.wilayaCode || !r.commune.trim() || !r.tap2)) {
          toast({ title: "Champs incomplets", description: "Tous les champs du tableau doivent etre remplis.", variant: "destructive" })
          validationError = true
        }
        break
      case "ca_siege":
        if (siegeEncRows.every(r => !r.ttc && !r.ht)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner au moins une ligne du tableau Siege.", variant: "destructive" })
          validationError = true
        }
        break
      case "irg":
        if (irgRows.every(r => !r.assietteImposable && !r.montant)) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner au moins une ligne IRG.", variant: "destructive" })
          validationError = true
        }
        break
      case "taxe2":
        if (!taxe2Rows[0].base && !taxe2Rows[0].montant) {
          toast({ title: "Champs incomplets", description: "Veuillez renseigner la ligne Taxe 2%.", variant: "destructive" })
          validationError = true
        }
        break
    }

    if (validationError) return

    let existingDeclarations: SavedDeclaration[] = []
    try {
      const parsed = JSON.parse(localStorage.getItem("fiscal_declarations") ?? "[]")
      existingDeclarations = Array.isArray(parsed) ? (parsed as SavedDeclaration[]) : []
    } catch {
      existingDeclarations = []
    }

    const originalDeclaration = editingDeclarationId
      ? existingDeclarations.find((item) => safeString(item.id) === editingDeclarationId) ?? null
      : null

    if (activeTab === "tva_immo" || activeTab === "tva_biens") {
      const currentRows = activeTab === "tva_immo" ? tvaImmoRows : tvaBiensRows

      const duplicateInCurrentTable = findDuplicateInTvaRows(currentRows)
      if (duplicateInCurrentTable) {
        toast({
          title: "Facture en doublon",
          description: `Doublon detecte dans le tableau: Fournisseur "${duplicateInCurrentTable.fournisseur}", Reference "${duplicateInCurrentTable.reference}", Date "${duplicateInCurrentTable.date}".`,
          variant: "destructive",
        })
        return
      }

      const duplicateInHistory = findDuplicateAcrossSavedDeclarations(currentRows, existingDeclarations, editingDeclarationId)
      if (duplicateInHistory) {
        toast({
          title: "Facture deja enregistree",
          description: `Cette facture existe deja (tableau 2/3, toutes periodes): Fournisseur "${duplicateInHistory.fournisseur}", Reference "${duplicateInHistory.reference}", Date "${duplicateInHistory.date}".`,
          variant: "destructive",
        })
        return
      }
    }

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 400))

    const declarationId = editingDeclarationId ?? Date.now().toString()
    const declarationCreatedAt = editingCreatedAt || new Date().toISOString()
    
    // Enregistrer seulement le tableau actif
    const baseDecl: SavedDeclaration = {
      id: declarationId,
      createdAt: declarationCreatedAt,
      direction: saveDirection,
      mois,
      annee,
      encRows: [] as EncRow[],
      tvaImmoRows: [] as TvaRow[],
      tvaBiensRows: [] as TvaRow[],
      timbreRows: [] as TimbreRow[],
      b12: "",
      b13: "",
      tapRows: [] as TAPRow[],
      caSiegeRows: [] as SiegeEncRow[],
      irgRows: [] as IrgRow[],
      taxe2Rows: [] as Taxe2Row[],
      masterRows: [] as MasterRow[],
      taxe11Montant: "",
      taxe12Rows: [] as Taxe12Row[],
      acompteMonths: [] as string[],
      ibs14Rows: [] as Ibs14Row[],
      taxe15Rows: [] as Taxe15Row[],
      tva16Rows: [] as Tva16Row[],
    }
    
    // Remplir uniquement les donnees du tableau actif
    switch (activeTab) {
      case "encaissement":
        baseDecl.encRows = encRows
        break
      case "tva_immo":
        baseDecl.tvaImmoRows = tvaImmoRows
        break
      case "tva_biens":
        baseDecl.tvaBiensRows = tvaBiensRows
        break
      case "droits_timbre":
        baseDecl.timbreRows = timbreRows
        break
      case "ca_tap":
        baseDecl.b12 = b12
        baseDecl.b13 = b13
        break
      case "etat_tap":
        baseDecl.tapRows = tapRows
        break
      case "ca_siege":
        baseDecl.caSiegeRows = siegeEncRows
        break
      case "irg":
        baseDecl.irgRows = irgRows
        break
      case "taxe2":
        baseDecl.taxe2Rows = taxe2Rows
        break
      case "taxe_masters":
        baseDecl.masterRows = masterRows
        break
      case "taxe_vehicule":
        baseDecl.taxe11Montant = taxe11Montant
        break
      case "taxe_formation":
        baseDecl.taxe12Rows = taxe12Rows
        break
      case "acompte":
        baseDecl.acompteMonths = acompteMonths
        break
      case "ibs":
        baseDecl.ibs14Rows = ibs14Rows
        break
      case "taxe_domicil":
        baseDecl.taxe15Rows = taxe15Rows
        break
      case "tva_autoliq":
        baseDecl.tva16Rows = tva16Rows
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

    // Persist to database
    try {
      const apiBase = API_BASE
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("jwt") : null
      let tabData: unknown = {}
      switch (activeTab) {
        case "encaissement":   tabData = { encRows }; break
        case "tva_immo":       tabData = { tvaImmoRows }; break
        case "tva_biens":      tabData = { tvaBiensRows }; break
        case "droits_timbre":  tabData = { timbreRows }; break
        case "ca_tap":         tabData = { b12, b13 }; break
        case "etat_tap":       tabData = { tapRows }; break
        case "ca_siege":       tabData = { caSiegeRows: siegeEncRows }; break
        case "irg":            tabData = { irgRows }; break
        case "taxe2":          tabData = { taxe2Rows }; break
        case "taxe_masters":   tabData = { masterRows }; break
        case "taxe_vehicule":  tabData = { taxe11Montant }; break
        case "taxe_formation": tabData = { taxe12Rows }; break
        case "acompte":        tabData = { acompteMonths }; break
        case "ibs":            tabData = { ibs14Rows }; break
        case "taxe_domicil":   tabData = { taxe15Rows }; break
        case "tva_autoliq":    tabData = { tva16Rows }; break
      }
      const requestPayload = {
        tabKey: activeTab,
        mois,
        annee,
        direction: saveDirection,
        dataJson: JSON.stringify(tabData),
      }

      if (editingDeclarationId) {
        const deleteResponse = await fetch(`${apiBase}/api/fiscal/${encodeURIComponent(editingDeclarationId)}`, {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const deleteErrorPayload = await deleteResponse.json().catch(() => ({}))
          const deleteErrorMessage = deleteErrorPayload && typeof deleteErrorPayload === "object" && "message" in deleteErrorPayload
            ? String((deleteErrorPayload as { message?: unknown }).message ?? "Erreur lors de la suppression avant modification")
            : "Erreur lors de la suppression avant modification"

          try {
            localStorage.setItem("fiscal_declarations", JSON.stringify(existingDeclarations))
          } catch {
            // Ignore local cache restore failures.
          }

          setIsSubmitting(false)
          toast({
            title: "Erreur de modification",
            description: deleteErrorMessage,
            variant: "destructive",
          })
          return
        }
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
        const errorPayload = await createResponse.json().catch(() => ({}))
        const errorMessage = errorPayload && typeof errorPayload === "object" && "message" in errorPayload
          ? String((errorPayload as { message?: unknown }).message ?? "Erreur lors de l'enregistrement")
          : "Erreur lors de l'enregistrement"

        let restoreSucceeded = false
        if (editingDeclarationId && originalDeclaration) {
          let restoreTabData: unknown = {}
          switch (activeTab) {
            case "encaissement":   restoreTabData = { encRows: originalDeclaration.encRows ?? [] }; break
            case "tva_immo":       restoreTabData = { tvaImmoRows: originalDeclaration.tvaImmoRows ?? [] }; break
            case "tva_biens":      restoreTabData = { tvaBiensRows: originalDeclaration.tvaBiensRows ?? [] }; break
            case "droits_timbre":  restoreTabData = { timbreRows: originalDeclaration.timbreRows ?? [] }; break
            case "ca_tap":         restoreTabData = { b12: originalDeclaration.b12 ?? "", b13: originalDeclaration.b13 ?? "" }; break
            case "etat_tap":       restoreTabData = { tapRows: originalDeclaration.tapRows ?? [] }; break
            case "ca_siege":       restoreTabData = { caSiegeRows: originalDeclaration.caSiegeRows ?? [] }; break
            case "irg":            restoreTabData = { irgRows: originalDeclaration.irgRows ?? [] }; break
            case "taxe2":          restoreTabData = { taxe2Rows: originalDeclaration.taxe2Rows ?? [] }; break
            case "taxe_masters":   restoreTabData = { masterRows: originalDeclaration.masterRows ?? [] }; break
            case "taxe_vehicule":  restoreTabData = { taxe11Montant: originalDeclaration.taxe11Montant ?? "" }; break
            case "taxe_formation": restoreTabData = { taxe12Rows: originalDeclaration.taxe12Rows ?? [] }; break
            case "acompte":        restoreTabData = { acompteMonths: originalDeclaration.acompteMonths ?? [] }; break
            case "ibs":            restoreTabData = { ibs14Rows: originalDeclaration.ibs14Rows ?? [] }; break
            case "taxe_domicil":   restoreTabData = { taxe15Rows: originalDeclaration.taxe15Rows ?? [] }; break
            case "tva_autoliq":    restoreTabData = { tva16Rows: originalDeclaration.tva16Rows ?? [] }; break
          }

          const restoreResponse = await fetch(`${apiBase}/api/fiscal`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              tabKey: activeTab,
              mois: originalDeclaration.mois,
              annee: originalDeclaration.annee,
              direction: originalDeclaration.direction,
              dataJson: JSON.stringify(restoreTabData),
            }),
          })

          restoreSucceeded = restoreResponse.ok
        }

        try {
          localStorage.setItem("fiscal_declarations", JSON.stringify(existingDeclarations))
        } catch {
          // Ignore local cache restore failures.
        }

        const finalErrorMessage = restoreSucceeded
          ? `${errorMessage} L'ancienne déclaration a été restaurée automatiquement.`
          : errorMessage

        setIsSubmitting(false)
        toast({
          title: "Erreur d'enregistrement",
          description: finalErrorMessage,
          variant: "destructive",
        })
        return
      }
    } catch (error) {
      try {
        localStorage.setItem("fiscal_declarations", JSON.stringify(existingDeclarations))
      } catch {
        // Ignore local cache restore failures.
      }

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
      title: editingDeclarationId ? " Declaration modifiee" : " Declaration enregistree",
      description: `La declaration "${tabLabel}" a ete sauvegardee avec succes.`,
    })
    setIsSubmitting(false)
    router.push("/fisca_dashbord")
  }


  const activeColor = TABS.find((t) => t.key === activeTab)?.color ?? "#2db34b"
  const mon = MONTHS.find((m) => m.value === mois)?.label ?? mois
  const directionSelectValue = entryMode === "etats_sortie" ? "Siege" : effectiveDirection
  const currentPeriodLockMessage = (() => {
    if (editingDeclarationId && editingSourceMois && editingSourceAnnee && isFiscalPeriodLocked(editingSourceMois, editingSourceAnnee, userRole)) {
      return `${getFiscalPeriodLockMessage(editingSourceMois, editingSourceAnnee, userRole)} Aucune modification n'est autorisee.`
    }
    if (isFiscalPeriodLocked(mois, annee, userRole)) {
      return `${getFiscalPeriodLockMessage(mois, annee, userRole)} Aucune creation ou modification n'est autorisee.`
    }
    return ""
  })()

  return (
    <LayoutWrapper user={user}>
      {/* Block global (direction) role */}
      {user.role === "direction" || !hasFiscalTabAccess ? (
        <AccessDeniedDialog
          title="Acces refuse"
          message={user.role === "direction"
            ? "Votre role ne vous permet pas de creer des declarations fiscales."
            : "Votre role ne vous permet pas de gerer les tableaux fiscaux."}
          redirectTo="/fisca_dashbord"
        />
      ) : (
        <>
        <PrintZone
        activeTab={activeTab} direction={effectiveDirection} mois={mois} annee={annee}
        encRows={encRows} tvaImmoRows={tvaImmoRows} tvaBiensRows={tvaBiensRows}
        timbreRows={timbreRows} b12={b12} b13={b13} tapRows={tapRows}
        caSiegeRows={siegeEncRows}
        irgRows={irgRows}
        taxe2Rows={taxe2Rows}
        masterRows={masterRows}
        taxe11Montant={taxe11Montant}
        taxe12Rows={taxe12Rows}
        acompteMonths={acompteMonths}
        ibs14Rows={ibs14Rows}
        taxe15Rows={taxe15Rows}
        tva16Rows={tva16Rows}
      />

      <div className="space-y-5 w-full" ref={printRef}>
        {/*  Page header bar  */}
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

        {/*  Global meta card (Direction + Periode)  */}
        <Card className="border border-gray-200">
          <CardContent className="pt-4 pb-3">
            <div className="mb-4 flex items-center justify-end">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                <span>Declaration</span>
                <Switch checked={entryMode === "etats_sortie"} onCheckedChange={(checked) => setEntryMode(checked ? "etats_sortie" : "declaration")} />
                <span>Etats de sortie</span>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-6">
      {/* Direction */}
              <div className="space-y-1 flex-1 min-w-[220px]">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Direction</label>
                <Select value={directionSelectValue} onValueChange={setDirection} disabled={isDirectionLocked || entryMode === "etats_sortie"}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="- Selectionner une direction -" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Siege">Siege</SelectItem>
                    {isDirectionLocked && effectiveDirection && effectiveDirection !== "Siege" && !regions.some((r) => r.name === effectiveDirection) && (
                      <SelectItem value={effectiveDirection}>{effectiveDirection}</SelectItem>
                    )}
                    {regions.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Mois */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Mois</label>
                <Select value={mois} onValueChange={setMois} disabled={entryMode === "declaration" && activeTab === "acompte"}>
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
              {/* Annee */}
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
              {/* Tableau */}
              <div className="space-y-1 flex-1 min-w-[220px]">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tableau</label>
                <Select value={entryMode === "declaration" ? activeTab : activeRecapTab} onValueChange={(value) => {
                  if (entryMode === "declaration") {
                    if (disabledTabKeys.has(value)) return
                    setActiveTab(value)
                    return
                  }
                  setActiveRecapTab(value as RecapKey)
                }}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selectionner un tableau" />
                  </SelectTrigger>
                  <SelectContent>
                    {entryMode === "declaration"
                      ? selectableTabs.map((t) => (
                        <SelectItem key={t.key} value={t.key} disabled={t.isDisabled} className={t.isDisabled ? "text-muted-foreground" : ""}>
                          {t.label}{t.isDisabled ? " (desactive)" : ""}
                        </SelectItem>
                      ))
                      : RECAP_TABS.map((item) => (
                        <SelectItem key={item.key} value={item.key}>{item.title}</SelectItem>
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

        {/*  Table content  */}
        <div>
          {entryMode === "etats_sortie" ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>
                  Etats de sortie - {activeRecapDefinition.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground">Survolez chaque case pour voir la regle de calcul ou 'Saisie manuelle'.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          {activeRecapDefinition.columns.map((column) => (
                            <th key={column.key} className={`px-3 py-2 text-xs font-semibold text-gray-700 border-b ${column.right ? "text-right" : "text-left"}`}>
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeRecapRows.map((row, rowIndex) => (
                          <tr key={`${activeRecapTab}-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            {activeRecapDefinition.columns.map((column) => {
                              const designation = String(row.designation ?? "")
                              const editable = isRecapCellEditable(activeRecapTab, designation, column.key)
                              const mandatory = isRecapCellMandatory(activeRecapTab, designation, column.key)
                              const cellValue = safeString(row[column.key])
                              const formula = getRecapCellFormula(activeRecapTab, designation, column.key)

                              if (column.key === "designation") {
                                return (
                                  <td key={column.key} className="px-3 py-2 border-b text-xs">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-block w-full">{cellValue}</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">{formula}</TooltipContent>
                                    </Tooltip>
                                  </td>
                                )
                              }

                              return (
                                <td key={column.key} className={`px-2 py-1 border-b ${column.right ? "text-right" : "text-left"}`}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <AmountInput
                                          value={cellValue}
                                          onChange={editable ? (event) => handleRecapCellChange(rowIndex, column.key, event.target.value) : undefined}
                                          readOnly={!editable}
                                          className={`h-7 px-2 text-xs ${editable ? "bg-white" : "bg-gray-100 text-gray-500"}`}
                                          placeholder="0,00"
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">{formula}</TooltipContent>
                                  </Tooltip>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="gap-1.5" style={{ backgroundColor: PRIMARY_COLOR, color: "white" }}>
                      <Save size={13} /> {isSubmitting ? "Enregistrement" : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
          {activeTab === "encaissement" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Encaissement - Saisie des montants</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabEncaissement rows={encRows} setRows={setEncRows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "tva_immo" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Etat TVA / Immobilisations - Liste des factures</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabTVAEtat rows={tvaImmoRows} setRows={setTvaImmoRows} onSave={handleSave} isSubmitting={isSubmitting} fournisseurs={fiscalFournisseurs} withSelectableRate />
                </CardContent>
              </Card>
            )}
            {activeTab === "tva_biens" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Etat TVA / Biens &amp; Services - Liste des factures</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabTVAEtat rows={tvaBiensRows} setRows={setTvaBiensRows} onSave={handleSave} isSubmitting={isSubmitting} fournisseurs={fiscalFournisseurs} withSelectableRate />
                </CardContent>
              </Card>
            )}
            {activeTab === "droits_timbre" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Etat Droits de Timbre - Saisie des montants</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabDroitsTimbre rows={timbreRows} setRows={setTimbreRows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "ca_tap" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>CA soumis a 7% &amp; CA Global soumis a 1% - Calcul automatique</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabCA b12={b12} setB12={setB12} b13={b13} setB13={setB13} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "etat_tap" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>Etat TAP - Saisie par Wilaya / Commune</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabTAP rows={tapRows} setRows={setTapRows}
                    mois={mois} setMois={setMois} annee={annee} setAnnee={setAnnee}
                    onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "ca_siege" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N7 - Chiffre d'affaire encaisse Siege</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabCaSiege rows={siegeEncRows} setRows={setSiegeEncRows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "irg" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N8 - Situation IRG</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabIRG rows={irgRows} setRows={setIrgRows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "taxe2" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N9 - Situation de la Taxe 2%</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabTaxe2 rows={taxe2Rows} setRows={setTaxe2Rows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "taxe_masters" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N10 - Etat de la Taxe 1,5% des Masters</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabMasters rows={masterRows} setRows={setMasterRows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "taxe_vehicule" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N11 - Taxe de Vehicule</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabTaxeVehicule montant={taxe11Montant} setMontant={setTaxe11Montant} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "taxe_formation" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N12 - Taxe de Formation</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabTaxeFormation rows={taxe12Rows} setRows={setTaxe12Rows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "acompte" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N13 - Acompte Provisionnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabAcompte months={acompteMonths} setMonths={setAcompteMonths} annee={annee} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "ibs" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N14 - IBS sur Fournisseurs Etrangers</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabIBS rows={ibs14Rows} setRows={setIbs14Rows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "taxe_domicil" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N15 - Taxe Domiciliation Bancaire</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabTaxeDomicil rows={taxe15Rows} setRows={setTaxe15Rows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            {activeTab === "tva_autoliq" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: PRIMARY_COLOR }}>N16 - TVA Auto Liquidation</CardTitle>
                </CardHeader>
                <CardContent>
                  <TabTvaAutoLiq rows={tva16Rows} setRows={setTva16Rows} onSave={handleSave} isSubmitting={isSubmitting} />
                </CardContent>
              </Card>
            )}
            </>
          )}
          </div>
      </div>
        </>
      )}
    </LayoutWrapper>
  )
}







