"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Filter, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_BASE } from "@/lib/config";

interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
}

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  direction: string;
  phoneNumber: string;
  role: string;
  region: string;
}

const actionLabels: Record<string, string> = {
  // Banques
  CREATE_BANK: "Ajout d'une banque",
  UPDATE_BANK: "Modification d'une banque",
  DELETE_BANK: "Suppression d'une banque",
  
  // RÃ©gions
  CREATE_REGION: "Ajout d'une rÃ©gion",
  UPDATE_REGION: "Modification d'une rÃ©gion",
  DELETE_REGION: "Suppression d'une rÃ©gion",
  
  // Utilisateurs
  CREATE_USER: "Ajout d'un utilisateur",
  UPDATE_USER: "Modification d'un utilisateur",
  DELETE_USER: "Suppression d'un utilisateur",
  RESET_PASSWORD: "RÃ©initialiser le mot de passe d'un utilisateur",
  
  // Tableaux
  TABLEU_SAVE: "Enregistrement d'un tableu",
  TABLEU_APPROVE: "Approuver un tableu",
  TABLEU_DELETE: "Suppression d'un tableu",
  TABLEU_PRINT: "Exporter un tableu en PDF",
  CREATE_TABLEU: "Ajout d'un tableu",
  UPDATE_TABLEU: "Modification d'un tableu",
  DELETE_TABLEU: "Suppression d'un tableu",
  SUBMIT_TABLEU: "Soumettre un tableu",
  APPROVE_TABLEU: "Approuver un tableu",
  REJECT_TABLEU: "Rejeter un tableu",
  EXPORT_TABLEU: "Exporter un tableu en PDF",

  // Tableaux Ã©tendus
  CREATE_TABLEU_TABLEU: "Ajout d'un tableu Ã©tendu",
  UPDATE_TABLEU_TABLEU: "Modification d'un tableu Ã©tendu",
  DELETE_TABLEU_TABLEU: "Suppression d'un tableu Ã©tendu",
  LOCK_PERIOD: "Verrouiller une pÃ©riode",
  UNLOCK_PERIOD: "DÃ©verrouiller une pÃ©riode",

  // ParamÃ¨tres tableuux
  UPDATE_TABLEU_SETTING: "Activer / dÃ©sactiver le Tableau 6",
  
  // GÃ©nÃ©riques (fallback)
  CREATE: "CrÃ©ation",
  UPDATE: "Modification",
  DELETE: "Suppression"
};

const actionGroups: Record<string, string[]> = {
  "Banques": ["CREATE_BANK", "UPDATE_BANK", "DELETE_BANK"],
  "RÃ©gions": ["CREATE_REGION", "UPDATE_REGION", "DELETE_REGION"],
  "Utilisateurs": ["CREATE_USER", "UPDATE_USER", "DELETE_USER", "RESET_PASSWORD"],
  "Tableaux": ["TABLEU_SAVE", "TABLEU_APPROVE", "TABLEU_DELETE", "TABLEU_PRINT"],
  "ParamÃ¨tres tableuux": ["UPDATE_TABLEU_SETTING"]
};

