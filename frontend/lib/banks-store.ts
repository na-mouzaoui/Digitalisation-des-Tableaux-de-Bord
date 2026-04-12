import { promises as fs } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { Bank } from "./db"

const __dirname = dirname(fileURLToPath(import.meta.url))
const banksPath = join(process.cwd(), "data", "banks.json")

export async function loadBanksFromDisk(): Promise<Partial<Bank>[]> {
  try {
    const raw = await fs.readFile(banksPath, "utf-8")
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function saveBanksToDisk(banks: Bank[]): Promise<void> {
  const dir = join(process.cwd(), "data")
  await fs.mkdir(dir, { recursive: true })
  const payload = banks.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    pdfUrl: b.pdfUrl,
    positions: b.positions,
  }))
  await fs.writeFile(banksPath, JSON.stringify(payload, null, 2), "utf-8")
}