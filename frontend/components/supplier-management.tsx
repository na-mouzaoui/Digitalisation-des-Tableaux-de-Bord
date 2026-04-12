"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { API_BASE } from "@/lib/config"

type Supplier = {
  id: number
  name: string
  companyType: string
  email?: string
  phone?: string
  address?: string
  createdAt: string
}

export function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    companyType: "sarl",
    email: "",
    phone: "",
    address: ""
  })

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("jwt")
      const res = await fetch(`${API_BASE}/api/suppliers`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de charger les fournisseurs",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur de connexion au serveur",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      companyType: "sarl",
      email: "",
      phone: "",
      address: ""
    })
    setEditingSupplier(null)
  }

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        name: supplier.name,
        companyType: supplier.companyType,
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || ""
      })
    } else {
      resetForm()
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setTimeout(resetForm, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du fournisseur est requis",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const url = editingSupplier
        ? `${API_BASE}/api/suppliers/${editingSupplier.id}`
        : `${API_BASE}/api/suppliers`
      
      const method = editingSupplier ? "PUT" : "POST"

      const token = localStorage.getItem("jwt")
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: "include",
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        toast({
          title: "Succès",
          description: editingSupplier
            ? "Fournisseur modifié avec succès"
            : "Fournisseur créé avec succès"
        })
        handleCloseDialog()
        fetchSuppliers()
      } else {
        const text = await res.text()
        let errorMessage = "Erreur lors de l'opération"
        try {
          const data = JSON.parse(text)
          errorMessage = data.message || errorMessage
        } catch {}
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur de connexion au serveur",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${name} ?`)) return

    setLoading(true)
    try {
      const token = localStorage.getItem("jwt")
      const res = await fetch(`${API_BASE}/api/suppliers/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (res.ok) {
        toast({
          title: "Succès",
          description: "Fournisseur supprimé avec succès"
        })
        fetchSuppliers()
      } else {
        toast({
          title: "Erreur",
          description: "Erreur lors de la suppression",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur de connexion au serveur",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const companyTypeLabels: Record<string, string> = {
    url: "URL",
    sarl: "SARL",
    eurl: "EURL",
    spa: "SPA",
    epe: "EPE",
    snc: "SNC",
    autre: "Autre"
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fournisseurs</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un fournisseur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSupplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}
                </DialogTitle>
                <DialogDescription>
                  Remplissez les informations du fournisseur
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nom du fournisseur"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyType">Raison sociale *</Label>
                  <Select
                    value={formData.companyType}
                    onValueChange={(value) => setFormData({ ...formData, companyType: value })}
                  >
                    <SelectTrigger id="companyType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="sarl">SARL</SelectItem>
                      <SelectItem value="eurl">EURL</SelectItem>
                      <SelectItem value="spa">SPA</SelectItem>
                      <SelectItem value="epe">EPE</SelectItem>
                      <SelectItem value="snc">SNC</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemple.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+213 555 123 456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Rue Example, Ville"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Enregistrement..." : editingSupplier ? "Modifier" : "Créer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading && suppliers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun fournisseur. Cliquez sur "Ajouter un fournisseur" pour commencer.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Raison sociale</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{companyTypeLabels[supplier.companyType] || supplier.companyType}</TableCell>
                  <TableCell>{supplier.email || "-"}</TableCell>
                  <TableCell>{supplier.phone || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(supplier)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(supplier.id, supplier.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
