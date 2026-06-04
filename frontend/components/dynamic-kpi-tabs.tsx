"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { authFetch } from "@/lib/auth-fetch"
import { Save } from "lucide-react"

type KpiData = {
  id: number
  name: string
  rows: string[]
}

type SousDomaineData = {
  id: number
  designation: string
  kpis: KpiData[]
}

type DynamicRow = {
  designation: string
  m1: string
  m: string
}

type DynamicKpiTabProps = {
  domain: string
  excludeKeys: string[]
  mois: string
  annee: string
  direction: string
  allowedKpis?: number[]
  allowedSousDomaines?: number[]
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

function AmountInput({ value, onChange, ...props }: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
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

export default function DynamicKpiTabs({ domain, excludeKeys, mois, annee, direction, allowedKpis, allowedSousDomaines }: DynamicKpiTabProps) {
  const { toast } = useToast()
  const [sousDomaines, setSousDomaines] = useState<SousDomaineData[]>([])
  const [rowsMap, setRowsMap] = useState<Record<string, DynamicRow[]>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const response = await authFetch(`/api/kpis/domain/${domain}`, { cache: "no-store" })
        if (!response.ok) {
          if (!cancelled) setLoading(false)
          return
        }
        const data = (await response.json()) as SousDomaineData[]
        if (!cancelled) setSousDomaines(data)
        if (!cancelled) setLoading(false)
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [domain])

  const filteredKpis = sousDomaines.flatMap((sd) =>
    sd.kpis
      .filter((k) => !excludeKeys.includes(k.name))
      .map((k) => ({ ...k, sousDomaine: sd.designation }))
  )

  useEffect(() => {
    if (!mois || !annee) return
    let cancelled = false

    const loadData = async () => {
      const map: Record<string, DynamicRow[]> = {}

      for (const kpi of filteredKpis) {
        try {
          const query = `tabKey=${encodeURIComponent(kpi.name)}&mois=${mois}&annee=${annee}&direction=${encodeURIComponent(direction)}`
          const response = await authFetch(`/api/tableau?${query}`, { cache: "no-store" })
          if (!response.ok) continue
          const list = (await response.json()) as { dataJson?: string; id: number }[]
          if (list.length > 0) {
            const parsed = JSON.parse(list[0].dataJson ?? "{}")
            const saved = (parsed.rows ?? []) as DynamicRow[]
            map[kpi.name] = saved
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled) {
        setRowsMap((prev) => {
          const next = { ...prev }
          for (const [key, rows] of Object.entries(map)) {
            next[key] = rows
          }
          return next
        })
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [mois, annee, direction, filteredKpis.length])

  const getRows = useCallback(
    (kpiName: string, kpiRows: string[]): DynamicRow[] => {
      const saved = rowsMap[kpiName]
      if (saved && saved.length === kpiRows.length) return saved
      return kpiRows.map((designation) => ({ designation, m1: "", m: "" }))
    },
    [rowsMap]
  )

  const updateCell = (kpiName: string, rowIndex: number, field: "m1" | "m", value: string) => {
    setRowsMap((prev) => {
      const next = { ...prev }
      const current = next[kpiName] ? [...next[kpiName]] : []
      if (current[rowIndex]) {
        current[rowIndex] = { ...current[rowIndex], [field]: value }
      }
      next[kpiName] = current
      return next
    })
  }

  const handleSave = async (kpi: KpiData) => {
    const currentRows = rowsMap[kpi.name] ?? kpi.rows.map((designation) => ({ designation, m1: "", m: "" }))

    setSavingKey(kpi.name)
    try {
      const payload = JSON.stringify({ rows: currentRows })

      const query = `tabKey=${encodeURIComponent(kpi.name)}&mois=${mois}&annee=${annee}&direction=${encodeURIComponent(direction)}`
      const checkResponse = await authFetch(`/api/tableau?${query}`, { cache: "no-store" })
      let existingId: number | null = null
      if (checkResponse.ok) {
        const list = (await checkResponse.json()) as { id: number }[]
        if (list.length > 0) existingId = list[0].id
      }

      let response: Response
      if (existingId) {
        response = await authFetch(`/api/tableau/${existingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabKey: kpi.name, mois, annee, direction, dataJson: payload }),
        })
      } else {
        response = await authFetch("/api/tableau", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabKey: kpi.name, mois, annee, direction, dataJson: payload }),
        })
      }

      if (!response.ok) throw new Error("Sauvegarde impossible")

      toast({
        title: "Enregistré",
        description: `Tableau "${kpi.name}" mis à jour.`,
      })
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Sauvegarde impossible.",
        variant: "destructive",
      })
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) return null

  const groupedBySousDomaine = sousDomaines
    .map((sd) => ({
      ...sd,
      sdAllowed: !allowedSousDomaines || allowedSousDomaines.length === 0 || allowedSousDomaines.includes(sd.id),
      kpis: sd.kpis
        .filter((k) => !excludeKeys.includes(k.name))
        .map((k) => ({
          ...k,
          sousDomaine: sd.designation,
          kpiAllowed: !allowedKpis || allowedKpis.length === 0 || allowedKpis.includes(k.id),
        })),
    }))
    .filter((sd) => sd.kpis.length > 0)

  if (groupedBySousDomaine.length === 0) return null

  return (
    <div className="space-y-6">
      {groupedBySousDomaine.map((sd) => (
        <div key={sd.id} className={`space-y-3 ${sd.sdAllowed ? "" : "opacity-40 pointer-events-none"}`}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b pb-1">
            {sd.designation}
            {!sd.sdAllowed && <span className="ml-2 text-xs text-muted-foreground">(Accès restreint)</span>}
          </h3>
          {sd.kpis.map((kpi) => {
            const rows = getRows(kpi.name, kpi.rows)
            const isSaving = savingKey === kpi.name
            const kpiAllowed = kpi.kpiAllowed

            return (
              <Card key={kpi.name} className={kpiAllowed ? "" : "opacity-50"}>
                <CardHeader className="pb-3">
                  <CardTitle className={`text-sm font-semibold capitalize ${kpiAllowed ? "" : "text-muted-foreground"}`}
                    style={kpiAllowed ? { color: "#2db34b" } : undefined}>
                    {kpi.name.replace(/_/g, " ")}
                    {!kpiAllowed && <span className="ml-2 text-xs font-normal">(Accès refusé)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">
                              {kpi.name.replace(/_/g, " ")}
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M-1</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">M</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="bg-white">
                              <td className="px-3 py-2 border-b text-xs font-medium text-gray-800">{row.designation}</td>
                              <td className="px-1 py-1 border-b">
                                <AmountInput
                                  value={row.m1}
                                  onChange={(e) => updateCell(kpi.name, rowIndex, "m1", e.target.value)}
                                  className="h-7 px-2 text-xs"
                                  placeholder="0.00"
                                  disabled={isSaving || !kpiAllowed}
                                />
                              </td>
                              <td className="px-1 py-1 border-b">
                                <AmountInput
                                  value={row.m}
                                  onChange={(e) => updateCell(kpi.name, rowIndex, "m", e.target.value)}
                                  className="h-7 px-2 text-xs"
                                  placeholder="0.00"
                                  disabled={isSaving || !kpiAllowed}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSave(kpi)}
                        disabled={isSaving || !kpiAllowed}
                        className="gap-1.5"
                        style={kpiAllowed ? { backgroundColor: "#2db34b", color: "white" } : undefined}
                        variant={kpiAllowed ? "default" : "outline"}
                      >
                        <Save size={13} /> {isSaving ? "Enregistrement..." : "Enregistrer"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ))}
    </div>
  )
}
