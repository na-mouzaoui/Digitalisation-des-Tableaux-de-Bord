type Apitableautableau = {
  id: number
  tabKey: string
  mois: string
  annee: string
  direction: string
  dataJson: string
}

export function getPreviousPeriod(mois: string, annee: string): { mois: string; annee: string } {
  const m = Number.parseInt(mois, 10)
  const a = Number.parseInt(annee, 10)
  if (isNaN(m) || isNaN(a)) return { mois, annee }
  if (m === 1) return { mois: "12", annee: String(a - 1) }
  return { mois: String(m - 1).padStart(2, "0"), annee }
}

export function getNextPeriod(mois: string, annee: string): { mois: string; annee: string } {
  const m = Number.parseInt(mois, 10)
  const a = Number.parseInt(annee, 10)
  if (isNaN(m) || isNaN(a)) return { mois, annee }
  if (m === 12) return { mois: "01", annee: String(a + 1) }
  return { mois: String(m + 1).padStart(2, "0"), annee }
}

function findDeclaration(
  declarations: Apitableautableau[],
  tabKey: string,
  mois: string,
  annee: string,
  direction: string,
): Apitableautableau | undefined {
  return declarations.find(
    (d) =>
      d.tabKey === tabKey &&
      d.mois === mois &&
      d.annee === annee &&
      d.direction === direction,
  )
}

export function findPreviousDeclaration(
  declarations: Apitableautableau[],
  tabKey: string,
  mois: string,
  annee: string,
  direction: string,
): Apitableautableau | undefined {
  const prev = getPreviousPeriod(mois, annee)
  return findDeclaration(declarations, tabKey, prev.mois, prev.annee, direction)
}

export function mapMtoM1(row: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === "m") {
      result.m1 = value
    } else if (/^m[A-Z]/.test(key)) {
      result["m1" + key.slice(1)] = value
    }
  }
  return result
}

export function shouldAutoPopulate(
  declarations: Apitableautableau[],
  tabKey: string,
  mois: string,
  annee: string,
  direction: string,
): boolean {
  const existing = findDeclaration(declarations, tabKey, mois, annee, direction)
  return !existing
}

export function getPreviousPeriodData<T extends Record<string, string>>(
  declarations: Apitableautableau[],
  tabKey: string,
  mois: string,
  annee: string,
  direction: string,
): T[] | null {
  const prevDecl = findPreviousDeclaration(declarations, tabKey, mois, annee, direction)
  if (!prevDecl) return null
  try {
    const parsed = JSON.parse(prevDecl.dataJson)
    const dataKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]))
    if (!dataKey) return null
    return parsed[dataKey] as T[]
  } catch {
    return null
  }
}

export function autoPopulateM1Fields<T extends Record<string, string>>(
  rows: T[],
  previousRows: T[] | null,
): T[] {
  if (!previousRows || previousRows.length === 0) return rows
  return rows.map((row, index) => {
    const prevRow = previousRows[index]
    if (!prevRow) return row
    const m1Values = mapMtoM1(prevRow)
    return { ...row, ...m1Values }
  }) as T[]
}
