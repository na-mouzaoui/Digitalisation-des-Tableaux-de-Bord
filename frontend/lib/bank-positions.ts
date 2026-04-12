import type { Bank } from "./db"

export const DEFAULT_BANK_POSITIONS: Bank["positions"] = {
  city: { x: 301, y: 215, width: 80, fontSize: 14, rotation: 270 },
  date: { x: 301, y: 125, width: 78, fontSize: 13, rotation: 270 },
  payee: { x: 277, y: 417, width: 360, fontSize: 14, rotation: 270 },
  amountInWords: { x: 241, y: 369, width: 295, fontSize: 12, rotation: 270 },
  amount: { x: 209, y: 94, width: 88, fontSize: 15, rotation: 270 },
  checkLayout: {
    width: 550,
    height: 225,
    x: 300,
    y: 50,
    rotation: 0
  }
}

export function mergeBankPositions(positions?: Partial<Bank["positions"]>): Bank["positions"] {
  return {
    city: { rotation: 0, ...DEFAULT_BANK_POSITIONS.city, ...positions?.city },
    date: { rotation: 0, ...DEFAULT_BANK_POSITIONS.date, ...positions?.date },
    payee: { rotation: 0, ...DEFAULT_BANK_POSITIONS.payee, ...positions?.payee },
    amountInWords: { rotation: 0, ...DEFAULT_BANK_POSITIONS.amountInWords, ...positions?.amountInWords },
    amountInWordsLine2: positions?.amountInWordsLine2
      ? { rotation: 0, ...positions.amountInWordsLine2 }
      : undefined,
    amount: { rotation: 0, ...DEFAULT_BANK_POSITIONS.amount, ...positions?.amount },
    reference: positions?.reference ? { rotation: 0, ...positions.reference } : undefined,
    checkLayout: positions?.checkLayout ?? DEFAULT_BANK_POSITIONS.checkLayout,
  }
}

function keysToCamelCase(value: any): any {
  if (Array.isArray(value)) {
    return value.map(keysToCamelCase)
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, any>>((acc, [key, entryValue]) => {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1)
      acc[camelKey] = keysToCamelCase(entryValue)
      return acc
    }, {})
  }

  return value
}

export function parseBankPositions(serialized?: string): Partial<Bank["positions"]> {
  if (!serialized) {
    return {}
  }

  try {
    const parsed = JSON.parse(serialized)
    const camelized = keysToCamelCase(parsed)
    return typeof camelized === "object" && camelized !== null ? camelized : {}
  } catch {
    return {}
  }
}
