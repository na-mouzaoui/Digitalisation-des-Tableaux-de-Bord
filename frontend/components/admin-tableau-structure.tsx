"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { authFetch } from "@/lib/auth-fetch"
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronRight } from "lucide-react"

const SYSTEM_KPI_NAMES = new Set([
  "reclamation", "e_payement",
  "total_encaissement", "rechargement", "recouvrement",
  "parc_abonnes_gp", "total_parc_abonnes_technologie",
  "activation", "chiffre_affaires_mda", "desactivation", "resiliation",
  "suivi_infrastructures_reseau", "evolution_trafic_data", "amelioration_qualite",
  "couverture_reseau", "action_notable_reseau", "situation_reseaux", "situation_reseau",
  "realisation_technique_reseau", "trafic_data",
  "disponibilite_reseau", "mttr",
  "creance_contentieuses", "creances_contentieuses", "creances_contentieuses_anterieur", "rh", "formation",
  "frais_personnel", "effectif_gsp", "absenteisme", "mouvement_effectifs",
  "mouvement_effectifs_domaine", "effectifs_formes_gsp", "formations_domaines",
  "budget_formation",
  "compte_resultat", "investissement", "avancement_engagement",
  "genie_civil", "maintenance_equipement", "nouveaux_sites", "mttr_debit",
  "recouvrement_contentieux", "ressources_humaines", "acquisition_terrain",
  "realisations_commerciales", "reseau_distribution",
])

