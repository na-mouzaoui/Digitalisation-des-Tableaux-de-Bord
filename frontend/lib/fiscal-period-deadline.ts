import { getPolicyDeadlineDay } from "./fiscal-policy"

const MONTH_LABELS: Record<string, string> = {
  "01": "Janvier",
  "02": "Février",
  "03": "Mars",
  "04": "Avril",
  "05": "Mai",
  "06": "Juin",
  "07": "Juillet",
  "08": "Août",
  "09": "Septembre",
  "10": "Octobre",
  "11": "Novembre",
  "12": "Décembre",
}

const normalizeMonth = (mois: string) => {
  const monthNumber = Number.parseInt(mois, 10)
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return null
  return String(monthNumber).padStart(2, "0")
}

const normalizeYear = (annee: string) => {
  const yearNumber = Number.parseInt(annee, 10)
  if (!Number.isInteger(yearNumber) || yearNumber < 1900 || yearNumber > 9999) return null
  return yearNumber
}

const getDeadlineDayForRole = (role?: string | null): number => {
  const policyDeadlineDay = getPolicyDeadlineDay(role)
  if (policyDeadlineDay !== null) {
    return policyDeadlineDay
  }

  return 10
}

export const getCurrentFiscalPeriod = (now: Date = new Date()) => {
  const referenceDate = now.getDate() >= 11 ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1)

  return {
    mois: String(referenceDate.getMonth() + 1).padStart(2, "0"),
    annee: String(referenceDate.getFullYear()),
  }
}

export const getFiscalPeriodDeadline = (mois: string, annee: string, role?: string | null): Date | null => {
  const normalizedMonth = normalizeMonth(mois)
  const normalizedYear = normalizeYear(annee)
  if (!normalizedMonth || !normalizedYear) return null

  const monthNumber = Number.parseInt(normalizedMonth, 10)
  const deadlineMonth = monthNumber === 12 ? 1 : monthNumber + 1
  const deadlineYear = monthNumber === 12 ? normalizedYear + 1 : normalizedYear
  const deadlineDay = getDeadlineDayForRole(role)

  return new Date(deadlineYear, deadlineMonth - 1, deadlineDay, 23, 59, 59, 0)
}

export const isFiscalPeriodLocked = (mois: string, annee: string, role?: string | null, now: Date = new Date()): boolean => {
  const deadline = getFiscalPeriodDeadline(mois, annee, role)
  if (!deadline) return false
  return now.getTime() > deadline.getTime()
}

export const formatFiscalPeriod = (mois: string, annee: string): string => {
  const normalizedMonth = normalizeMonth(mois)
  if (!normalizedMonth) return `${mois}/${annee}`
  return `${MONTH_LABELS[normalizedMonth] ?? normalizedMonth} ${annee}`
}

export const formatFiscalPeriodDeadline = (deadline: Date): string => {
  return deadline.toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export const getFiscalPeriodLockMessage = (mois: string, annee: string, role?: string | null): string => {
  const deadline = getFiscalPeriodDeadline(mois, annee, role)
  if (!deadline) {
    return `La période ${mois}/${annee} est invalide.`
  }

  return `La période ${formatFiscalPeriod(mois, annee)} est clôturée depuis le ${formatFiscalPeriodDeadline(deadline)}.`
}
