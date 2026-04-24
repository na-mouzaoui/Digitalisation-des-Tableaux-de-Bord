"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string;
  createdAt: string;
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("jwt");
      let url = `${API_BASE}/api/admin/audit-logs?`;
      const params = new URLSearchParams();

      if (actionFilter) params.append("action", actionFilter);
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);

      const response = await fetch(url + params.toString(), {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Erreur de chargement");

      const data = await response.json();
      setLogs(data);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le journal d'audit",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchLogs();
  };

  const handleResetFilters = () => {
    setActionFilter("");
    setFromDate("");
    setToDate("");
    setTimeout(() => fetchLogs(), 100);
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("CREATE")) return "default";
    if (action.includes("UPDATE")) return "secondary";
    if (action.includes("DELETE")) return "destructive";
    if (action.includes("PRINT")) return "outline";
    return "default";
  };

  const formatDetails = (details: string) => {
    try {
      const parsed = JSON.parse(details);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return details;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="space-y-2">
          <Label>Action</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              <SelectItem value="CREATE_BANK">Créer banque</SelectItem>
              <SelectItem value="UPDATE_BANK">Modifier banque</SelectItem>
              <SelectItem value="DELETE_BANK">Supprimer banque</SelectItem>
              <SelectItem value="CREATE_USER">Créer utilisateur</SelectItem>
              <SelectItem value="UPDATE_USER">Modifier utilisateur</SelectItem>
              <SelectItem value="DELETE_USER">Supprimer utilisateur</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date de début</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Date de fin</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={handleApplyFilters} className="flex-1">
            Filtrer
          </Button>
          <Button onClick={handleResetFilters} variant="outline">
            Réinitialiser
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>ID Entité</TableHead>
              <TableHead className="min-w-[300px]">Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune action enregistrée
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.userName}</span>
                      <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell>{log.entityId || "-"}</TableCell>
                  <TableCell>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
                      {formatDetails(log.details)}
                    </pre>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
