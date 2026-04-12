export function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null

  const trimmed = String(dateStr).trim()
  if (!trimmed) return null

  // yyyy-mm-dd (HTML date input)
  {
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed)
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2])
      const day = Number(match[3])
      const date = new Date(year, month - 1, day)
      return Number.isNaN(date.getTime()) ? null : date
    }
  }

  // dd/mm/yyyy or dd-mm-yyyy
  {
    const match = /^([0-9]{2})[\/\-]([0-9]{2})[\/\-]([0-9]{4})$/.exec(trimmed)
    if (match) {
      const day = Number(match[1])
      const month = Number(match[2])
      const year = Number(match[3])
      const date = new Date(year, month - 1, day)
      return Number.isNaN(date.getTime()) ? null : date
    }
  }

  // ISO datetime or other JS-supported formats
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateFR(dateStr: string): string {
  const date = parseFlexibleDate(dateStr)
  if (!date) return ""
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function getTodayISODate(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
