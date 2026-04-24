"use client"

import { useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Hourglass, ClipboardList, FileClock, ShieldCheck, Filter, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ReminderData } from "@/lib/tableau-reminders"

const normalizeDirectionKey = (value: string) => {
  const normalized = (value ?? "").trim().toLowerCase()
  if (!normalized) return ""
  if (normalized === "siege" || normalized === "siége" || normalized.includes("siege") || normalized.includes("siége")) {
    return "siége"
  }
  return normalized
}

interface RemindersCardProps {
  reminders: ReminderData[]
  loading?: boolean
  userRole?: string
  directionOptions?: string[]
  selectedMonth?: string
  selectedYear?: string
  onMonthChange?: (value: string) => void
  onYearChange?: (value: string) => void
}

const MONTH_OPTIONS = [
  { value: "01", label: "Janvier" },
  { value: "02", label: "Fevrier" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Aout" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Decembre" },
]

const formatCountdown = (daysUntilDeadline: number) => {
  if (daysUntilDeadline < 0) {
    return `${Math.abs(daysUntilDeadline)} jours de retard`
  }

  return `${daysUntilDeadline} jours restant`
}

const formatDeadlineDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = String(date.getFullYear())
  return `${day}/${month}/${year}`
}

export function RemindersCard({
  reminders,
  loading = false,
  userRole = "",
  directionOptions = [],
  selectedMonth = "",
  selectedYear = "",
  onMonthChange,
  onYearChange,
}: RemindersCardProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDirection, setSelectedDirection] = useState("all")
  const normalizedRole = userRole.trim().toLowerCase()
  const isAdmin = normalizedRole === "admin"
  const isGlobalRole = normalizedRole === "direction" || normalizedRole === "global" || normalizedRole === "globale"

  const availableDirectionOptions = useMemo(
    () =>
      (directionOptions.length > 0
        ? directionOptions
        : Array.from(new Set(reminders.map((r) => r.direction).filter(Boolean)))
      ).sort((a, b) => a.localeCompare(b, "fr")),
    [directionOptions, reminders],
  )

  const filteredReminders = useMemo(() => {
    if (!isAdmin || selectedDirection === "all") return reminders
    const selectedDirectionKey = normalizeDirectionKey(selectedDirection)
    return reminders.filter((r) => normalizeDirectionKey(r.direction) === selectedDirectionKey)
  }, [isAdmin, reminders, selectedDirection])

  const directionStatus = useMemo(() => {
    if (!isAdmin && !isGlobalRole) return null

    const totalDirections = availableDirectionOptions.length
    const remindersByDirection = new Map(
      reminders
        .map((r) => [normalizeDirectionKey(r.direction ?? ""), r] as const)
        .filter(([direction]) => direction.length > 0),
    )

    const upToDateDirections = availableDirectionOptions.reduce((count, direction) => {
      const reminder = remindersByDirection.get(normalizeDirectionKey(direction))
      if (!reminder) {
        return count
      }

      return reminder.remainingToEnterTabs === 0 && reminder.remainingToApproveTabs === 0
        ? count + 1
        : count
    }, 0)

    return {
      upToDateDirections,
      totalDirections,
    }
  }, [isAdmin, isGlobalRole, availableDirectionOptions, reminders])

  const remindersForDisplay = useMemo(() => {
    // Utiliser directement les rappels du backend sans recalcul local
    // Le backend calcule correctement la période tableau et le deadline

    if (isAdmin && selectedDirection === "all") {
      if (availableDirectionOptions.length === 0) {
        return filteredReminders.length > 0 ? filteredReminders : []
      }

      const remindersByDirection = new Map(
        filteredReminders.map((reminder) => [normalizeDirectionKey(reminder.direction), reminder] as const),
      )

      // Retourner les rappels du backend pour chaque direction, sans modification
      return availableDirectionOptions
        .map((direction) => remindersByDirection.get(normalizeDirectionKey(direction)))
        .filter((reminder) => reminder !== undefined) as ReminderData[]
    }

    // Pour les non-admins ou quand une direction est sélectionnée, retourner les rappels directement
    return filteredReminders
  }, [availableDirectionOptions, filteredReminders, isAdmin, selectedDirection])

  const hasActiveReminder = useMemo(() => {
    if ((isAdmin || isGlobalRole) && directionStatus) {
      if (directionStatus.totalDirections === 0) return false
      return directionStatus.upToDateDirections < directionStatus.totalDirections
    }

    return reminders.some((reminder) =>
      reminder.daysUntilDeadline <= 5
      && (reminder.remainingToEnterTabs > 0 || reminder.remainingToApproveTabs > 0),
    )
  }, [reminders, isAdmin, isGlobalRole, directionStatus])

  const lastDeadlineLabel = useMemo(() => {
    if (remindersForDisplay.length === 0) return "-"

    const lastDeadline = remindersForDisplay.reduce((latest, current) => {
      const latestTime = new Date(latest.deadline).getTime()
      const currentTime = new Date(current.deadline).getTime()
      return currentTime > latestTime ? current : latest
    }, remindersForDisplay[0])

    return formatDeadlineDate(lastDeadline.deadline)
  }, [remindersForDisplay])

  if (loading) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hourglass size={18} className="text-yellow-700" />
            Rappels et delais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-800">Chargement des rappels...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" style={{ color: "#e82c2a" }} />
            {showFilters ? "Masquer les filtres" : "Afficher les filtres"}
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtres indicateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mois</p>
                  <Select value={selectedMonth} onValueChange={(value) => onMonthChange?.(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un mois" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Annee</p>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={2000}
                    max={2100}
                    placeholder="ex: 2026"
                    value={selectedYear}
                    onChange={(event) => onYearChange?.(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>

                {isAdmin && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Direction</p>
                    <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tout" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tout</SelectItem>
                        {availableDirectionOptions.map((direction) => (
                          <SelectItem key={direction} value={direction}>
                            {direction}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ReminderKpiRow reminders={remindersForDisplay} directionStatus={directionStatus} />

      {hasActiveReminder ? (
        <div className="rounded-md bg-red-700 px-3 py-2">
          <p className="text-sm font-semibold text-yellow-300 whitespace-nowrap overflow-hidden text-ellipsis">
            Rappel: delai proche. Verifiez et completez vos tableaux tableaus en attente ({lastDeadlineLabel})
          </p>
        </div>
      ) : (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2">
          <p className="text-sm font-medium text-green-800">
            Les tableaux de la direction sont a jour. Dernier delai: {lastDeadlineLabel}.
          </p>
        </div>
      )}
    </div>
  )
}

function ReminderKpiRow({
  reminders,
  directionStatus,
}: {
  reminders: ReminderData[]
  directionStatus: { upToDateDirections: number; totalDirections: number } | null
}) {
  // Si aucun rappel n'existe, afficher un message d'erreur
  if (!reminders || reminders.length === 0) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-800">Aucun rappel disponible pour cette période.</p>
        </CardContent>
      </Card>
    )
  }

  const closestReminder = reminders.reduce((acc, current) =>
    current.daysUntilDeadline < acc.daysUntilDeadline ? current : acc,
  reminders[0])

  const totalTabs = reminders.reduce((sum, reminder) => sum + reminder.totalTabs, 0)
  const enteredTabs = reminders.reduce((sum, reminder) => sum + reminder.enteredTabs, 0)
  const approvedTabs = reminders.reduce((sum, reminder) => sum + reminder.approvedTabs, 0)
  const remainingToEnterTabs = reminders.reduce((sum, reminder) => sum + reminder.remainingToEnterTabs, 0)
  const currentPeriodLabel = `${closestReminder.mois}/${closestReminder.annee}`

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <p className="text-sm font-medium text-muted-foreground">
          Periode en cours: <span className="text-foreground">{currentPeriodLabel}</span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className={`grid ${directionStatus ? "grid-cols-5 min-w-[1120px]" : "grid-cols-4 min-w-[900px]"} gap-3`}>
        <div>
          <IndicatorBrick
            label="Temps restant avant delai"
            value={formatCountdown(closestReminder.daysUntilDeadline)}
            icon={<Hourglass className="h-4 w-4 text-orange-500" />}
            valueClassName="text-orange-600"
          />
        </div>
        <div>
          <IndicatorBrick
            label="tableaux saisis"
            value={`${enteredTabs}/${totalTabs}`}
            icon={<ClipboardList className="h-4 w-4" style={{ color: "#e82c2a" }} />}
          />
        </div>
        <div>
          <IndicatorBrick
            label="tableaux approuvés"
            value={`${approvedTabs}/${totalTabs}`}
            icon={<ShieldCheck className="h-4 w-4 text-green-500" />}
            valueClassName="text-green-600"
          />
        </div>
        <div>
          <IndicatorBrick
            label="tableaux restants a saisir"
            value={String(remainingToEnterTabs)}
            icon={<FileClock className="h-4 w-4 text-amber-500" />}
            valueClassName="text-amber-600"
          />
        </div>
        {directionStatus && (
          <div>
            <IndicatorBrick
              label="Directions a jour"
              value={`${directionStatus.upToDateDirections}/${directionStatus.totalDirections}`}
              icon={<Building2 className="h-4 w-4 text-blue-500" />}
              valueClassName="text-blue-600"
            />
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

function IndicatorBrick({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string
  value: string
  icon: React.ReactNode
  valueClassName?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClassName ?? ""}`.trim()}>{value}</div>
      </CardContent>
    </Card>
  )
}
