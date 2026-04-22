"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Upload, Trash2, Edit } from "lucide-react"
import type { Bank } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { API_BASE } from "@/lib/config"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type BankManagementProps = {
  onChange?: () => void
}

export function BankManagement({ onChange }: BankManagementProps) {
  const { toast } = useToast()
  const [banks, setBanks] = useState<Bank[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newBank, setNewBank] = useState({ code: "", name: "" })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const requestWithAuth = async (input: string, init: RequestInit = {}) => {
    const token = localStorage.getItem("jwt")
    return fetch(input, { 
      ...init, 
      credentials: "include",
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
  }

  useEffect(() => {
    loadBanks()
  }, [])

  const loadBanks = async () => {
    const response = await requestWithAuth(`${API_BASE}/api/banks`)
    if (!response.ok) {
      console.error("Failed to load banks", await response.text())
      return
    }
    const data = await response.json()
    setBanks(data.banks)
  }

  const notifyBanksUpdated = () => {
    onChange?.()
    // Inform other screens (chÃ¨ques, calibrage) to reload without a manual refresh
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("banks-updated"))
    }
  }

  const handleAddBank = async () => {
    if (!newBank.code || !newBank.name) return

    const formData = new FormData()
    formData.append("code", newBank.code)
    formData.append("name", newBank.name)
    if (pdfFile) {
      formData.append("pdf", pdfFile)
    }

    const response = await requestWithAuth(`${API_BASE}/api/banks`, {
      method: "POST",
      body: formData,
    })

    if (response.ok) {
      const scanMessage = pdfFile ? "avec scan PDF" : "sans scan PDF"
      toast({
        title: "âœ“ Banque ajoutÃ©e",
        description: `La banque "${newBank.name}" a Ã©tÃ© ajoutÃ©e ${scanMessage}.`,
      })
      setNewBank({ code: "", name: "" })
      setPdfFile(null)
      setIsAdding(false)
      await loadBanks()
      notifyBanksUpdated()
    } else {
      toast({
        title: "âœ— Erreur",
        description: "Impossible d'ajouter la banque.",
        variant: "destructive",
      })
    }
  }

  const handleEditBank = async () => {
    if (!newBank.code || !newBank.name || !editingId) return

    const formData = new FormData()
    formData.append("code", newBank.code)
    formData.append("name", newBank.name)
    if (pdfFile) {
      formData.append("pdf", pdfFile)
    }

    const response = await requestWithAuth(`${API_BASE}/api/banks/${editingId}`, {
      method: "PATCH",
      body: formData,
    })

    if (response.ok) {
      const scanMessage = pdfFile ? "avec nouveau scan PDF" : "sans modification du scan"
      toast({
        title: "âœ“ Banque modifiÃ©e",
        description: `La banque "${newBank.name}" a Ã©tÃ© modifiÃ©e ${scanMessage}.`,
      })
      setNewBank({ code: "", name: "" })
      setPdfFile(null)
      setIsEditing(false)
      setEditingId(null)
      await loadBanks()
      notifyBanksUpdated()
    } else {
      toast({
        title: "âœ— Erreur",
        description: "Impossible de modifier la banque.",
        variant: "destructive",
      })
    }
  }

  const startEdit = (bank: Bank) => {
    setNewBank({ code: bank.code, name: bank.name })
    setEditingId(bank.id)
    setIsEditing(true)
    setIsAdding(false)
  }

  const cancelEdit = () => {
    setNewBank({ code: "", name: "" })
    setPdfFile(null)
    setIsEditing(false)
    setEditingId(null)
    setIsAdding(false)
  }

  const confirmDeleteBank = async () => {
    if (!deleteConfirmId) return

    const bankToDelete = banks.find(b => b.id === deleteConfirmId)
    const response = await requestWithAuth(`${API_BASE}/api/banks/${deleteConfirmId}`, {
      method: "DELETE",
    })

    if (response.ok) {
      toast({
        title: "âœ“ Banque supprimÃ©e",
        description: `La banque "${bankToDelete?.name || 'inconnue'}" a Ã©tÃ© supprimÃ©e.`,
      })
      await loadBanks()
      notifyBanksUpdated()
    } else {
      toast({
        title: "âœ— Erreur",
        description: "Impossible de supprimer la banque.",
        variant: "destructive",
      })
    }
    setDeleteConfirmId(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(!isAdding)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Ajouter une banque
        </Button>
      </div>

      {(isAdding || isEditing) && (
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold">{isEditing ? "Modifier la banque" : "Nouvelle Banque"}</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Code de la banque</Label>
              <Input
                id="code"
                placeholder="Ex: BDL"
                value={newBank.code}
                onChange={(e) => setNewBank({ ...newBank, code: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                placeholder="Ex: BDL - Banque de DÃ©veloppement Local"
                value={newBank.name}
                onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="pdf">ModÃ¨le de chÃ¨que (PDF)</Label>
              <div className="flex items-center gap-2">
                <Input id="pdf" type="file" accept=".pdf" onChange={handleFileChange} />
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              {pdfFile && <p className="mt-1 text-sm text-muted-foreground">{pdfFile.name}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={isEditing ? handleEditBank : handleAddBank}>
                {isEditing ? "Enregistrer" : "Ajouter"}
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {banks.map((bank) => (
          <Card key={bank.id} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{bank.code}</h3>
                <p className="text-sm text-muted-foreground">{bank.name}</p>
                {bank.pdfUrl && <p className="mt-2 text-xs text-green-600">âœ“ ModÃ¨le PDF chargÃ©</p>}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(bank)}
                  className="text-gray-600 hover:text-gray-700"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirmId(bank.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              ÃŠtes-vous sÃ»r de vouloir supprimer cette banque ? Cette action est irrÃ©versible et supprimera Ã©galement
              tous les calibrages associÃ©s.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBank} className="bg-emerald-600 hover:bg-emerald-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
