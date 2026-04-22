import { authFetch } from "./auth-fetch"

export type TableuPolicy = {
  role: string
  requestedDirection: string
  deadlineDay: number
  regionalTabKeys: string[]
  financeTabKeys: string[]
  manageableTabKeys: string[]
  disabledTabKeys: string[]
  serverNow: string
}

let cachedTableuPolicy: TableuPolicy | null = null

const normalizeRole = (role?: string | null) => (role ?? "").trim().toLowerCase()

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? "").trim()).filter(Boolean)
}

export const getCachedTableuPolicy = (): TableuPolicy | null => cachedTableuPolicy

export const syncTableuPolicy = async (direction?: string | null): Promise<TableuPolicy | null> => {
  const search = new URLSearchParams()
  const normalizedDirection = (direction ?? "").trim()
  if (normalizedDirection) {
    search.set("direction", normalizedDirection)
  }

  try {
    const response = await authFetch(`/api/tableu/policy${search.size > 0 ? `?${search.toString()}` : ""}`)
    if (!response.ok) return cachedTableuPolicy

    const payload = await response.json().catch(() => null)
    if (!payload || typeof payload !== "object") return cachedTableuPolicy

    const policy: TableuPolicy = {
      role: String((payload as { role?: unknown }).role ?? "").trim(),
      requestedDirection: String((payload as { requestedDirection?: unknown }).requestedDirection ?? "").trim(),
      deadlineDay: Number((payload as { deadlineDay?: unknown }).deadlineDay ?? 10) || 10,
      regionalTabKeys: toStringArray((payload as { regionalTabKeys?: unknown }).regionalTabKeys),
      financeTabKeys: toStringArray((payload as { financeTabKeys?: unknown }).financeTabKeys),
      manageableTabKeys: toStringArray((payload as { manageableTabKeys?: unknown }).manageableTabKeys),
      disabledTabKeys: toStringArray((payload as { disabledTabKeys?: unknown }).disabledTabKeys),
      serverNow: String((payload as { serverNow?: unknown }).serverNow ?? ""),
    }

    if (!policy.role) return cachedTableuPolicy

    cachedTableuPolicy = policy
    return cachedTableuPolicy
  } catch {
    return cachedTableuPolicy
  }
}

export const getPolicyDeadlineDay = (role?: string | null): number | null => {
  if (!cachedTableuPolicy) return null
  if (normalizeRole(cachedTableuPolicy.role) !== normalizeRole(role)) return null
  return cachedTableuPolicy.deadlineDay
}
