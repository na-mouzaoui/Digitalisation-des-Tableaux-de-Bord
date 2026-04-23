import { authFetch } from "./auth-fetch"

export interface ReminderData {
  direction: string
  mois: string
  annee: string
  deadline: string
  daysUntilDeadline: number
  totalTabs: number
  enteredTabs: number
  approvedTabs: number
  remainingToEnterTabs: number
  remainingToApproveTabs: number
  missingTabs: string[]
  isUrgent: boolean
}

interface RemindersResponse {
  reminders: ReminderData[]
}

export const gettableauReminders = async (mois?: string, annee?: string): Promise<ReminderData[]> => {
  try {
    console.log("[gettableauReminders] Calling /api/tableau/reminders...")
    const params = new URLSearchParams()
    if (mois) params.set("mois", mois)
    if (annee) params.set("annee", annee)
    const query = params.toString()
    const endpoint = query ? `/api/tableau/reminders?${query}` : "/api/tableau/reminders"

    const response = await authFetch(endpoint, { cache: "no-store" })
    console.log(`[gettableauReminders] Response status: ${response.status}`)
    
    if (!response.ok) {
      console.log("[gettableauReminders] Response not OK, returning empty array")
      return []
    }

    const payload = (await response.json().catch(() => null)) as RemindersResponse | ReminderData[] | null
    console.log("[gettableauReminders] Payload:", payload)

    if (Array.isArray(payload)) {
      console.log(`[gettableauReminders] Returning ${payload.length} reminders (direct array)`)
      return payload
    }
    if (!payload || !Array.isArray(payload.reminders)) {
      console.log("[gettableauReminders] Invalid payload structure, returning empty array")
      return []
    }
    
    console.log(`[gettableauReminders] Returning ${payload.reminders.length} reminders`)
    return payload.reminders
  } catch (error) {
    console.error("[gettableauReminders] Error:", error)
    return []
  }
}

export const formatTabKey = (tabKey: string): string => {
  const labels: Record<string, string> = {
    encaissement: "Encaissement",
    tva_immo: "TVA Immo",
    tva_biens: "TVA Biens",
    droits_timbre: "Droits Timbre",
    ca_tap: "C.A. TAP",
    etat_tap: "Etat TAP",
    ca_siege: "C.A. Siege",
    irg: "IRG",
    taxe2: "Taxe 2%",
    taxe_masters: "Taxe Masters",
    taxe_vehicule: "Taxe Vehicule",
    taxe_formation: "Taxe Formation",
    acompte: "Acompte",
    ibs: "IBS",
    taxe_domicil: "Taxe Domiciliation",
    tva_autoliq: "TVA Auto-Liquidation",
  }

  return labels[tabKey] ?? tabKey
}

export const formatPeriodLabel = (mois: string, annee: string): string => {
  const monthLabels: Record<string, string> = {
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

  return `${monthLabels[mois] ?? mois} ${annee}`
}
