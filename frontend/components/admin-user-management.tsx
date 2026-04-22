"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Eye, EyeOff, KeyRound, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ROLE_OPTIONS = [
  {
    value: "direction",
    label: "Global",
    privileges: [
      "Accès complet à toutes les régions",
      "Accès aux tableus tableues de toutes les directions",
      "Supervision des workflows tableuux",
    ],
  },
  {
    value: "comptabilite",
    label: "Finance",
    privileges: [
      "Accès aux fonctionnalités financières",
      "Gestion des tableus tableues",
      "Validation des tableus siège",
    ],
  },
  {
    value: "regionale",
    label: "Régionale",
    privileges: [
      "Accès limité à sa région assignée uniquement",
      "Consultation de l'historique de sa région",
      "Validation des tableus régionales",
    ],
  },
];

const getRoleLabel = (role: string) => {
  switch ((role ?? "").trim().toLowerCase()) {
    case "admin":
      return "Admin"
    case "comptabilite":
      return "Finance"
    case "regionale":
      return "Regionale"
    case "direction":
      return "Global"
    default:
      return role || "Utilisateur"
  }
}

function RoleSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TooltipProvider>
      <div className="flex gap-2">
        {ROLE_OPTIONS.map((opt) => (
          <Tooltip key={opt.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  value === opt.value
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {opt.label}
                <Info className="h-3.5 w-3.5 opacity-50" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-xs">
              <p className="font-semibold mb-1">Privilèges — {opt.label}</p>
              <ul className="space-y-0.5 list-disc list-inside">
                {opt.privileges.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  direction: string;
  phoneNumber: string;
  role: string;
  region: string | null;
  isRegionalApprover?: boolean;
  isFinanceApprover?: boolean;
  accessModules: string;
  createdAt: string;
}

interface Region {
  id: number;
  name: string;
  villes: string[];
  createdAt: string;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    direction: "",
    phoneNumber: "",
    role: "comptabilite",
    region: "",
    isRegionalApprover: false,
    isFinanceApprover: false,
    accessModules: ["tableu"] as string[],
  });

  useEffect(() => {
    fetchUsers();
    fetchRegions();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Erreur de chargement");

      const data = await response.json();
      // Filtrer les comptes admin - un admin ne peut pas voir les autres admin
      const filteredData = data.filter((user: User) => user.role !== "admin");
      setUsers(filteredData);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les utilisateurs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRegions = async () => {
    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/regions`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Erreur de chargement des régions");

      const data = await response.json();
      setRegions(data);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les régions",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    // Validate phone number: must start with 0 and have exactly 10 digits
    if (!/^0\d{9}$/.test(formData.phoneNumber.trim())) {
      toast({
        title: "Erreur de validation",
        description: "Le numéro de téléphone doit commencer par 0 et contenir exactement 10 chiffres",
        variant: "destructive",
      });
      return;
    }

    // Validate region for regionale role
    if (formData.role === "regionale" && !formData.region) {
      toast({
        title: "Erreur de validation",
        description: "La région est obligatoire pour le rôle régionale",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("jwt");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          isRegionalApprover: formData.role === "regionale" ? formData.isRegionalApprover : false,
          isFinanceApprover: (formData.role === "finance" || formData.role === "comptabilite") ? formData.isFinanceApprover : false,
          accessModules: formData.accessModules.join(","),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la création");
      }

      toast({
        title: "Succès",
        description: "Utilisateur créé avec succès",
      });

      setIsCreateOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec de la création",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem("jwt");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const response = await fetch(`${API_BASE}/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          isRegionalApprover: formData.role === "regionale" ? formData.isRegionalApprover : false,
          isFinanceApprover: (formData.role === "finance" || formData.role === "comptabilite") ? formData.isFinanceApprover : false,
          accessModules: formData.accessModules.join(","),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la modification");
      }

      toast({
        title: "Succès",
        description: "Utilisateur modifié avec succès",
      });

      setIsEditOpen(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec de la modification",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;

    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la suppression");
      }

      toast({
        title: "Succès",
        description: "Utilisateur supprimé avec succès",
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec de la suppression",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (userId: number, userEmail: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir réinitialiser le mot de passe de ${userEmail} à "123456789" ?`)) return;

    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la réinitialisation");
      }

      toast({
        title: "Succès",
        description: "Mot de passe réinitialisé à 123456789",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec de la réinitialisation",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      direction: user.direction,
      phoneNumber: user.phoneNumber,
      role: user.role,
      region: user.region || "",
      isRegionalApprover: !!user.isRegionalApprover,
      isFinanceApprover: !!user.isFinanceApprover,
      accessModules: ["tableu"],
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      direction: "",
      phoneNumber: "",
      role: "comptabilite",
      region: "",
      isRegionalApprover: false,
      isFinanceApprover: false,
      accessModules: ["tableu"],
    });
    setShowPassword(false);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "comptabilite":
        return "default";
      case "regionale":
        return "secondary";
      case "direction":
        return "outline";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvel utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un utilisateur</DialogTitle>
              <DialogDescription>
                Remplissez tous les champs pour créer un nouveau compte
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direction">Direction *</Label>
                <Input
                  id="direction"
                  value={formData.direction}
                  onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Téléphone de service * (0XXXXXXXXX)</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="0XXXXXXXXX"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Rôle *</Label>
                <RoleSelector
                  value={formData.role}
                  onChange={(value) => setFormData({ ...formData, role: value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Accès aux modules *</Label>
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  Tableuité
                </div>
              </div>
              {formData.role === "regionale" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="region">Région *</Label>
                    <Select value={formData.region} onValueChange={(value) => setFormData({ ...formData, region: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une région" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRegionalApprover}
                      onChange={(e) => setFormData({ ...formData, isRegionalApprover: e.target.checked })}
                    />
                    Compte approbateur régional (peut approuver les tableus de la même région)
                  </label>
                </div>
              )}

              {(formData.role === "finance" || formData.role === "comptabilite") && (
                <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFinanceApprover}
                    onChange={(e) => setFormData({ ...formData, isFinanceApprover: e.target.checked })}
                  />
                  Compte approbateur finance (peut approuver les tableus du niveau Siège)
                </label>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table className="[&_th]:border-r [&_th]:border-border [&_td]:border-r [&_td]:border-border [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Région</TableHead>
              <TableHead>Approbateur</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.firstName} {user.lastName}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.direction}</TableCell>
                <TableCell>{user.phoneNumber}</TableCell>
                <TableCell>
                  <Badge className="bg-green-100 text-green-800">{getRoleLabel(user.role)}</Badge>
                </TableCell>
                <TableCell>{user.region || "-"}</TableCell>
                <TableCell>
                  {user.role === "regionale" || user.role === "finance" || user.role === "comptabilite" ? (
                    ((user.role === "regionale" && user.isRegionalApprover) ||
                    ((user.role === "finance" || user.role === "comptabilite") && user.isFinanceApprover)) ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Oui</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-700">Non</Badge>
                    )
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700">-</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {(user.accessModules || "tableu").split(",").map((m) => (
                      <Badge key={m} variant="outline" className="text-xs">
                        {m.trim() === "tableu" ? "Tableu" : m.trim()}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(user)}
                      disabled={user.email === "admin@test.com"}
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleResetPassword(user.id, user.email)}
                      disabled={user.email === "admin@test.com"}
                      title="Réinitialiser le mot de passe"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(user.id)}
                      disabled={user.email === "admin@test.com"}
                      title="Supprimer"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'utilisateur
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">Prénom</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Nom</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-direction">Direction</Label>
              <Input
                id="edit-direction"
                value={formData.direction}
                onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phoneNumber">Téléphone de service</Label>
              <Input
                id="edit-phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <RoleSelector
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Accès aux modules</Label>
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Tableuité
              </div>
            </div>
            {formData.role === "regionale" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-region">Région</Label>
                  <Select value={formData.region} onValueChange={(value) => setFormData({ ...formData, region: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une région" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.name}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isRegionalApprover}
                    onChange={(e) => setFormData({ ...formData, isRegionalApprover: e.target.checked })}
                  />
                  Compte approbateur régional
                </label>
              </div>
            )}

            {(formData.role === "finance" || formData.role === "comptabilite") && (
              <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFinanceApprover}
                  onChange={(e) => setFormData({ ...formData, isFinanceApprover: e.target.checked })}
                />
                Compte approbateur finance
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
