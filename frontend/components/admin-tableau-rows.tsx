"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { authFetch } from "@/lib/auth-fetch"
import { Plus, Trash2, Save } from "lucide-react"

type SousDomaine = {
  id: number
  designation: string
}

type Domaine = {
  id: number
  designation: string
  sousDomaines: SousDomaine[]
}

type HierarchieKpi = {
  id: number
  name: string
  rows: { id: number; designation: string; order: number }[]
}

type HierarchieSousDomaine = {
  id: number
  designation: string
  kpis: HierarchieKpi[]
}

type HierarchieDomaine = {
  id: number
  designation: string
  sousDomaines: HierarchieSousDomaine[]
}

export default function AdminTableauRows() {
  const { toast } = useToast()
  const [domaines, setDomaines] = useState<Domaine[]>([])
  const [hierarchy, setHierarchy] = useState<HierarchieDomaine[]>([])
  const [domaineId, setDomaineId] = useState<string>("")
  const [sousDomaineId, setSousDomaineId] = useState<string>("")
  const [kpiName, setKpiName] = useState<string>("")
  const [rows, setRows] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [disabledTabKeys, setDisabledTabKeys] = useState<Set<string>>(new Set())
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const currentDomaine = domaines.find((d) => String(d.id) === domaineId)
  const sousDomaines = currentDomaine?.sousDomaines ?? []
  const currentHierarchyDomaine = hierarchy.find((d) => String(d.id) === domaineId)
  const currentHierarchySousDomaine = currentHierarchyDomaine?.sousDomaines.find((sd) => String(sd.id) === sousDomaineId)
  const kpis = currentHierarchySousDomaine?.kpis ?? []

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [domRes, hierRes, settingsRes] = await Promise.all([
          authFetch("/api/admin/domaines", { cache: "no-store" }),
          authFetch("/api/admin/hierarchy", { cache: "no-store" }),
          authFetch("/api/admin/tableau-settings", { cache: "no-store" }),
        ])

        if (!cancelled) {
          if (domRes.ok) {
            setDomaines(await domRes.json())
          }
          if (hierRes.ok) {
            setHierarchy(await hierRes.json())
          }
          if (settingsRes.ok) {
            const payload = (await settingsRes.json().catch(() => null)) as { disabledTabKeys?: string[] } | null
            if (payload?.disabledTabKeys) {
              setDisabledTabKeys(new Set(payload.disabledTabKeys.map((k) => k.trim().toLowerCase())))
            }
          }
        }
      } catch {
        // ignore
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setSousDomaineId("")
    setKpiName("")
    setRows([])
  }, [domaineId])

  useEffect(() => {
    setKpiName("")
    setRows([])
  }, [sousDomaineId])

  useEffect(() => {
    const kpi = kpis.find((k) => k.name === kpiName)
    setRows(kpi ? kpi.rows.map((r) => r.designation) : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiName])

  const refreshHierarchy = async () => {
    try {
      const response = await authFetch("/api/admin/hierarchy", { cache: "no-store" })
      if (response.ok) {
        setHierarchy(await response.json())
      }
    } catch {
      // ignore
    }
  }

  const updateRow = (index: number, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? value : row)))
  }

  const addRow = () => {
    setRows((prev) => [...prev, ""])
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDragStart = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    setDragIndex(index)
    event.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setRows((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
  }

  const handleSave = async () => {
    if (!kpiName || !sousDomaineId) return
    setIsSaving(true)

    try {
      const response = await authFetch(
        `/api/admin/kpis/by-name/${encodeURIComponent(kpiName)}?sousDomaineId=${sousDomaineId}&domain=${encodeURIComponent(currentDomaine?.designation ?? "")}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designations: rows }),
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message ?? "")
          : "Mise a jour impossible"
        throw new Error(message || "Mise a jour impossible")
      }

      toast({
        title: "Enregistre",
        description: "Structure du tableau mise a jour.",
      })

      await refreshHierarchy()
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Mise a jour impossible.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleActivation = async (key: string, isEnabled: boolean) => {
    const normalizedKey = key.trim().toLowerCase()
    setTogglingKey(normalizedKey)

    try {
      const response = await authFetch("/api/admin/tableau-settings/tabs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabKey: normalizedKey, isEnabled }),
      })

      if (!response.ok) throw new Error("Mise a jour impossible")

      setDisabledTabKeys((prev) => {
        const next = new Set(prev)
        if (isEnabled) next.delete(normalizedKey)
        else next.add(normalizedKey)
        return next
      })

      toast({
        title: "Statut mis a jour",
        description: isEnabled ? "Tableau active." : "Tableau desactive.",
      })
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Mise a jour impossible.",
        variant: "destructive",
      })
    } finally {
      setTogglingKey(null)
    }
  }

  const kpiLabel = (name: string) => name.replace(/_/g, " ")

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Domaine</Label>
          <Select value={domaineId} onValueChange={setDomaineId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un domaine" />
            </SelectTrigger>
            <SelectContent>
              {domaines.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.designation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Sous-domaine</Label>
          <Select value={sousDomaineId} onValueChange={setSousDomaineId} disabled={!domaineId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un sous-domaine" />
            </SelectTrigger>
            <SelectContent>
              {sousDomaines.map((sd) => (
                <SelectItem key={sd.id} value={String(sd.id)}>
                  {sd.designation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tableau (KPI)</Label>
          <Select value={kpiName} onValueChange={setKpiName} disabled={!sousDomaineId || kpis.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un tableau" />
            </SelectTrigger>
            <SelectContent>
              {kpis.map((kpi) => (
                <SelectItem key={kpi.id} value={kpi.name}>
                  {kpiLabel(kpi.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex flex-col justify-end">
          <Label>Statut</Label>
          <div className="flex h-10 items-center gap-3 rounded-md border border-slate-200 bg-white px-3">
            <Checkbox
              id="tableau-status"
              checked={kpiName ? !disabledTabKeys.has(kpiName.trim().toLowerCase()) : false}
              disabled={!kpiName || togglingKey !== null}
              onCheckedChange={(checked) => {
                if (kpiName) toggleActivation(kpiName, Boolean(checked))
              }}
            />
            <Label htmlFor="tableau-status" className="text-sm cursor-pointer">
              {kpiName && disabledTabKeys.has(kpiName.trim().toLowerCase()) ? "Desactive" : "Actif"}
              {togglingKey === kpiName?.trim().toLowerCase() ? " ..." : ""}
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={`${index}-${kpiName}`}
            className={`flex items-center gap-2 rounded-md border border-transparent px-1 py-1 ${dragIndex === index ? "bg-slate-100" : ""}`}
            draggable
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-9 w-8 items-center justify-center text-slate-500 cursor-move select-none">≡</div>
            <Input
              value={row}
              onChange={(event) => updateRow(index, event.target.value)}
              placeholder={`Ligne ${index + 1}`}
              className="h-9"
              disabled={isSaving}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              disabled={isSaving}
              className="text-red-600"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune ligne definie pour ce tableau.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={addRow} disabled={isSaving} className="gap-2">
          <Plus size={14} /> Ajouter une ligne
        </Button>

        <Button type="button" onClick={handleSave} disabled={isSaving || !kpiName} className="gap-2">
          <Save size={14} /> {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}
