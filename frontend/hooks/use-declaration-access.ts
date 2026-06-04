"use client"

import { useEffect, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"

export function useDeclarationAccess(domain: string, allowedKpis: number[] | undefined) {
  const [allowedTabKeys, setAllowedTabKeys] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!allowedKpis || allowedKpis.length === 0) {
      setAllowedTabKeys(null)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const response = await authFetch(`/api/kpis/domain/${domain}`, { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as { kpis: { id: number; name: string }[] }[]
        if (cancelled) return

        const keys = new Set<string>()
        for (const sd of data) {
          for (const kpi of sd.kpis) {
            if (allowedKpis.includes(kpi.id)) {
              keys.add(kpi.name)
            }
          }
        }
        setAllowedTabKeys(keys)
      } catch {
        // ignore
      }
    }

    load()
    return () => { cancelled = true }
  }, [domain, allowedKpis?.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps

  return allowedTabKeys
}
