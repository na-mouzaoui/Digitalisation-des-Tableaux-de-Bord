import { authFetch } from "./auth-fetch"

export type FiscalPolicy = {
  role: string
  requestedDirection: string
  deadlineDay: number
  regionalTabKeys: string[]
  financeTabKeys: string[]
  manageableTabKeys: string[]
  disabledTabKeys: string[]
  serverNow: string
}

let cachedFiscalPolicy: FiscalPolicy | null = null

const normalizeRole = (role?: string | null) => (role ?? "").trim().toLowerCase()

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? "").trim()).filter(Boolean)
}

export const getCachedFiscalPolicy = (): FiscalPolicy | null => cachedFiscalPolicy

export const clearCachedFiscalPolicy = (): void => {
  cachedFiscalPolicy = null
}

export const syncFiscalPolicy = async (direction?: string | null): Promise<FiscalPolicy | null> => {
  const search = new URLSearchParams()
  const requestedDirection = (direction ?? "").trim()
  if (requestedDirection) {
    search.set("direction", requestedDirection)
  }

  try {
    const response = await authFetch(`/api/fiscal/policy${search.size > 0 ? `?${search.toString()}` : ""}`)
    if (!response.ok) return cachedFiscalPolicy

    const payload = await response.json().catch(() => null)
    if (!payload || typeof payload !== "object") return cachedFiscalPolicy

    const policy: FiscalPolicy = {
      role: String((payload as { role?: unknown }).role ?? "").trim(),
      requestedDirection: String((payload as { requestedDirection?: unknown }).requestedDirection ?? "").trim(),
      deadlineDay: Number((payload as { deadlineDay?: unknown }).deadlineDay ?? 10) || 10,
      regionalTabKeys: toStringArray((payload as { regionalTabKeys?: unknown }).regionalTabKeys),
      financeTabKeys: toStringArray((payload as { financeTabKeys?: unknown }).financeTabKeys),
      manageableTabKeys: toStringArray((payload as { manageableTabKeys?: unknown }).manageableTabKeys),
      disabledTabKeys: toStringArray((payload as { disabledTabKeys?: unknown }).disabledTabKeys),
      serverNow: String((payload as { serverNow?: unknown }).serverNow ?? ""),
    }

    if (!policy.role) return cachedFiscalPolicy

    cachedFiscalPolicy = policy
    return cachedFiscalPolicy
  } catch {
    return cachedFiscalPolicy
  }
}

export const getPolicyDeadlineDay = (role?: string | null): number | null => {
  if (!cachedFiscalPolicy) return null
  if (normalizeRole(cachedFiscalPolicy.role) !== normalizeRole(role)) return null
  return cachedFiscalPolicy.deadlineDay
}
