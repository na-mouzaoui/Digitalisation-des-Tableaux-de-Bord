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
import { Pencil, Trash2, Plus, Eye, EyeOff, KeyRound, Info, Upload, Download, FolderTree } from "lucide-react";
import AdminUserKpiAccess from "@/components/admin-user-kpi-access";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as XLSX from "xlsx";

const ROLE_OPTIONS = [
  {
    value: "utilisateur",
    label: "Utilisateur",
    privileges: [
      "Accés aux fonctionnalités de base",
      "Gestion de ses propres tableaux",
      "Consultation des tableaux siége",
    ],
  },
  {
    value: "directeur",
    label: "Directeur",
    privileges: [
      "Accés complet é toutes les directions",
      "Consultation de tous les tableaux",
      "Supervision des workflows",
    ],
  },
  {
    value: "divisionnaire",
    label: "Divisionnaire",
    privileges: [
      "Accés limité é sa région/division assignée",
      "Consultation de sa région/division",
      "Validation des tableaux de sa région/division",
    ],
  },
];

const getRoleLabel = (role: string) => {
  switch ((role ?? "").trim().toLowerCase()) {
    case "admin":
      return "Admin"
    case "utilisateur":
      return "Utilisateur"
    case "divisionnaire":
      return "Divisionnaire"
    case "directeur":
      return "Directeur"
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
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${value === opt.value
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
              >
                {opt.label}
                <Info className="h-3.5 w-3.5 opacity-50" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-xs">
              <p className="font-semibold mb-1">Priviléges - {opt.label}</p>
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
  region?: string;
  allowedKpiIds?: number[];
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
    role: "utilisateur",
    region: "",
    allowedKpiIds: [] as number[],
  });

  useEffect(() => {
    fetchUsers();
    fetchRegions();
  }, []);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState("");

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

      const mapped = json.map((row: any) => ({
        Nom: row["nom"] || row["Nom"] || "",
        Prenom: row["prenom"] || row["Prenom"] || "",
        Email: row["adresse mail"] || row["Adresse mail"] || row["email"] || row["Email"] || "",
        Direction: row["direction"] || row["Direction"] || "",
        Tel: row["tel"] || row["Tel"] || row["téléphone"] || row["Téléphone"] || "",
        Role: (row["role"] || row["Role"] || "").toString().toLowerCase(),
      }));
      setImportData(mapped);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const headers = ["Nom", "Prenom", "Adresse mail", "Direction", "Tel", "Role"];
    const example = ["Dupont", "Jean", "jean.dupont@email.com", "Commerciale", "0550123456", "utilisateur"];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const colWidths = headers.map((h) => ({ wch: Math.max(h.length, 20) }));
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Utilisateurs");
    XLSX.writeFile(wb, "modele_import_utilisateurs.xlsx");
  };

  const confirmImport = async () => {
    if (importData.length === 0) return;
    const mappedData = importData.map((u) => ({
      ...u,
      Role: mapRoleForImport(u.Role),
    }));
    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/admin/users/import`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(mappedData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Erreur lors de l'import");
      }
      const result = await response.json();
      toast({
        title: "Succés",
        description: result.message + (result.errors ? ` (${result.errors.length} erreur(s))` : ""),
      });
      setIsImportOpen(false);
      setImportData([]);
      setImportFileName("");
      fetchUsers();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "échec de l'import",
        variant: "destructive",
      });
    }
  };

  const mapRoleForImport = (role: string): string => {
    const roleMap: Record<string, string> = {
      "utilisateur": "utilisateur",
      "par défaut": "utilisateur",
      "default": "utilisateur",
      "directeur": "directeur",
      "director": "directeur",
      "divisionnaire": "divisionnaire",
      "divisional": "divisionnaire",
    };
    return roleMap[role.trim().toLowerCase()] || "utilisateur";
  };

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

    // Validate region for divisionnaire role
    if (formData.role === "divisionnaire" && !formData.region) {
      toast({
        title: "Erreur de validation",
        description: "La région est obligatoire pour le role régionale",
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
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la création");
      }

      toast({
        title: "Succés",
        description: "Utilisateur créé avec succés",
      });

      setIsCreateOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "échec de la création",
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
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la modification");
      }

      toast({
        title: "Succés",
        description: "Utilisateur modifié avec succés",
      });

      setIsEditOpen(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "échec de la modification",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm("étes-vous sér de vouloir supprimer cet utilisateur ?")) return;

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
        title: "Succés",
        description: "Utilisateur supprimé avec succés",
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "échec de la suppression",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (userId: number, userEmail: string) => {
    if (!confirm(`étes-vous sér de vouloir réinitialiser le mot de passe de ${userEmail} é "123456789" ?`)) return;

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
        title: "Succés",
        description: "Mot de passe réinitialisé é 123456789",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "échec de la réinitialisation",
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
      allowedKpiIds: user.allowedKpiIds ?? [],
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
      role: "utilisateur",
      region: "",
      allowedKpiIds: [],
    });
    setShowPassword(false);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "utilisateur":
        return "default";
      case "divisionnaire":
        return "secondary";
      case "directeur":
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
      <div className="flex justify-end gap-2">
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Importer Excel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importer des utilisateurs depuis Excel</DialogTitle>
              <DialogDescription>
                Sélectionnez un fichier Excel (.xlsx) avec les colonnes: Nom, Prenom, Adresse mail, Direction, Tel, Role
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <Input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="flex-1" />
                <Button type="button" variant="outline" size="icon" onClick={handleDownloadTemplate} title="Télécharger le modèle Excel">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              {importFileName && (
                <p className="text-sm text-muted-foreground">Fichier: {importFileName}</p>
              )}
              {importData.length > 0 && (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Nom</th>
                        <th className="p-2 text-left">Prénom</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-left">Direction</th>
                        <th className="p-2 text-left">Tél</th>
                        <th className="p-2 text-left">Rôle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importData.slice(0, 50).map((u, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{u.Nom}</td>
                          <td className="p-2">{u.Prenom}</td>
                          <td className="p-2">{u.Email}</td>
                          <td className="p-2">{u.Direction}</td>
                          <td className="p-2">{u.Tel}</td>
                          <td className="p-2">{mapRoleForImport(u.Role)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importData.length > 50 && (
                    <p className="p-2 text-sm text-muted-foreground">
                      ...et {importData.length - 50} autre(s)
                    </p>
                  )}
                  <p className="p-2 text-sm font-medium">
                    Total: {importData.length} utilisateur(s)
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsImportOpen(false); setImportData([]); setImportFileName(""); }}>
                Annuler
              </Button>
              <Button onClick={confirmImport} disabled={importData.length === 0}>
                Importer {importData.length > 0 ? `(${importData.length})` : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                <Label>role *</Label>
                <RoleSelector
                  value={formData.role}
                  onChange={(value) => setFormData({ ...formData, role: value })}
                />
              </div>
              {formData.role === "divisionnaire" && (
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
              )}
              <div className="space-y-2">
                <AdminUserKpiAccess
                  allowedKpiIds={formData.allowedKpiIds}
                  onAllowedKpiIdsChange={(ids) => setFormData({ ...formData, allowedKpiIds: ids })}
                />
              </div>
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
              <Label>role</Label>
              <RoleSelector
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value })}
              />
            </div>
            {formData.role === "divisionnaire" && (
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
            )}
            <div className="space-y-2">
              <AdminUserKpiAccess
                allowedKpiIds={formData.allowedKpiIds}
                onAllowedKpiIdsChange={(ids) => setFormData({ ...formData, allowedKpiIds: ids })}
              />
            </div>
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
