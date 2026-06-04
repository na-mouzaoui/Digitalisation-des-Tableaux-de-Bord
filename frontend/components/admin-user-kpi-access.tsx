"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/config";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

interface KpiItem {
  id: number;
  name: string;
  rows: { id: number; designation: string; order: number }[];
}

interface SousDomaineItem {
  id: number;
  designation: string;
  kpis: KpiItem[];
}

interface DomaineItem {
  id: number;
  designation: string;
  sousDomaines: SousDomaineItem[];
}

interface AdminUserKpiAccessProps {
  allowedKpiIds: number[];
  allowedDomaineIds: number[];
  allowedSousDomaineIds: number[];
  onAllowedKpiIdsChange: (ids: number[]) => void;
  onAllowedDomaineIdsChange: (ids: number[]) => void;
  onAllowedSousDomaineIdsChange: (ids: number[]) => void;
}

type CheckState = boolean | "indeterminate";

export default function AdminUserKpiAccess({
  allowedKpiIds,
  allowedDomaineIds,
  allowedSousDomaineIds,
  onAllowedKpiIdsChange,
  onAllowedDomaineIdsChange,
  onAllowedSousDomaineIdsChange,
}: AdminUserKpiAccessProps) {
  const [hierarchy, setHierarchy] = useState<DomaineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDomaines, setExpandedDomaines] = useState<Set<number>>(new Set());
  const [expandedSousDomaines, setExpandedSousDomaines] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchHierarchy();
  }, []);

  const fetchHierarchy = async () => {
    try {
      const token = localStorage.getItem("jwt");
      const response = await fetch(`${API_BASE}/api/admin/hierarchy`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Erreur de chargement");
      const data = await response.json();
      setHierarchy(data);
    } catch (error) {
      console.error("Failed to load hierarchy", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleKpi = (kpiId: number) => {
    const newSet = allowedKpiIds.includes(kpiId)
      ? allowedKpiIds.filter((id) => id !== kpiId)
      : [...allowedKpiIds, kpiId];
    onAllowedKpiIdsChange(newSet);
  };

  const toggleSousDomaine = (sd: SousDomaineItem) => {
    const sdKpiIds = sd.kpis.map((k) => k.id);
    const allChecked = sdKpiIds.every((id) => allowedKpiIds.includes(id));
    if (allChecked) {
      onAllowedKpiIdsChange(allowedKpiIds.filter((id) => !sdKpiIds.includes(id)));
    } else {
      const existing = new Set(allowedKpiIds);
      sdKpiIds.forEach((id) => existing.add(id));
      onAllowedKpiIdsChange(Array.from(existing));
    }
  };

  const toggleDomaine = (d: DomaineItem) => {
    const allKpiIds = d.sousDomaines.flatMap((sd) => sd.kpis.map((k) => k.id));
    const allChecked = allKpiIds.every((id) => allowedKpiIds.includes(id));
    if (allChecked) {
      onAllowedKpiIdsChange(allowedKpiIds.filter((id) => !allKpiIds.includes(id)));
    } else {
      const existing = new Set(allowedKpiIds);
      allKpiIds.forEach((id) => existing.add(id));
      onAllowedKpiIdsChange(Array.from(existing));
    }
  };

  const computeCheckState = (ids: number[]): CheckState => {
    const checkedCount = ids.filter((id) => allowedKpiIds.includes(id)).length;
    if (checkedCount === 0) return false;
    if (checkedCount === ids.length) return true;
    return "indeterminate";
  };

  const getSousDomaineKpiIds = (sd: SousDomaineItem): number[] =>
    sd.kpis.map((k) => k.id);

  const getDomaineKpiIds = (d: DomaineItem): number[] =>
    d.sousDomaines.flatMap((sd) => getSousDomaineKpiIds(sd));

  const getAccessibleCount = (ids: number[]): number =>
    ids.filter((id) => allowedKpiIds.includes(id)).length;

  if (loading) {
    return <div className="text-sm text-muted-foreground py-2">Chargement de la hiérarchie...</div>;
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Accès aux tableaux (KPI)</label>
      <div className="rounded-md border p-3 space-y-1 max-h-64 overflow-y-auto">
        {hierarchy.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun domaine trouvé</p>
        ) : (
          hierarchy.map((domaine) => {
            const allKpiIds = getDomaineKpiIds(domaine);
            const accessibleCount = getAccessibleCount(allKpiIds);
            const domaineCheckState = computeCheckState(allKpiIds);
            const isDomaineExpanded = expandedDomaines.has(domaine.id);

            return (
              <Collapsible
                key={domaine.id}
                open={isDomaineExpanded}
                onOpenChange={(open) => {
                  const newSet = new Set(expandedDomaines);
                  if (open) newSet.add(domaine.id);
                  else newSet.delete(domaine.id);
                  setExpandedDomaines(newSet);
                }}
              >
                <div className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={domaineCheckState}
                    onCheckedChange={() => toggleDomaine(domaine)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4"
                  />
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 flex-1 cursor-pointer">
                      {isDomaineExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <span className={`flex-1 text-left ${domaineCheckState === false ? "text-muted-foreground" : ""}`}>
                        {domaine.designation}
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <span className="text-xs text-muted-foreground">
                    {accessibleCount}/{allKpiIds.length}
                  </span>
                  {domaineCheckState !== true && domaineCheckState !== false && (
                    <Info className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
                <CollapsibleContent className="ml-4 space-y-1 border-l pl-3">
                  {domaine.sousDomaines.map((sd) => {
                    const sdKpiIds = getSousDomaineKpiIds(sd);
                    const sdCheckState = computeCheckState(sdKpiIds);
                    const isSdExpanded = expandedSousDomaines.has(sd.id);

                    return (
                      <Collapsible
                        key={sd.id}
                        open={isSdExpanded}
                        onOpenChange={(open) => {
                          const newSet = new Set(expandedSousDomaines);
                          if (open) newSet.add(sd.id);
                          else newSet.delete(sd.id);
                          setExpandedSousDomaines(newSet);
                        }}
                      >
                        <div className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs font-medium hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={sdCheckState}
                            onCheckedChange={() => toggleSousDomaine(sd)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-3.5 w-3.5"
                          />
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-2 flex-1 cursor-pointer">
                              {isSdExpanded ? (
                                <ChevronDown className="h-3 w-3 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0" />
                              )}
                              <span className={`flex-1 text-left ${sdCheckState === false ? "text-muted-foreground" : ""}`}>
                                {sd.designation}
                              </span>
                            </div>
                          </CollapsibleTrigger>
                          <span className="text-xs text-muted-foreground">
                            {sdKpiIds.filter((id) => allowedKpiIds.includes(id)).length}/{sdKpiIds.length}
                          </span>
                        </div>
                        <CollapsibleContent className="ml-4 space-y-0.5">
                          {sd.kpis.map((kpi) => {
                            const isAllowed = allowedKpiIds.includes(kpi.id);
                            return (
                              <label
                                key={kpi.id}
                                className={`flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer ${
                                  isAllowed
                                    ? "hover:bg-muted/50"
                                    : "text-muted-foreground"
                                }`}
                              >
                                <Checkbox
                                  checked={isAllowed}
                                  onCheckedChange={() => toggleKpi(kpi.id)}
                                  className="h-3.5 w-3.5"
                                />
                                <span>{kpi.name.replace(/_/g, " ")}</span>
                              </label>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </div>
    </div>
  );
}