const fieldLabels: Record<string, string> = {
  // Champs communs
  id: "ID",
  name: "Nom",
  code: "Code",
  createdAt: "CrÃ©Ã© le",
  updatedAt: "ModifiÃ© le",
  
  // Banques
  bankId: "Banque",
  bankName: "Nom de la banque",
  bankCode: "Code de la banque",
  
  // RÃ©gions
  regionId: "RÃ©gion",
  regionName: "Nom de la rÃ©gion",
  regionCode: "Code de la rÃ©gion",
  wilayaId: "Wilaya",
  wilayaName: "Wilaya",
  wilayaCode: "Code Wilaya",
  ville: "Ville",
  
  // Tableaux
  tableuId: "Tableu",
  direction: "Direction",
  mois: "Mois",
  annee: "AnnÃ©e",
  period: "PÃ©riode",
  tableuStatus: "Statut du tableu",
  settingName: "ParamÃ¨tre",
  oldValue: "Ancienne valeur",
  newValue: "Nouvelle valeur",
  
  // RÃ©capitulatifs TVA
  recapId: "RÃ©capitulatif",
  tvaType: "Type de TVA",
  totalBase: "Base totale",
  totalAmount: "Montant total",
  
  // Tableaux Ã©tendus
  tableuTableuId: "Tableu Ã©tendu",
  tableuYear: "AnnÃ©e tableue",
  tableuStatus: "Statut tableu",
  
  // Calibrage
  x: "Position X",
  y: "Position Y",
  fontSize: "Taille de police",
  fontFamily: "Police",
  
  // Utilisateurs
  userId: "Utilisateur",
  username: "Nom d'utilisateur",
  fullName: "Nom complet",
  role: "RÃ´le",
  password: "Mot de passe",
  UserEmail: "Email utilisateur",
  NewPassword: "Nouveau mot de passe",
  oldValues: "Anciennes valeurs",
  newValues: "Nouvelles valeurs",
  
  // Autres
  description: "Description",
  notes: "Notes",
  reason: "Raison",
  comment: "Commentaire"
};

const getActionLabel = (action: string): string => {
  const explicit = actionLabels[action];
  if (explicit) return explicit;

  // Fallback lisible en franÃ§ais pour les actions non mappÃ©es
  return action
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .join(" ");
};

const getActionBadgeClass = (action: string) => {
  const normalized = action.toUpperCase();

  if (normalized.includes("DELETE") || normalized.includes("REMOVE") || normalized.includes("SUPPR")) {
    return "bg-red-100 text-red-800";
  }

  if (normalized.includes("CREATE") || normalized.includes("ADD") || normalized.includes("AJOUT") || normalized.includes("SAVE") || normalized.includes("ENREG")) {
    return "bg-green-100 text-green-800";
  }

  if (normalized.includes("UPDATE") || normalized.includes("EDIT") || normalized.includes("MODIF")) {
    return "bg-blue-100 text-blue-800";
  }

  return "bg-gray-100 text-gray-800";
};

type SortField = 'action' | 'userName' | 'createdAt' | 'details';
type SortOrder = 'asc' | 'desc';

