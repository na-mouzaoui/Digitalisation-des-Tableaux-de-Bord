"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WilayaOption {
  id: number;
  name: string;
}

interface Region {
  id: number;
  name: string;
  villes: string[];
  createdAt: string;
}

export default function AdminRegionConfig() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [wilayas, setWilayas] = useState<WilayaOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRegion, setEditingRegion] = useState<number | null>(null);
  const [selectedVilleIds, setSelectedVilleIds] = useState<number[]>([]);
  const [editedName, setEditedName] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRegionName, setNewRegionName] = useState("");
  const [newRegionVilleIds, setNewRegionVilleIds] = useState<number[]>([]);
  const [regionToDelete, setRegionToDelete] = useState<Region | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchWilayas();
    fetchRegions();
  }, []);

  const fetchWilayas = async () => {
    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/regions/wilayas`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Erreur de chargement des wilayas");

      const data = (await response.json()) as Array<{ id: number; name: string }>;
      setWilayas(data.map((item) => ({ id: item.id, name: item.name })).sort((a, b) => a.id - b.id));
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les wilayas",
        variant: "destructive",
      });
    }
  };

  const fetchRegions = async () => {
    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/regions`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Erreur de chargement");

      const data = await response.json();
      const mapped = Array.isArray(data)
        ? data.map((item: any) => ({
            id: Number(item.id),
            name: String(item.nom ?? "").trim(),
            villes: Array.isArray(item.wilayas)
              ? item.wilayas
              : Array.isArray(item.villes)
                ? item.villes
                : [],
            createdAt: String(item.createdAt ?? new Date().toISOString()),
          }))
        : [];
      setRegions(mapped);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les régions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Obtenir toutes les villes déjé assignées
  const getAssignedVilles = () => {
    const assigned = new Set<string>();
    regions.forEach(region => {
      if (editingRegion !== region.id) {
        region.villes.forEach(v => assigned.add(v));
      }
    });
    return assigned;
  };

  const getWilayaIdsFromNames = (names: string[]): number[] => {
    return names
      .map(name => wilayas.find(w => w.name === name)?.id)
      .filter((id): id is number => id != null);
  };

  const handleEdit = (region: Region) => {
    setEditingRegion(region.id);
    setSelectedVilleIds(getWilayaIdsFromNames(region.villes));
    setEditedName(region.name);
  };

  const handleVilleToggle = (wilayaId: number) => {
    setSelectedVilleIds(prev => {
      if (prev.includes(wilayaId)) {
        return prev.filter(v => v !== wilayaId);
      } else {
        return [...prev, wilayaId];
      }
    });
  };

  const handleSave = async (regionId: number) => {
    try {
      const body: { wilayaIds: number[]; name?: string } = { wilayaIds: selectedVilleIds };
      
      // Ajouter le nom s'il a été modifié
      if (editedName.trim() && editedName !== regions.find(r => r.id === regionId)?.name) {
        body.name = editedName.trim();
      }

      const token = localStorage.getItem("jwt");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const response = await fetch(`${API_BASE}/api/regions/${regionId}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la modification");
      }

      toast({
        title: "Succès",
        description: "Région mise à jour avec succès",
      });

      setEditingRegion(null);
      setSelectedVilleIds([]);
      setEditedName("");
      fetchRegions();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Échec de la modification",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingRegion(null);
    setSelectedVilles([]);
    setEditedName("");
  };

  const handleCreateRegion = async () => {
    if (!newRegionName.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom de la région est requis",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("jwt");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const response = await fetch(`${API_BASE}/api/regions`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          name: newRegionName.trim(),
          wilayaIds: newRegionVilleIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la création");
      }

      toast({
        title: "Succès",
        description: "Région créée avec succès",
      });

      setShowCreateDialog(false);
      setNewRegionName("");
      setNewRegionVilleIds([]);
      fetchRegions();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "??chec de la création",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRegion = async () => {
    if (!regionToDelete) return;

    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/regions/${regionToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la suppression");
      }

      toast({
        title: "Succés",
        description: "Région supprimée avec succés",
      });

      setRegionToDelete(null);
      fetchRegions();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "??chec de la suppression",
        variant: "destructive",
      });
    }
  };

  const handleNewRegionVilleToggle = (wilayaId: number) => {
    setNewRegionVilleIds(prev => {
      if (prev.includes(wilayaId)) {
        return prev.filter(v => v !== wilayaId);
      } else {
        return [...prev, wilayaId];
      }
    });
  };

  const getRegionColor = (name: string) => {
    switch (name.toLowerCase()) {
      case "nord":
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
      case "sud":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "est":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "ouest":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  const assignedVilles = getAssignedVilles();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle région
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {regions.map((region) => (
        <Card key={region.id} className="relative">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="capitalize flex items-center gap-2">
                {editingRegion === region.id ? (
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-48"
                    placeholder="Nom de la région"
                  />
                ) : (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getRegionColor(region.name)}`}>
                    {region.name}
                  </span>
                )}
              </CardTitle>
              {editingRegion === region.id ? (
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleSave(region.id)}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={handleCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(region)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => setRegionToDelete(region)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <CardDescription>{editingRegion === region.id ? selectedVilleIds.length : region.villes.length} wilayas</CardDescription>
          </CardHeader>
          <CardContent>
            {editingRegion === region.id ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {wilayas.map((wilaya) => {
                  const isAssigned = assignedVilles.has(wilaya.name);
                  const isSelected = selectedVilleIds.includes(wilaya.id);
                  
                  return (
                    <div key={`${region.id}-${wilaya.id}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`wilaya-${region.id}-${wilaya.id}`}
                        checked={isSelected}
                        disabled={isAssigned && !isSelected}
                        onCheckedChange={() => handleVilleToggle(wilaya.id)}
                      />
                      <Label
                        htmlFor={`wilaya-${region.id}-${wilaya.id}`}
                        className={`text-sm font-normal cursor-pointer ${
                          isAssigned && !isSelected ? "text-muted-foreground" : ""
                        }`}
                      >
                        {wilaya.name}
                        {isAssigned && !isSelected && " (assignée)"}
                      </Label>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {region.villes.map((ville, idx) => (
                  <Badge key={idx} variant="secondary">
                    {ville}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      </div>

      {/* Dialog de création */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer une nouvelle région</DialogTitle>
            <DialogDescription>
              Entrez le nom de la région et sélectionnez les wilayas é assigner
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="region-name">Nom de la région *</Label>
              <Input
                id="region-name"
                value={newRegionName}
                onChange={(e) => setNewRegionName(e.target.value)}
                placeholder="Ex: Centre, Nord-Est..."
              />
            </div>
            <div>
              <Label>Wilayas ({newRegionVilleIds.length} sélectionnées)</Label>
              <div className="mt-2 space-y-2 max-h-96 overflow-y-auto border rounded-md p-4">
                {wilayas.map((wilaya) => {
                  const isAssigned = assignedVilles.has(wilaya.name);
                  const isSelected = newRegionVilleIds.includes(wilaya.id);
                  
                  return (
                    <div key={`new-${wilaya.id}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-wilaya-${wilaya.id}`}
                        checked={isSelected}
                        disabled={isAssigned}
                        onCheckedChange={() => handleNewRegionVilleToggle(wilaya.id)}
                      />
                      <Label
                        htmlFor={`new-wilaya-${wilaya.id}`}
                        className={`text-sm font-normal cursor-pointer ${
                          isAssigned ? "text-muted-foreground" : ""
                        }`}
                      >
                        {wilaya.name}
                        {isAssigned && " (déjà assignée)"}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setNewRegionName("");
              setNewRegionVilleIds([]);
            }}>
              Annuler
            </Button>
            <Button onClick={handleCreateRegion}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!regionToDelete} onOpenChange={(open) => !open && setRegionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              ?Stes-vous sér de vouloir supprimer la région <strong>{regionToDelete?.name}</strong> ?
              Cette action est irréversible. Les {regionToDelete?.villes.length} wilayas assignées seront libérées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRegion} className="bg-emerald-500 hover:bg-emerald-600">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
