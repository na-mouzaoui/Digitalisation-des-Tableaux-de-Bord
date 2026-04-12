"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Filter, FileSpreadsheet } from "lucide-react"
import { exportHistoryToPDF, exportHistoryToExcel } from "@/lib/export-utils"
import type { Bank, Check, User } from "@/lib/db"
import { Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { formatDateFR, parseFlexibleDate } from "@/lib/date-utils"
import { API_BASE } from "@/lib/config"

interface CheckHistoryProps {
  checks: Check[]
  users: User[]
  banks: Bank[]
}

type SortField = 'reference' | 'user' | 'payee' | 'bank' | 'amount' | 'date' | 'city' | 'createdAt' | 'status'
type SortOrder = 'asc' | 'desc'

const formatNumber = (num: number) => {
  return num.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1\u00A0')
}

const getBankCode = (bankNameOrCode: string, banks: Bank[]) => {
  const target = (bankNameOrCode || "").trim().toLowerCase()
  const found = banks.find(b => b.name.trim().toLowerCase() === target || b.code.trim().toLowerCase() === target)
  return found?.code || bankNameOrCode
}

export function CheckHistory({ checks: initialChecks, users, banks }: CheckHistoryProps) {
  const [mounted, setMounted] = useState(false)
  const [checks, setChecks] = useState<Check[]>(initialChecks)
  const [search, setSearch] = useState("")
  const [bankFilter, setBankFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState<Check | null>(null)
  const [newStatus, setNewStatus] = useState("")
  const [motif, setMotif] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Synchroniser les checks locaux avec les props quand elles changent
  useEffect(() => {
    setChecks(initialChecks)
  }, [initialChecks])

  const userMap = users.reduce(
    (acc, user) => {
      acc[String(user.id)] = user.email
      return acc
    },
    {} as Record<string, string>,
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const sortedChecks = [...checks].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'reference':
        aValue = a.reference || ''
        bValue = b.reference || ''
        break
      case 'user':
        aValue = userMap[String(a.userId)] || ''
        bValue = userMap[String(b.userId)] || ''
        break
      case 'payee':
        aValue = a.payee
        bValue = b.payee
        break
      case 'bank':
        aValue = a.bank
        bValue = b.bank
        break
      case 'amount':
        aValue = a.amount
        bValue = b.amount
        break
      case 'date':
        aValue = parseFlexibleDate(a.date)?.getTime() ?? 0
        bValue = parseFlexibleDate(b.date)?.getTime() ?? 0
        break
      case 'city':
        aValue = a.city || ''
        bValue = b.city || ''
        break
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
        break
      case 'status':
        aValue = a.status || 'emit'
        bValue = b.status || 'emit'
        break
      default:
        aValue = new Date(b.createdAt).getTime()
        bValue = new Date(a.createdAt).getTime()
    }

    if (typeof aValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    } else {
      return sortOrder === 'asc'
        ? aValue - bValue
        : bValue - aValue
    }
  })

  const filteredChecks = sortedChecks.filter((check) => {
    const matchesSearch =
      check.payee.toLowerCase().includes(search.toLowerCase()) ||
      check.reference.toLowerCase().includes(search.toLowerCase()) ||
      userMap[String(check.userId)]?.toLowerCase().includes(search.toLowerCase())

    const matchesBank = bankFilter === "all" || check.bank === bankFilter
    const matchesUser = userFilter === "all" || String(check.userId) === userFilter
    // Traiter les chèques sans status comme "emit"
    const checkStatus = check.status || "emit"
    const matchesStatus = statusFilter === "all" || checkStatus === statusFilter

    const matchesMinAmount = minAmount === "" || check.amount >= Number.parseFloat(minAmount)
    const matchesMaxAmount = maxAmount === "" || check.amount <= Number.parseFloat(maxAmount)

    const checkDate = parseFlexibleDate(check.date)
    if (!checkDate) {
      return false
    }

    const start = startDate === "" ? null : parseFlexibleDate(startDate)
    const end = endDate === "" ? null : parseFlexibleDate(endDate)
    const matchesStartDate = !start || checkDate >= start
    const matchesEndDate = !end || checkDate <= end

    return (
      matchesSearch &&
      matchesBank &&
      matchesUser &&
      matchesStatus &&
      matchesMinAmount &&
      matchesMaxAmount &&
      matchesStartDate &&
      matchesEndDate
    )
  })

  const uniqueBanks = Array.from(new Set(checks.map((c) => c.bank)))

  const handleUpdateStatus = async () => {
    if (!selectedCheck || !newStatus) return

    // Validation: motif requis UNIQUEMENT pour annule
    if (newStatus === "annule" && !motif.trim()) {
      toast({
        title: "❌ Erreur",
        description: "Un motif est requis pour annuler un chèque",
        variant: "destructive"
      })
      return
    }

    setIsUpdating(true)
    try {
      const token = localStorage.getItem("jwt")
      const response = await fetch(`${API_BASE}/api/checks/${encodeURIComponent(selectedCheck.reference)}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: "include",
        body: JSON.stringify({
          status: newStatus,
          motif: motif.trim() || undefined
        })
      })

      if (!response.ok) {
        const text = await response.text()
        let errorMessage = "Erreur lors de la mise \u00e0 jour"
        try {
          const error = JSON.parse(text)
          errorMessage = error.message || errorMessage
        } catch {
          errorMessage = text || `Erreur HTTP ${response.status}`
        }
        throw new Error(errorMessage)
      }

      // Update local state
      setChecks(prevChecks => 
        prevChecks.map(c => 
          c.reference === selectedCheck.reference 
            ? { ...c, status: newStatus, motif: motif.trim() || undefined }
            : c
        )
      )

      toast({
        title: "✓ Succès",
        description: `Statut du chèque mis à jour: ${newStatus === "emit" ? "Émis" : newStatus === "annule" ? "Annulé" : "Rejeté"}`,
      })

      setShowStatusDialog(false)
      
      // Recharger la page pour mettre à jour les stats
      setTimeout(() => router.refresh(), 500)
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message || "Erreur lors de la mise à jour du statut",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleExportPDF = async () => {
    exportHistoryToPDF(filteredChecks, users, banks)
    
    // Log export to audit
    try {
      await fetch("/api/checks/log-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "PDF",
          recordCount: filteredChecks.length,
          dateRange: startDate && endDate ? `${startDate} - ${endDate}` : null,
        }),
      })
    } catch (error) {
      console.error("Failed to log export:", error)
    }
  }

  const handleExportExcel = async () => {
    exportHistoryToExcel(filteredChecks, users, banks)
    
    // Log export to audit
    try {
      await fetch("/api/checks/log-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "Excel",
          recordCount: filteredChecks.length,
          dateRange: startDate && endDate ? `${startDate} - ${endDate}` : null,
        }),
      })
    } catch (error) {
      console.error("Failed to log export:", error)
    }
  }

  const resetFilters = () => {
    setSearch("")
    setBankFilter("all")
    setUserFilter("all")
    setStatusFilter("all")
    setMinAmount("")
    setMaxAmount("")
    setStartDate("")
    setEndDate("")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Historique des Chèques</CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" style={{ color: '#e82c2a' }} />
              {showFilters ? "Masquer" : "Filtres"}
            </Button>
            <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-2 bg-transparent">
              <Download className="h-4 w-4" style={{ color: '#e82c2a' }} />
              Exporter en PDF
            </Button>
            <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2 bg-transparent">
              <FileSpreadsheet className="h-4 w-4" style={{ color: '#e82c2a' }} />
              Exporter en Excel
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 rounded-lg border bg-muted/50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Filtres Avancés</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* User Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium">Utilisateur</label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les utilisateurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les utilisateurs</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bank Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium">Banque</label>
                <Select value={bankFilter} onValueChange={setBankFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les banques" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les banques</SelectItem>
                    {uniqueBanks.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium">Statut</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="emit">Émis</SelectItem>
                    <SelectItem value="annule">Annulé</SelectItem>
                    <SelectItem value="rejete">Rejeté</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Min Amount */}
              <div>
                <label className="mb-2 block text-sm font-medium">Montant min (DZD)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="mb-2 block text-sm font-medium">Montant max (DZD)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="mb-2 block text-sm font-medium">Date début</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              {/* End Date */}
              <div>
                <label className="mb-2 block text-sm font-medium">Date fin</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={resetFilters} variant="outline" size="sm">
                Réinitialiser
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: '#e82c2a' }} />
            <Input
              placeholder="Rechercher par bénéficiaire, référence ou utilisateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredChecks.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('reference')} className="h-8 p-0 font-semibold hover:underline">
                      Référence
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('user')} className="h-8 p-0 font-semibold hover:underline">
                      Utilisateur
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('payee')} className="h-8 p-0 font-semibold hover:underline">
                      Bénéficiaire
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('bank')} className="h-8 p-0 font-semibold hover:underline">
                      Banque
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('amount')} className="h-8 p-0 font-semibold hover:underline">
                      Montant (DZD)
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('date')} className="h-8 p-0 font-semibold hover:underline">
                      Date
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('city')} className="h-8 p-0 font-semibold hover:underline">
                      Ville
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('createdAt')} className="h-8 p-0 font-semibold hover:underline">
                      Créé le
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="h-8 p-0 font-semibold hover:underline">
                      Statut
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold">
                    Motif
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecks.map((check) => (
                <TableRow key={check.reference}>
                    <TableCell className="font-mono text-sm">{check.reference || "—"}</TableCell>
                    <TableCell className="text-sm">{userMap[String(check.userId)] || "Inconnu"}</TableCell>
                    <TableCell className="font-medium">{check.payee}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getBankCode(check.bank, banks)}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{formatNumber(check.amount)}</TableCell>
                    <TableCell className="text-sm">
                      {formatDateFR(check.date)}
                    </TableCell>
                    <TableCell className="text-sm">{check.city || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(check.createdAt)}</TableCell>
                    <TableCell>
                      {!mounted ? (
                        <div className="h-8 w-[110px] rounded border bg-muted/50 animate-pulse" />
                      ) : (
                      <Select
                        value={check.status || "emit"}
                        onValueChange={async (newStatus) => {
                          setSelectedCheck(check)
                          setNewStatus(newStatus)
                          
                          // Interdire le retour vers emit
                          if (check.status !== "emit" && newStatus === "emit") {
                            toast({
                              title: "❌ Erreur",
                              description: "Impossible de revenir au statut 'Émis' depuis 'Annulé' ou 'Rejeté'",
                              variant: "destructive"
                            })
                            return
                          }
                          
                          // Si annulation, ouvrir dialog pour le motif
                          if (newStatus === "annule") {
                            setMotif("")
                            setShowStatusDialog(true)
                          } else if (newStatus === "rejete") {
                            // Pour rejeté, changer directement sans motif
                            setIsUpdating(true)
                            try {
                              const token = localStorage.getItem("jwt")
                            const response = await fetch(`${API_BASE}/api/checks/${encodeURIComponent(check.reference)}/status`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...(token ? { Authorization: `Bearer ${token}` } : {})
                                },
                                credentials: "include",
                                body: JSON.stringify({
                                  status: newStatus,
                                  motif: undefined
                                })
                              })

                              if (!response.ok) {
                                const text = await response.text()
                                let errorMessage = "Erreur lors de la mise \u00e0 jour"
                                try {
                                  const error = JSON.parse(text)
                                  errorMessage = error.message || errorMessage
                                } catch {
                                  errorMessage = text || `Erreur HTTP ${response.status}`
                                }
                                throw new Error(errorMessage)
                              }

                              // Update local state
                              setChecks(prevChecks => 
                                prevChecks.map(c => 
                                  c.reference === check.reference 
                                    ? { ...c, status: newStatus, motif: undefined }
                                    : c
                                )
                              )

                              toast({
                                title: "✓ Succès",
                                description: "Statut du chèque mis à jour: Rejeté",
                              })

                              // Recharger la page pour mettre à jour les stats
                              setTimeout(() => router.refresh(), 500)
                            } catch (error: any) {
                              toast({
                                title: "❌ Erreur",
                                description: error.message || "Erreur lors de la mise à jour du statut",
                                variant: "destructive"
                              })
                            } finally {
                              setIsUpdating(false)
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emit">
                            <span className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              Émis
                            </span>
                          </SelectItem>
                          <SelectItem value="annule">
                            <span className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-emerald-500" />
                              Annulé
                            </span>
                          </SelectItem>
                          <SelectItem value="rejete">
                            <span className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-orange-500" />
                              Rejeté
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate" title={check.motif || ""}>
                      {check.motif || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            {checks.length === 0 ? "Aucun chèque émis pour le moment" : "Aucun résultat trouvé"}
          </div>
        )}

        {filteredChecks.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {filteredChecks.length} chèque{filteredChecks.length > 1 ? "s" : ""} trouvé
              {filteredChecks.length > 1 ? "s" : ""}
            </p>
            <p className="text-sm font-medium">
              Total (émis uniquement):{" "}
              <span className="text-lg font-bold" style={{ color: '#2db34b' }}>
                {formatNumber(filteredChecks.filter(c => !c.status || c.status === "emit").reduce((sum, check) => sum + check.amount, 0))} DZD
              </span>
            </p>
          </div>
        )}
      </CardContent>

      {/* Dialog pour changer le statut */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler le chèque</DialogTitle>
            <DialogDescription>
              Chèque #{selectedCheck?.reference} - {selectedCheck?.payee}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motif">Motif *</Label>
              <Textarea
                id="motif"
                placeholder="Indiquer la raison de l'annulation..."
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isUpdating || !motif.trim()}>
              {isUpdating ? "Mise à jour..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
