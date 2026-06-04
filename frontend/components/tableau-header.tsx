"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { TableauStepNav } from "@/components/tableau-step-nav"
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
  onStepClick?: (pointKey: string) => void
  layout?: "vertical" | "horizontal"
  allowedSousDomaines?: number[]
}

export function TableauHeader({
  title,
  domain,
  currentTabKey,
  completedTabKeys = new Set(),
  mois,
  annee,
  onBackClick,
  onStepClick,
  layout = "vertical",
  allowedSousDomaines,
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

      {/* Conteneur de progression transparent */}
      <div className="w-full bg-transparent">
        <TableauStepNav
          domain={domain}
          currentTabKey={currentTabKey}
          completedTabKeys={completedTabKeys}
          onStepClick={onStepClick}
          allowedSousDomaines={allowedSousDomaines}
        />
      </div>
    </div>
  )
}
