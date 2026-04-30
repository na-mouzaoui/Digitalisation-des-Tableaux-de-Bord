"use client"

import React from "react"
import { Check, ChevronRight } from "lucide-react"
import { DOMAIN_STEPS, DomainKey } from "@/lib/tableau-domain-steps"

interface StepNavProps {
  domain: DomainKey
  currentTabKey?: string
  completedTabKeys?: Set<string>
}

export function TableauStepNav({
  domain,
  currentTabKey,
  completedTabKeys = new Set(),
}: StepNavProps) {
  const steps = DOMAIN_STEPS[domain]
  const currentIndex = steps.findIndex((step) => step.key === currentTabKey)

  const getStepStatus = (tabKey: string, index: number) => {
    if (index === currentIndex) return "current"
    if (completedTabKeys.has(tabKey)) return "completed"
    if (index < currentIndex) return "completed"
    return "pending"
  }

  const completedCount = steps.filter((step) => completedTabKeys.has(step.key)).length
  const progressPercentage = Math.round((completedCount / Math.max(steps.length - 1, 1)) * 100)

  return (
    <div className="space-y-3">
      {/* Titre et pourcentage */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Progression du domaine</h3>
        <span className="text-xs font-medium text-gray-600">{progressPercentage}%</span>
      </div>

      {/* Barre de progression */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Liste des étapes */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const status = getStepStatus(step.key, index)
          const isClickable = status === "completed" || status === "current"

          return (
            <div key={step.key} className="flex items-center gap-3">
              {/* Numéro du step */}
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${
                  status === "current"
                    ? "bg-blue-500 text-white ring-2 ring-blue-200"
                    : status === "completed"
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {status === "completed" ? <Check size={14} /> : index + 1}
              </div>

              {/* Label du step */}
              <span
                className={`text-sm flex-1 ${
                  status === "current"
                    ? "font-semibold text-blue-700"
                    : status === "completed"
                    ? "font-medium text-green-700"
                    : "text-gray-500"
                }`}
              >
                {step.label}
              </span>

              {/* Chevron pour le dernier step complété */}
              {index < steps.length - 1 && status === "completed" && (
                <ChevronRight size={16} className="text-green-400" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Composant pour afficher une progression linéaire horizontale avec labels
 */
export function TableauStepNavHorizontal({
  domain,
  currentTabKey,
  completedTabKeys = new Set(),
}: StepNavProps) {
  const steps = DOMAIN_STEPS[domain]
  const currentIndex = steps.findIndex((step) => step.key === currentTabKey)

  const getStepStatus = (tabKey: string, index: number) => {
    if (index === currentIndex) return "current"
    if (completedTabKeys.has(tabKey)) return "completed"
    if (index < currentIndex) return "completed"
    return "pending"
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-stretch gap-3 min-w-max">
        {steps.map((step, index) => {
          const status = getStepStatus(step.key, index)

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-2">
                {/* Cercle avec numéro ou checkmark */}
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${
                    status === "current"
                      ? "bg-blue-500 text-white ring-2 ring-blue-200"
                      : status === "completed"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                  title={step.label}
                >
                  {status === "completed" ? <Check size={18} /> : index + 1}
                </div>
                {/* Label de l'étape */}
                <span
                  className={`text-xs font-semibold text-center max-w-[80px] leading-tight ${
                    status === "current"
                      ? "text-blue-700"
                      : status === "completed"
                      ? "text-green-700"
                      : "text-gray-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Ligne de connexion */}
              {index < steps.length - 1 && (
                <div className={`flex items-center self-start mt-5 h-0.5 w-4 ${status === "completed" ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
