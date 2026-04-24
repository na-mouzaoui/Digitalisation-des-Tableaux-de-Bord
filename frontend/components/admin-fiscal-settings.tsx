"use client"

import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { authFetch } from "@/lib/auth-fetch"
import { useToast } from "@/hooks/use-toast"

type tableauSettingsResponse = {
  disabledTabKeys?: string[]
  tabs?: Array<{ key?: string; label?: string; isEnabled?: boolean }>
}

export default function AdmintableauSettings() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [savingTabKey, setSavingTabKey] = useState<string | null>(null)
  const [tabs, setTabs] = useState<Array<{ key: string; label: string; isEnabled: boolean }>>([])

  const normalizeKey = (value: string) => value.trim().toLowerCase()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await authFetch("/api/admin/tableau-settings", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Impossible de charger les parametres tableauux")
        }

        const payload = (await response.json().catch(() => null)) as tableauSettingsResponse | null
        if (!cancelled) {
          const disabledSet = new Set((payload?.disabledTabKeys ?? []).map((value) => normalizeKey(String(value ?? ""))))
          const fetchedTabs = Array.isArray(payload?.tabs)
            ? payload.tabs
                .map((tab) => {
                  const key = normalizeKey(String(tab?.key ?? ""))
                  if (!key) return null
                  const label = String(tab?.label ?? key).trim() || key
                  const isEnabledFromApi = typeof tab?.isEnabled === "boolean" ? tab.isEnabled : !disabledSet.has(key)
                  return { key, label, isEnabled: isEnabledFromApi }
                })
                .filter((tab): tab is { key: string; label: string; isEnabled: boolean } => tab !== null)
            : []

          setTabs(fetchedTabs)
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

  const updateSetting = async (tabKey: string, nextValue: boolean) => {
    const normalizedTabKey = normalizeKey(tabKey)
    const previousTabs = tabs
    setTabs((prev) =>
      prev.map((tab) =>
        tab.key === normalizedTabKey ? { ...tab, isEnabled: nextValue } : tab,
      ),
    )
    setSavingTabKey(normalizedTabKey)

    try {
      const response = await authFetch("/api/admin/tableau-settings/tabs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabKey: normalizedTabKey, isEnabled: nextValue }),
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
          ? "Le tableau est active pour les utilisateurs."
          : "Le tableau est desactive pour les utilisateurs.",
      })
    } catch (error) {
      setTabs(previousTabs)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Mise a jour impossible.",
        variant: "destructive",
      })
    } finally {
      setSavingTabKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground">
        Activez ou desactivez chaque tableau individuellement. Les tableaux desactives apparaitront en grise dans la saisie et seront bloques a l'enregistrement.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tabs.map((tab) => {
          const checkboxId = `table-toggle-${tab.key}`
          const isSaving = savingTabKey === tab.key
          return (
            <div key={tab.key} className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
              <Checkbox
                id={checkboxId}
                checked={tab.isEnabled}
                disabled={isLoading || isSaving || !!savingTabKey}
                onCheckedChange={(checked) => updateSetting(tab.key, Boolean(checked))}
              />
              <div className="space-y-1">
                <Label htmlFor={checkboxId} className="text-sm font-medium">
                  {tab.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {tab.isEnabled ? "Actif" : "Desactive"}
                  {isSaving ? " . Enregistrement..." : ""}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Chargement...</p>
      )}

      {!isLoading && tabs.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun tableau configurable pour le moment.</p>
      )}

      {!!savingTabKey && (
        <p className="text-xs text-muted-foreground">Enregistrement...</p>
      )}
    </div>
  )
}