type Domaine = {
  id: number
  designation: string
  sousDomaines: { id: number; designation: string }[]
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

export default function AdminTableauStructure() {
  const { toast } = useToast()
  const [domaines, setDomaines] = useState<Domaine[]>([])
  const [hierarchy, setHierarchy] = useState<HierarchieDomaine[]>([])
  const [domaineId, setDomaineId] = useState<string>("")
  const [sousDomaineId, setSousDomaineId] = useState<string>("")
  const [tableauName, setTableauName] = useState("")
  const [rows, setRows] = useState<string[]>([""])
  const [isSaving, setIsSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [newSousDomaineName, setNewSousDomaineName] = useState("")
  const [isCreatingSousDomaine, setIsCreatingSousDomaine] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingKpiId, setDeletingKpiId] = useState<number | null>(null)
  const [openDomaines, setOpenDomaines] = useState<Set<string>>(new Set())

  const sousDomaines = domaines.find((d) => String(d.id) === domaineId)?.sousDomaines ?? []

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [domRes, hierRes] = await Promise.all([
          authFetch("/api/admin/domaines", { cache: "no-store" }),
          authFetch("/api/admin/hierarchy", { cache: "no-store" }),
        ])

        if (!cancelled) {
          if (domRes.ok) {
            const data = (await domRes.json()) as Domaine[]
            setDomaines(data)
          }
          if (hierRes.ok) {
            const data = (await hierRes.json()) as HierarchieDomaine[]
            setHierarchy(data)
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
  }, [domaineId])

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

  const createSousDomaine = async () => {
    const name = newSousDomaineName.trim()
    if (!name || !domaineId) return

    setIsCreatingSousDomaine(true)
    try {
      const response = await authFetch("/api/admin/sous-domaines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domaineId: Number(domaineId), designation: name }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(
          payload && typeof payload === "object" && "message" in payload
            ? String((payload as { message?: unknown }).message ?? "")
            : "Création impossible"
        )
      }

      const created = (await response.json()) as { id: number; designation: string; domaineId: number }

      setDomaines((prev) =>
        prev.map((d) =>
          d.id === created.domaineId
            ? { ...d, sousDomaines: [...d.sousDomaines, { id: created.id, designation: created.designation }] }
            : d
        )
      )

      setSousDomaineId(String(created.id))
      setNewSousDomaineName("")
      setDialogOpen(false)

      toast({
        title: "Créé",
        description: `Sous-domaine "${created.designation}" créé.`,
      })
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Création impossible.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingSousDomaine(false)
    }
  }

  const handleSave = async () => {
    const name = tableauName.trim().toLowerCase().replace(/\s+/g, "_")
    if (!name || !sousDomaineId) return

    const domaineDesignation = domaines.find((d) => String(d.id) === domaineId)?.designation ?? ""

    setIsSaving(true)
    try {
      const response = await authFetch(
        `/api/admin/kpis/by-name/${encodeURIComponent(name)}?domain=${encodeURIComponent(domaineDesignation)}&sousDomaineId=${sousDomaineId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designations: rows.filter((r) => r.trim()) }),
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message =
          payload && typeof payload === "object" && "message" in payload
            ? String((payload as { message?: unknown }).message ?? "")
            : "Mise à jour impossible"
        throw new Error(message || "Mise à jour impossible")
      }

      toast({
        title: "Enregistré",
        description: `Tableau "${tableauName}" créé/mis à jour.`,
      })

      setTableauName("")
      setRows([""])
      await refreshHierarchy()
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Mise à jour impossible.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const deleteKpi = async (kpi: HierarchieKpi) => {
    setDeletingKpiId(kpi.id)
    try {
      const response = await authFetch(`/api/admin/kpis/${kpi.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Suppression impossible")

      toast({
        title: "Supprimé",
        description: `Tableau "${kpi.name}" supprimé.`,
      })

      await refreshHierarchy()
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Suppression impossible.",
        variant: "destructive",
      })
    } finally {
      setDeletingKpiId(null)
    }
  }

  const toggleDomaine = (id: string) => {
    setOpenDomaines((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canSave = tableauName.trim() && sousDomaineId && rows.some((r) => r.trim())

  const userKpis = (kpis: HierarchieKpi[]) => kpis.filter((k) => !SYSTEM_KPI_NAMES.has(k.name))

  const hasTableaux = hierarchy.some((d) =>
    d.sousDomaines.some((sd) => userKpis(sd.kpis).length > 0)
  )

  return (
    <div className="space-y-6">
      {/* LISTE DES TABLEAUX EXISTANTS */}
      {hasTableaux && (
        <div className="space-y-2">
          <Label className="text-base font-semibold">Tableaux existants</Label>
          <div className="space-y-1">
            {hierarchy.map((domaine) => {
              const kpiCount = domaine.sousDomaines.reduce((sum, sd) => sum + userKpis(sd.kpis).length, 0)
              if (kpiCount === 0) return null

              const isOpen = openDomaines.has(String(domaine.id))

              return (
                <Collapsible key={domaine.id} open={isOpen} onOpenChange={() => toggleDomaine(String(domaine.id))}>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {domaine.designation}
                    <span className="ml-auto text-xs text-muted-foreground">{kpiCount + " tableau" + (kpiCount > 1 ? "x" : "")}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 pt-1 space-y-1">
                    {domaine.sousDomaines.map((sd) => {
                      const kpis = userKpis(sd.kpis)
                      if (kpis.length === 0) return null
                      return (
                        <div key={sd.id} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground px-2 py-1">{sd.designation}</p>
                          {kpis.map((kpi) => (
                            <div
                              key={kpi.id}
                              className="flex items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 ml-2"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-sm font-medium truncate">{kpi.name.replace(/_/g, " ")}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  ({kpi.rows.length} ligne{kpi.rows.length > 1 ? "s" : ""})
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteKpi(kpi)}
                                disabled={deletingKpiId === kpi.id}
                                className="text-red-600 h-8 w-8 shrink-0"
                              >
                                {deletingKpiId === kpi.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </div>
      )}

      {!hasTableaux && (
        <p className="text-xs text-muted-foreground">Aucun tableau existant.</p>
      )}

      {/* FORMULAIRE DE CREATION */}
      <div className="border-t pt-6 space-y-4">
        <Label className="text-base font-semibold">Nouveau tableau</Label>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Domaine</Label>
            <Select value={domaineId} onValueChange={setDomaineId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un domaine" />
              </SelectTrigger>
              <SelectContent>
                {domaines.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sous-domaine / Onglet</Label>
            <div className="flex gap-2">
              <Select value={sousDomaineId} onValueChange={setSousDomaineId} disabled={!domaineId}>
                <SelectTrigger className="flex-1">
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

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" disabled={!domaineId}>
                    <Plus size={16} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouveau sous-domaine / onglet</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label>Désignation</Label>
                      <Input
                        value={newSousDomaineName}
                        onChange={(e) => setNewSousDomaineName(e.target.value)}
                        placeholder="Nom du sous-domaine"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={createSousDomaine}
                      disabled={!newSousDomaineName.trim() || isCreatingSousDomaine}
                      className="w-full"
                    >
                      {isCreatingSousDomaine ? "Création..." : "Créer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nom du tableau</Label>
          <Input
            value={tableauName}
            onChange={(e) => setTableauName(e.target.value)}
            placeholder="ex: total_encaissement"
            className="max-w-md"
          />
          {tableauName.trim() && (
            <p className="text-xs text-muted-foreground">
              Identifiant interne&nbsp;: <code>{tableauName.trim().toLowerCase().replace(/\s+/g, "_")}</code>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Lignes du tableau</Label>

          {rows.map((row, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 rounded-md border border-transparent px-1 py-1 ${
                dragIndex === index ? "bg-slate-100" : ""
              }`}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex h-9 w-8 items-center justify-center text-slate-500 cursor-move select-none">
                ≡
              </div>
              <Input
                value={row}
                onChange={(e) => updateRow(index, e.target.value)}
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
            <p className="text-xs text-muted-foreground">Aucune ligne définie.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            disabled={isSaving}
            className="gap-2"
          >
            <Plus size={14} /> Ajouter une ligne
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="gap-2"
          >
            <Save size={14} /> {isSaving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  )
}
