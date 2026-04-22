import { getPolicyDeadlineDay } from "./tableu-policy"

const MONTH_LABELS: Record<string, string> = {
  "01": "Janvier",
  "02": "Fevrier",
  "03": "Mars",
  "04": "Avril",
  "05": "Mai",
  "06": "Juin",
  "07": "Juillet",
  "08": "Aout",
  "09": "Septembre",
  "10": "Octobre",
  "11": "Novembre",
  "12": "Decembre",
}

const normalizeMonth = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) return null
  return String(parsed).padStart(2, "0")
}

const normalizeYear = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 9999) return null
  return parsed
}

const getDeadlineDayForRole = (role?: string | null): number => {
  const policyDeadlineDay = getPolicyDeadlineDay(role)
  if (policyDeadlineDay !== null) {
    return policyDeadlineDay
  }
  return 10
}

export const getCurrentTableuPeriod = (now: Date = new Date()) => {
  const referenceDate = now.getDate() >= 11 ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1)

  return {
    mois: String(referenceDate.getMonth() + 1).padStart(2, "0"),
    annee: String(referenceDate.getFullYear()),
  }
}

export const getTableuPeriodDeadline = (mois: string, annee: string, role?: string | null): Date | null => {
  const normalizedMonth = normalizeMonth(mois)
  const normalizedYear = normalizeYear(annee)
  if (!normalizedMonth || !normalizedYear) return null

  const monthNumber = Number.parseInt(normalizedMonth, 10)
  const deadlineMonth = monthNumber === 12 ? 1 : monthNumber + 1
  const deadlineYear = monthNumber === 12 ? normalizedYear + 1 : normalizedYear
  const deadlineDay = getDeadlineDayForRole(role)

  return new Date(deadlineYear, deadlineMonth - 1, deadlineDay, 23, 59, 59, 0)
}

export const isTableuPeriodLocked = (mois: string, annee: string, role?: string | null, now: Date = new Date()): boolean => {
  const deadline = getTableuPeriodDeadline(mois, annee, role)
  if (!deadline) return false
  return now.getTime() > deadline.getTime()
}

export const formatTableuPeriod = (mois: string, annee: string): string => {
  const normalizedMonth = normalizeMonth(mois)
  if (!normalizedMonth) return `${mois}/${annee}`
  return `${MONTH_LABELS[normalizedMonth] ?? normalizedMonth} ${annee}`
}

export const formatTableuPeriodDeadline = (deadline: Date): string => {
  return deadline.toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export const getTableuPeriodLockMessage = (mois: string, annee: string, role?: string | null): string => {
  const deadline = getTableuPeriodDeadline(mois, annee, role)
  if (!deadline) {
    return `La periode ${mois}/${annee} est invalide.`
  }

  return `La periode ${formatTableuPeriod(mois, annee)} est cloturee depuis le ${formatTableuPeriodDeadline(deadline)}.`
}
