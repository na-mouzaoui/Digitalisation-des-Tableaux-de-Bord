import { promises as fs } from "fs"
import { join } from "path"
import type { Bank } from "./db"

const positionsPath = join(process.cwd(), "data", "positions.json")

export async function loadPositions(): Promise<Record<string, Bank["positions"]>> {
  try {
    const raw = await fs.readFile(positionsPath, "utf-8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function savePositions(banks: Bank[]): Promise<void> {
  const dir = join(process.cwd(), "data")
  await fs.mkdir(dir, { recursive: true })
  const map: Record<string, Bank["positions"]> = {}
  banks.forEach((bank) => {
    map[bank.id] = bank.positions
  })
  await fs.writeFile(positionsPath, JSON.stringify(map, null, 2), "utf-8")
}