export default function AdminAuditLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // Filtres
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Tri
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    loadUsers();
    loadLogs();
  }, [selectedUser, selectedAction, dateFrom, dateTo]);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Erreur lors du chargement des utilisateurs");

      const data = await response.json();
      setUsers(data);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUser !== "all") params.append("userId", selectedUser);
      if (selectedAction !== "all") params.append("action", selectedAction);
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);

      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/admin/audit-logs?${params.toString()}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Erreur lors du chargement des logs");

      const data = await response.json();
      setLogs(data);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedLogs = [...logs].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'action':
        aValue = getActionLabel(a.action);
        bValue = getActionLabel(b.action);
        break;
      case 'userName':
        aValue = a.userName || '';
        bValue = b.userName || '';
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'details':
        aValue = a.details || '';
        bValue = b.details || '';
        break;
      default:
        aValue = new Date(b.createdAt).getTime();
        bValue = new Date(a.createdAt).getTime();
    }

    if (typeof aValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc'
        ? aValue - bValue
        : bValue - aValue;
    }
  });

  const filteredLogs = sortedLogs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      getActionLabel(log.action).toLowerCase().includes(search.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const handleReset = () => {
    setSelectedUser("all");
    setSelectedAction("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailsDialog(true);
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  const formatDetailValue = (value: any): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const translateFieldName = (fieldName: string): string => {
    return fieldLabels[fieldName] || fieldName;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" style={{ color: '#e82c2a' }} />
          {showFilters ? "Masquer" : "Filtres"}
        </Button>
      </div>

      {showFilters && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <h3 className="mb-4 text-sm font-semibold">Filtres AvancÃ©s</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Utilisateur</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les utilisateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.firstName} {user.lastName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Action</Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les actions" />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  <SelectItem value="all">Toutes les actions</SelectItem>
                  {Object.entries(actionGroups).map(([groupName, groupActions]) => (
                    <div key={groupName}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {groupName}
                      </div>
                      {groupActions.map(action => (
                        <SelectItem key={action} value={action} className="pl-6">
                          {getActionLabel(action)}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Date dÃ©but</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <Label>Date fin</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleReset} variant="outline" size="sm">
              RÃ©initialiser
            </Button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: '#e82c2a' }} />
        <Input
          placeholder="Rechercher par utilisateur, action ou dÃ©tails..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucun log trouvÃ©
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('action')} className="h-8 p-0 font-semibold hover:underline">
                    Action
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('userName')} className="h-8 p-0 font-semibold hover:underline">
                    Utilisateur
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('createdAt')} className="h-8 p-0 font-semibold hover:underline">
                    Fait le
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('details')} className="h-8 p-0 font-semibold hover:underline">
                    DÃ©tails
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map(log => {
                const timestamp = new Date(log.createdAt);
                const isValidDate = !isNaN(timestamp.getTime());
                const parsedDetails = parseDetails(log.details);
                
                return (
                <TableRow 
                  key={log.id} 
                  onClick={() => handleViewDetails(log)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getActionBadgeClass(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </TableCell>
                  <TableCell>{log.userName}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {isValidDate ? format(timestamp, "dd/MM/yyyy HH:mm:ss", { locale: fr }) : log.createdAt}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {parsedDetails && typeof parsedDetails === 'object' ? (
                      <div className="space-y-1">
                        {Object.entries(parsedDetails).slice(0, 2).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium text-muted-foreground">{translateFieldName(key)}: </span>
                            <span className="truncate">{formatDetailValue(value)}</span>
                          </div>
                        ))}
                        {Object.keys(parsedDetails).length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{Object.keys(parsedDetails).length - 2} autre{Object.keys(parsedDetails).length - 2 > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="truncate">
                        {log.details || "-"}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Statistiques */}
      <div className="text-sm text-muted-foreground">
        Total: {filteredLogs.length} entrÃ©e{filteredLogs.length > 1 ? "s" : ""}
      </div>

      {/* Dialog dÃ©tails */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>DÃ©tails de l'action</DialogTitle>
            <DialogDescription>
              Informations complÃ¨tes sur cette action d'audit
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">Action</Label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getActionBadgeClass(selectedLog.action)}`}>
                      {getActionLabel(selectedLog.action)}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">Utilisateur</Label>
                  <p className="mt-1">{selectedLog.userName}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">Date et heure</Label>
                  <p className="mt-1">
                    {(() => {
                      const timestamp = new Date(selectedLog.createdAt);
                      const isValidDate = !isNaN(timestamp.getTime());
                      return isValidDate ? format(timestamp, "dd MMMM yyyy 'Ã ' HH:mm:ss", { locale: fr }) : selectedLog.createdAt;
                    })()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">Type d'entitÃ©</Label>
                  <p className="mt-1">{selectedLog.entityType || "-"}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold text-muted-foreground">DÃ©tails complets</Label>
                <div className="mt-1 p-3 bg-muted rounded-md max-h-96 overflow-y-auto">
                  {(() => {
                    const parsedDetails = parseDetails(selectedLog.details);
                    
                    if (!parsedDetails) {
                      return <p className="text-sm text-muted-foreground">Aucun dÃ©tail disponible</p>;
                    }
                    
                    if (typeof parsedDetails === 'object' && parsedDetails !== null) {
                      return (
                        <div className="space-y-3">
                          {Object.entries(parsedDetails).map(([key, value]) => (
                            <div key={key} className="border-b border-border/50 pb-2 last:border-0">
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                {translateFieldName(key)}
                              </div>
                              <div className="text-sm">
                                {typeof value === 'object' ? (
                                  <pre className="text-xs whitespace-pre-wrap break-words bg-background p-2 rounded">
                                    {JSON.stringify(value, null, 2)}
                                  </pre>
                                ) : (
                                  <span>{formatDetailValue(value)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    
                    return (
                      <pre className="text-sm whitespace-pre-wrap break-words">
                        {selectedLog.details}
                      </pre>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
