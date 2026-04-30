"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TableauStepNav, TableauStepNavHorizontal } from "@/components/tableau-step-nav"
import { DomainKey } from "@/lib/tableau-domain-steps"
import { ChevronLeft } from "lucide-react"

interface TableauHeaderProps {
  title: string
  domain: DomainKey
  currentTabKey?: string
  completedTabKeys?: Set<string>
  mois?: string
  annee?: string
  onBackClick?: () => void
  layout?: "vertical" | "horizontal"
}

export function TableauHeader({
  title,
  domain,
  currentTabKey,
  completedTabKeys = new Set(),
  mois,
  annee,
  onBackClick,
  layout = "vertical",
}: TableauHeaderProps) {
  return (
    <div className="space-y-4 mb-6">
      {/* En-tête avec titre et bouton retour */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {mois && annee && (
            <p className="text-sm text-gray-600 mt-1">
              Période: <span className="font-semibold">{mois}/{annee}</span>
            </p>
          )}
        </div>
        {onBackClick && (
          <Button variant="outline" onClick={onBackClick} className="gap-2">
            <ChevronLeft size={16} />
            Retour Dashboard
          </Button>
        )}
      </div>

      {/* Carte de progression */}
      <Card className="border-blue-100 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progression de saisie</CardTitle>
        </CardHeader>
        <CardContent>
          {layout === "horizontal" ? (
            <TableauStepNavHorizontal
              domain={domain}
              currentTabKey={currentTabKey}
              completedTabKeys={completedTabKeys}
            />
          ) : (
            <TableauStepNav
              domain={domain}
              currentTabKey={currentTabKey}
              completedTabKeys={completedTabKeys}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
