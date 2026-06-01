"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { authFetch } from "@/lib/auth-fetch"
import { Plus, Trash2, Save } from "lucide-react"

const CATEGORY_OPTIONS = [
  {
    key: "commerciale",
    label: "Commerciale",
    domain: "Commerciale",
    tabs: [
      { key: "reclamation", label: "Reclamation" },
      { key: "e_payement", label: "E-PAYEMENT" },
      { key: "total_encaissement", label: "Totale des encaissements" },
      { key: "rechargement", label: "Rechargement" },
      { key: "recouvrement", label: "Recouvrement" },
        { key: "parc_abonnes_gp", label: "Parc Abonnes GP" },
      { key: "total_parc_abonnes_technologie", label: "Total Parc Abonnes par technologie" },
      { key: "activation", label: "Activation" },
      { key: "chiffre_affaires_mda", label: "Chiffre d'Affaires (MDA)" },
    ],
  },
  {
    key: "dvdrs",
    label: "DVDRS",
    domain: "DVDRS",
    tabs: [
      { key: "suivi_infrastructures_reseau", label: "Suivi des infrastructures reseau 2G/3G/4G" },
      { key: "evolution_trafic_data", label: "Evolution du Trafic Data" },
      { key: "amelioration_qualite", label: "Amelioration qualite" },
      { key: "couverture_reseau", label: "Couverture Reseau" },
      { key: "action_notable_reseau", label: "Action notable sur le Reseau" },
      { key: "situation_reseaux", label: "Situation Reseaux" },
    ],
  },
  {
    key: "dqrpc",
    label: "DQRPC",
    domain: "DQRPC",
    tabs: [
      { key: "realisation_technique_reseau", label: "Realisation technique Reseau" },
      { key: "amelioration_qualite", label: "Amelioration qualite" },
      { key: "mttr", label: "MTTR" },
    ],
  },
  {
    key: "support",
    label: "Support",
    domain: "Support",
    tabs: [
      { key: "creance_contentieuses", label: "Creance contentieuses" },
      { key: "creances_contentieuses_anterieur", label: "Creance contentieuses anterieur" },
      { key: "rh", label: "RH" },
      { key: "formation", label: "Formation" },
      { key: "frais_personnel", label: "Frais personnel" },
      { key: "effectif_gsp", label: "Effectif GSP" },
      { key: "absenteisme", label: "Absenteisme" },
      { key: "mouvement_effectifs", label: "Mouvement effectifs" },
      { key: "mouvement_effectifs_domaine", label: "Mouvement effectifs domaine" },
      { key: "effectifs_formes_gsp", label: "Effectifs formes GSP" },
      { key: "formations_domaines", label: "Formations domaines" },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    domain: "Finances",
    tabs: [
      { key: "compte_resultat", label: "Compte de resultat" },
    ],
  },
  {
    key: "regionale",
    label: "Regionale",
    domain: "Regionale",
    tabs: [
      { key: "realisation_technique_reseau", label: "Realisation technique Reseau" },
      { key: "amelioration_qualite", label: "Amelioration qualite" },
      { key: "mttr", label: "MTTR" },
    ],
  },
] as const

type CategoryKey = (typeof CATEGORY_OPTIONS)[number]["key"]
type DomainKey = (typeof CATEGORY_OPTIONS)[number]["domain"]

export default function AdminTableauRows() {
  const { toast } = useToast()
  const [category, setCategory] = useState<CategoryKey>("commerciale")
  const [tabKey, setTabKey] = useState<string>(CATEGORY_OPTIONS[0].tabs[0]?.key ?? "")
  const [rows, setRows] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [disabledTabKeys, setDisabledTabKeys] = useState<Set<string>>(new Set())
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const tabs = useMemo(() => {
    return CATEGORY_OPTIONS.find((item) => item.key === category)?.tabs ?? []
  }, [category])

  const domain = useMemo(() => CATEGORY_OPTIONS.find((item) => item.key === category)?.domain ?? "", [category])

  useEffect(() => {
    if (!tabs.length) {
      setTabKey("")
      setRows([])
      return
    }

    setTabKey(tabs[0].key)
  }, [tabs])

  useEffect(() => {
    let cancelled = false

    const loadDisabled = async () => {
      try {
        const response = await authFetch("/api/admin/tableau-settings", { cache: "no-store" })
        if (!response.ok) return
        const payload = (await response.json().catch(() => null)) as { disabledTabKeys?: string[] } | null
        if (!cancelled && payload?.disabledTabKeys) {
          setDisabledTabKeys(new Set(payload.disabledTabKeys.map((k) => k.trim().toLowerCase())))
        }
      } catch {
        // ignore
      }
    }

    loadDisabled()
    return () => { cancelled = true }
  }, [toast])

  useEffect(() => {
    if (!tabKey) {
      setRows([])
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const response = await authFetch(`/api/admin/kpis/by-name/${encodeURIComponent(tabKey)}${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Chargement impossible")
        }

        const payload = (await response.json().catch(() => null)) as { rows?: string[] } | null
        if (!cancelled) {
          setRows(Array.isArray(payload?.rows) ? payload!.rows : [])
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Erreur",
            description: error instanceof Error ? error.message : "Chargement impossible.",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [domain, tabKey, toast])

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
    if (!tabKey) return
    setIsSaving(true)

    try {
      const response = await authFetch(`/api/admin/kpis/by-name/${encodeURIComponent(tabKey)}${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designations: rows }),
      })

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Categorie</Label>
          <Select value={category} onValueChange={(value) => setCategory(value as CategoryKey)}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une categorie" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tableau</Label>
          <Select value={tabKey} onValueChange={setTabKey}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un tableau" />
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab) => (
                <SelectItem key={tab.key} value={tab.key}>
                  {tab.label}
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
              checked={tabKey ? !disabledTabKeys.has(tabKey.trim().toLowerCase()) : false}
              disabled={!tabKey || togglingKey !== null}
              onCheckedChange={(checked) => {
                if (tabKey) toggleActivation(tabKey, Boolean(checked))
              }}
            />
            <Label htmlFor="tableau-status" className="text-sm cursor-pointer">
              {tabKey && disabledTabKeys.has(tabKey.trim().toLowerCase()) ? "Desactive" : "Actif"}
              {togglingKey === tabKey?.trim().toLowerCase() ? " ..." : ""}
            </Label>
          </div>
        </div>
      </div>


      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={`${index}-${tabKey}`}
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
              disabled={isLoading || isSaving}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              disabled={isLoading || isSaving}
              className="text-red-600"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}

        {rows.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground">Aucune ligne definie pour ce tableau.</p>
        )}

        {isLoading && (
          <p className="text-xs text-muted-foreground">Chargement...</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={addRow} disabled={isLoading || isSaving} className="gap-2">
          <Plus size={14} /> Ajouter une ligne
        </Button>

        <Button type="button" onClick={handleSave} disabled={isLoading || isSaving || !tabKey} className="gap-2">
          <Save size={14} /> {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  )
}
