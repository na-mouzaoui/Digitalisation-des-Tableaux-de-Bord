import { authFetch } from "./auth-fetch"

export async function fetchKpiRowsMap(tabKeys: string[]): Promise<Record<string, string[]>> {
  const uniqueKeys = Array.from(new Set(tabKeys.map((key) => key.trim()).filter(Boolean)))
  const entries = await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        const response = await authFetch(`/api/kpis/by-name/${encodeURIComponent(key)}`, { cache: "no-store" })
        if (!response.ok) return [key, []] as const
        const payload = (await response.json().catch(() => null)) as { rows?: string[] } | null
        return [key, Array.isArray(payload?.rows) ? payload!.rows : []] as const
      } catch {
        return [key, []] as const
      }
    }),
  )

  return Object.fromEntries(entries)
}
