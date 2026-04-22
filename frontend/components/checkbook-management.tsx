"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Edit, BookOpen } from "lucide-react"
import type { Bank } from "@/lib/db"
import { authFetch } from "@/lib/auth-fetch"
import { API_BASE } from "@/lib/config"

interface Checkbook {
  id: number
  bankId: number
  bankName: string
  agencyName: string
  agencyCode: string
  serie: string
  startNumber: number
  endNumber: number
  capacity: number
  usedCount: number
  remaining: number
  createdAt: string
}

export function CheckbookManagement() {
  const { toast } = useToast()
  const [checkbooks, setCheckbooks] = useState<Checkbook[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>("all")

  const [formData, setFormData] = useState({
    bankId: "",
    agencyName: "",
    agencyCode: "",
    serie: "",
    startNumber: "",
    capacity: "",
    endNumber: ""
  })
  const [isCustomCapacity, setIsCustomCapacity] = useState(false)
  const [customCapacityValue, setCustomCapacityValue] = useState("")

  const loadBanks = useCallback(async () => {
    try {
      const response = await authFetch("/api/banks")
      if (response.ok) {
        const data = await response.json()
        setBanks(Array.isArray(data.banks) ? data.banks : [])
      }
    } catch (error) {
      console.error("Erreur lors du chargement des banques:", error)
    }
  }, [])

  const computeAutoEndNumber = (startValue: string, capacityValue: string) => {
    const startNum = parseInt(startValue, 10)
    const capacityNum = parseInt(capacityValue, 10)
    if (Number.isNaN(startNum) || Number.isNaN(capacityNum)) {
      return ""
    }
    return (startNum + capacityNum - 1).toString().padStart(7, '0')
  }

  const handleStartNumberChange = (value: string) => {
    setFormData((prev) => {
      const next = { ...prev, startNumber: value }
      if (prev.capacity && prev.capacity !== "autre") {
        next.endNumber = computeAutoEndNumber(value, prev.capacity)
      }
      return next
    })
  }

  const handleCapacityChange = (value: string) => {
    if (value === "autre") {
      setIsCustomCapacity(true)
      setCustomCapacityValue("")
      setFormData((prev) => ({ ...prev, capacity: "autre", endNumber: "" }))
    } else {
      setIsCustomCapacity(false)
      setCustomCapacityValue("")
      setFormData((prev) => {
        const next = { ...prev, capacity: value }
        if (prev.startNumber) {
          next.endNumber = computeAutoEndNumber(prev.startNumber, value)
        }
        return next
      })
    }
  }

  const handleCustomCapacityChange = (value: string) => {
    setCustomCapacityValue(value)
    setFormData((prev) => {
      const next = { ...prev, capacity: value }
      if (value && prev.startNumber) {
        next.endNumber = computeAutoEndNumber(prev.startNumber, value)
      } else {
        next.endNumber = ""
      }
      return next
    })
  }

  useEffect(() => {
    loadBanks()
    loadCheckbooks()
  }, [loadBanks, selectedBankFilter])

  useEffect(() => {
    const handleBanksUpdated = () => loadBanks()
    window.addEventListener("banks-updated", handleBanksUpdated)
    return () => window.removeEventListener("banks-updated", handleBanksUpdated)
  }, [loadBanks])

  const loadCheckbooks = async () => {
    setLoading(true)
    try {
      const url = selectedBankFilter && selectedBankFilter !== "all"
        ? `${API_BASE}/api/checkbooks?bankId=${selectedBankFilter}`
        : `${API_BASE}/api/checkbooks`
      const token = localStorage.getItem("jwt")
      const response = await fetch(url, { 
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (response.ok) {
        const data = await response.json()
        setCheckbooks(data)
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (checkbook?: Checkbook) => {
    if (checkbook) {
      setEditingId(checkbook.id)
      const capacity = checkbook.capacity.toString()
      const isPreset = ["15", "25", "50"].includes(capacity)
      setIsCustomCapacity(!isPreset)
      setCustomCapacityValue(isPreset ? "" : capacity)
      setFormData({
        bankId: checkbook.bankId.toString(),
        agencyName: checkbook.agencyName,
        agencyCode: checkbook.agencyCode,
        serie: checkbook.serie,
        startNumber: checkbook.startNumber.toString(),
        capacity: isPreset ? capacity : "autre",
        endNumber: checkbook.endNumber.toString().padStart(7, '0')
      })
    } else {
      setEditingId(null)
      setIsCustomCapacity(false)
      setCustomCapacityValue("")
      setFormData({
        bankId: "",
        agencyName: "",
        agencyCode: "",
        serie: "",
        startNumber: "",
        capacity: "",
        endNumber: ""
      })
    }
    setShowDialog(true)
  }

  const handleSubmit = async () => {
    if (!formData.bankId || !formData.agencyName || !formData.agencyCode || !formData.serie || !formData.startNumber || !formData.capacity) {
      toast({
        title: "Erreur",
        description: "Tous les champs sont requis",
        variant: "destructive"
      })
      return
    }

    const capacityValue = parseInt(formData.capacity === "autre" ? customCapacityValue : formData.capacity, 10)
    if (isNaN(capacityValue) || capacityValue <= 0) {
      toast({
        title: "Erreur",
        description: "Le nombre de chÃ¨ques doit Ãªtre supÃ©rieur Ã  0",
        variant: "destructive"
      })
      return
    }

    if (!formData.endNumber) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir le NÂ° de fin",
        variant: "destructive"
      })
      return
    }

    if (formData.serie.length !== 2) {
      toast({
        title: "Erreur",
        description: "La sÃ©rie doit contenir exactement 2 caractÃ¨res",
        variant: "destructive"
      })
      return
    }

    const startNum = parseInt(formData.startNumber, 10)
    const endNum = parseInt(formData.endNumber, 10)

    if (Number.isNaN(startNum) || Number.isNaN(endNum)) {
      toast({
        title: "Erreur",
        description: "Les numÃ©ros doivent Ãªtre valides",
        variant: "destructive"
      })
      return
    }

    if (startNum < 0 || startNum > 9999999) {
      toast({
        title: "Erreur",
        description: "Le numÃ©ro de dÃ©but doit Ãªtre entre 0 et 9999999",
        variant: "destructive"
      })
      return
    }

    if (endNum < 0 || endNum > 9999999) {
      toast({
        title: "Erreur",
        description: "Le numÃ©ro de fin doit Ãªtre entre 0 et 9999999",
        variant: "destructive"
      })
      return
    }

    if (endNum < startNum) {
      toast({
        title: "Erreur",
        description: "Le numÃ©ro de fin doit Ãªtre supÃ©rieur ou Ã©gal au numÃ©ro de dÃ©but",
        variant: "destructive"
      })
      return
    }

    try {
      const url = editingId
        ? `${API_BASE}/api/checkbooks/${editingId}`
        : `${API_BASE}/api/checkbooks`
      
      const body = editingId
        ? {
            agencyName: formData.agencyName,
            agencyCode: formData.agencyCode
          }
        : {
            bankId: parseInt(formData.bankId),
            agencyName: formData.agencyName,
            agencyCode: formData.agencyCode,
            serie: formData.serie.toUpperCase(),
            startNumber: startNum,
            endNumber: endNum
          }

      const token = localStorage.getItem("jwt")
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: "include",
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Erreur lors de l'enregistrement")
      }

      toast({
        title: "SuccÃ¨s",
        description: editingId ? "ChÃ©quier modifiÃ©" : "ChÃ©quier crÃ©Ã©"
      })

      setShowDialog(false)
      loadCheckbooks()
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("ÃŠtes-vous sÃ»r de vouloir supprimer ce chÃ©quier ?")) return

    try {
      const token = localStorage.getItem("jwt")
      const response = await fetch(`${API_BASE}/api/checkbooks/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Erreur lors de la suppression")
      }

      toast({
        title: "SuccÃ¨s",
        description: "ChÃ©quier supprimÃ©"
      })

      loadCheckbooks()
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const parsedStartNumber = parseInt(formData.startNumber, 10)
  const parsedEndNumber = parseInt(formData.endNumber, 10)
  const computedCapacity = !Number.isNaN(parsedStartNumber) && !Number.isNaN(parsedEndNumber) && parsedEndNumber >= parsedStartNumber
    ? parsedEndNumber - parsedStartNumber + 1
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Select value={selectedBankFilter} onValueChange={setSelectedBankFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par banque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les banques</SelectItem>
                {banks.map(bank => (
                  <SelectItem key={bank.id} value={bank.id.toString()}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau chÃ©quier
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : checkbooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun chÃ©quier trouvÃ©
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banque</TableHead>
                <TableHead>Agence</TableHead>
                <TableHead>Code Agence</TableHead>
                <TableHead>SÃ©rie</TableHead>
                <TableHead>Plage</TableHead>
                <TableHead>CapacitÃ©</TableHead>
                <TableHead>UtilisÃ©s</TableHead>
                <TableHead>Restants</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checkbooks.map(checkbook => {
                const isEmpty = checkbook.remaining === 0
                return (
                <TableRow key={checkbook.id} className={isEmpty ? "opacity-50" : ""}>
                  <TableCell>{checkbook.bankName}</TableCell>
                  <TableCell>{checkbook.agencyName}</TableCell>
                  <TableCell>{checkbook.agencyCode}</TableCell>
                  <TableCell className="font-mono font-bold">{checkbook.serie}</TableCell>
                  <TableCell className="font-mono">
                    {checkbook.startNumber.toString().padStart(7, '0')} - {checkbook.endNumber.toString().padStart(7, '0')}
                  </TableCell>
                  <TableCell>{checkbook.capacity}</TableCell>
                  <TableCell>{checkbook.usedCount}</TableCell>
                  <TableCell>
                    <span className={isEmpty ? "text-emerald-500 font-bold" : ""}>
                      {checkbook.remaining}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(checkbook)}
                        disabled={checkbook.usedCount > 0}
                        title={checkbook.usedCount > 0 ? "Impossible de modifier un chÃ©quier utilisÃ©" : "Modifier"}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {checkbook.usedCount === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(checkbook.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-emerald-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modifier le chÃ©quier" : "Nouveau chÃ©quier"}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Modifier les informations de l'agence"
                  : "CrÃ©er un nouveau chÃ©quier pour une banque"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {!editingId && (
                <>
                  <div>
                    <Label>Banque *</Label>
                    <Select
                      value={formData.bankId}
                      onValueChange={(value) => setFormData({ ...formData, bankId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="SÃ©lectionner une banque" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map(bank => (
                          <SelectItem key={bank.id} value={bank.id.toString()}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>SÃ©rie * (2 car.)</Label>
                      <Input
                        value={formData.serie}
                        onChange={(e) => setFormData({ ...formData, serie: e.target.value.toUpperCase().slice(0, 2) })}
                        placeholder="Ex: AA"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>NÂ° DÃ©but *</Label>
                      <Input
                        type="number"
                        value={formData.startNumber}
                        onChange={(e) => handleStartNumberChange(e.target.value)}
                        placeholder="0000000"
                        min="0"
                        max="9999999"
                      />
                    </div>
                    <div>
                      <Label>Nombre de chÃ¨ques *</Label>
                      <Select
                        value={formData.capacity}
                        onValueChange={handleCapacityChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="SÃ©lectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 chÃ¨ques</SelectItem>
                          <SelectItem value="25">25 chÃ¨ques</SelectItem>
                          <SelectItem value="50">50 chÃ¨ques</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {isCustomCapacity && (
                    <div>
                      <Label>Nombre personnalisÃ© *</Label>
                      <Input
                        type="number"
                        value={customCapacityValue}
                        onChange={(e) => handleCustomCapacityChange(e.target.value)}
                        placeholder="Entrer le nombre de chÃ¨ques"
                        min="1"
                        max="9999999"
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label>NÂ° Fin *</Label>
                    <Input
                      type="number"
                      value={formData.endNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, endNumber: e.target.value }))}
                      placeholder="0000019"
                      min="0"
                      max="9999999"
                      readOnly
                      disabled
                    />
                  </div>
                  
                  {computedCapacity !== null && (
                    <div className="text-sm text-muted-foreground">
                      CapacitÃ©: {computedCapacity} chÃ¨que{computedCapacity > 1 ? "s" : ""}
                    </div>
                  )}
                </>
              )}

              <div>
                <Label>Nom de l'agence *</Label>
                <Input
                  value={formData.agencyName}
                  onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                  placeholder="Ex: Agence Centre-ville"
                />
              </div>

              <div>
                <Label>Code agence *</Label>
                <Input
                  value={formData.agencyCode}
                  onChange={(e) => setFormData({ ...formData, agencyCode: e.target.value })}
                  placeholder="Ex: 001"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit}>
                {editingId ? "Modifier" : "CrÃ©er"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
