import { authFetch } from "./auth-fetch"

export type tableauPolicy = {
  role: string
  requestedDirection: string
  deadlineDay: number
  regionalTabKeys: string[]
  financeTabKeys: string[]
  manageableTabKeys: string[]
  disabledTabKeys: string[]
  serverNow: string
}

let cachedtableauPolicy: tableauPolicy | null = null

const normalizeRole = (role?: string | null) => (role ?? "").trim().toLowerCase()

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? "").trim()).filter(Boolean)
}

export const getCachedtableauPolicy = (): tableauPolicy | null => cachedtableauPolicy

export const synctableauPolicy = async (direction?: string | null): Promise<tableauPolicy | null> => {
  const search = new URLSearchParams()
  const normalizedDirection = (direction ?? "").trim()
  if (normalizedDirection) {
    search.set("direction", normalizedDirection)
  }

  try {
    const response = await authFetch(`/api/tableau/policy${search.size > 0 ? `?${search.toString()}` : ""}`)
    if (!response.ok) return cachedtableauPolicy

    const payload = await response.json().catch(() => null)
    if (!payload || typeof payload !== "object") return cachedtableauPolicy

    const policy: tableauPolicy = {
      role: String((payload as { role?: unknown }).role ?? "").trim(),
      requestedDirection: String((payload as { requestedDirection?: unknown }).requestedDirection ?? "").trim(),
      deadlineDay: Number((payload as { deadlineDay?: unknown }).deadlineDay ?? 10) || 10,
      regionalTabKeys: toStringArray((payload as { regionalTabKeys?: unknown }).regionalTabKeys),
      financeTabKeys: toStringArray((payload as { financeTabKeys?: unknown }).financeTabKeys),
      manageableTabKeys: toStringArray((payload as { manageableTabKeys?: unknown }).manageableTabKeys),
      disabledTabKeys: toStringArray((payload as { disabledTabKeys?: unknown }).disabledTabKeys),
      serverNow: String((payload as { serverNow?: unknown }).serverNow ?? ""),
    }

    if (!policy.role) return cachedtableauPolicy

    cachedtableauPolicy = policy
    return cachedtableauPolicy
  } catch {
    return cachedtableauPolicy
  }
}

export const getPolicyDeadlineDay = (role?: string | null): number | null => {
  if (!cachedtableauPolicy) return null
  if (normalizeRole(cachedtableauPolicy.role) !== normalizeRole(role)) return null
  return cachedtableauPolicy.deadlineDay
}
