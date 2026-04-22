import { getCachedTableuPolicy } from "./tableu-policy"

export const REGIONAL_TABLEU_TAB_KEYS = [
  "encaissement",
  "tva_immo",
  "tva_biens",
  "droits_timbre",
  "ca_tap",
  "etat_tap",
] as const

export const FINANCE_TABLEU_TAB_KEYS = [
  "ca_siege",
  "irg",
  "taxe2",
  "taxe_masters",
  "taxe_vehicule",
  "taxe_formation",
  "acompte",
  "ibs",
  "taxe_domicil",
  "tva_autoliq",
] as const

const normalizeRole = (role?: string | null) => (role ?? "").trim().toLowerCase()
const normalizeDirection = (direction?: string | null) => (direction ?? "").trim().toLowerCase()
const normalizeTabKey = (tabKey?: string | null) => (tabKey ?? "").trim().toLowerCase()

export const isAdminTableuRole = (role?: string | null) => normalizeRole(role) === "admin"
export const isRegionalTableuRole = (role?: string | null) => normalizeRole(role) === "regionale"
export const isFinanceTableuRole = (role?: string | null) => {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === "comptabilite" || normalizedRole === "finance"
}

export const isHeadOfficeDirection = (direction?: string | null) => {
  const normalizedDirection = normalizeDirection(direction)
  return normalizedDirection === "siege" || normalizedDirection === "siÃ¨ge"
}

const getPolicyForRole = (role?: string | null) => {
  const policy = getCachedTableuPolicy()
  if (!policy) return null
  if (normalizeRole(policy.role) !== normalizeRole(role)) return null
  return policy
}

export const getManageableTableuTabKeys = (role?: string | null): string[] => {
  const policy = getPolicyForRole(role)
  if (policy) {
    return [...policy.manageableTabKeys]
  }

  if (isAdminTableuRole(role)) {
    return [...REGIONAL_TABLEU_TAB_KEYS, ...FINANCE_TABLEU_TAB_KEYS]
  }

  if (isRegionalTableuRole(role)) {
    return [...REGIONAL_TABLEU_TAB_KEYS]
  }

  if (isFinanceTableuRole(role)) {
    return [...FINANCE_TABLEU_TAB_KEYS]
  }

  return []
}

export const getManageableTableuTabKeysForDirection = (role?: string | null, direction?: string | null): string[] => {
  const roleBasedKeys = getManageableTableuTabKeys(role)
  const policy = getPolicyForRole(role)

  if (!isAdminTableuRole(role)) {
    return roleBasedKeys
  }

  const normalizedDirection = normalizeDirection(direction)
  if (!normalizedDirection) {
    return roleBasedKeys
  }

  const directionScopedKeys: readonly string[] = isHeadOfficeDirection(direction)
    ? policy?.financeTabKeys ?? FINANCE_TABLEU_TAB_KEYS
    : policy?.regionalTabKeys ?? REGIONAL_TABLEU_TAB_KEYS
  return roleBasedKeys.filter((tabKey) => directionScopedKeys.includes(tabKey))
}

export const canManageTableuTab = (role: string | null | undefined, tabKey: string | null | undefined): boolean => {
  const normalizedTabKey = normalizeTabKey(tabKey)
  if (!normalizedTabKey) return false
  return getManageableTableuTabKeys(role).includes(normalizedTabKey)
}

export const isTableuTabDisabledByPolicy = (tabKey: string | null | undefined): boolean => {
  const normalizedTabKey = normalizeTabKey(tabKey)
  if (!normalizedTabKey) return false

  const policy = getCachedTableuPolicy()
  if (!policy) return false

  return policy.disabledTabKeys.map((key) => normalizeTabKey(key)).includes(normalizedTabKey)
}
