"use client"

import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { authFetch } from "@/lib/auth-fetch"
import { useToast } from "@/hooks/use-toast"

type TableuSettingsResponse = {
  isTable6Enabled?: boolean
}

export default function AdminTableuSettings() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTable6Enabled, setIsTable6Enabled] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await authFetch("/api/admin/tableu-settings", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Impossible de charger les parametres tableuux")
        }

        const payload = (await response.json().catch(() => null)) as TableuSettingsResponse | null
        if (!cancelled) {
          setIsTable6Enabled(payload?.isTable6Enabled !== false)
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
  }, [toast])

  const updateSetting = async (nextValue: boolean) => {
    const previousValue = isTable6Enabled
    setIsTable6Enabled(nextValue)
    setIsSaving(true)

    try {
      const response = await authFetch("/api/admin/tableu-settings/table6", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: nextValue }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message ?? "")
          : "Mise a jour impossible"
        throw new Error(message || "Mise a jour impossible")
      }

      toast({
        title: "Parametre enregistre",
        description: nextValue
          ? "Le tableau 6 est active pour les utilisateurs."
          : "Le tableau 6 est desactive pour les utilisateurs.",
      })
    } catch (error) {
      setIsTable6Enabled(previousValue)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Mise a jour impossible.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <Checkbox
          id="table6-toggle"
          checked={isTable6Enabled}
          disabled={isLoading || isSaving}
          onCheckedChange={(checked) => updateSetting(Boolean(checked))}
        />
        <div className="space-y-1">
          <Label htmlFor="table6-toggle" className="text-sm font-medium">
            Activer le tableau 6 (ETAT TAP)
          </Label>
          <p className="text-xs text-muted-foreground">
            Si desactive, le tableau 6 apparait en grise dans Nouvelle tableu et il est ignore dans les indicateurs et les rappels.
          </p>
        </div>
      </div>
      {(isLoading || isSaving) && (
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Chargement..." : "Enregistrement..."}
        </p>
      )}
    </div>
  )
}
