"use client"

import React from "react"
import { Check } from "lucide-react"
import { DomainKey } from "@/lib/tableau-domain-steps"
import { getDomainProgressSteps } from "@/lib/tableau-progress"

interface StepNavProps {
  domain: DomainKey
  currentTabKey?: string
  completedTabKeys?: Set<string>
}

type StepStatus = "completed" | "current" | "pending"

type PointStatus = StepStatus

const getProgressIndexes = (domain: DomainKey, currentTabKey?: string) => {
  const steps = getDomainProgressSteps(domain)
  const currentGroupIndex = currentTabKey
    ? steps.findIndex((step) => step.points.some((point) => point.key === currentTabKey))
    : -1

  const currentPointIndex =
    currentGroupIndex >= 0
      ? steps[currentGroupIndex].points.findIndex((point) => point.key === currentTabKey)
      : -1

  return { steps, currentGroupIndex, currentPointIndex }
}

const getStepStatus = (
  groupIndex: number,
  currentGroupIndex: number,
  completedTabKeys: Set<string>,
  stepKey: string
): StepStatus => {
  if (completedTabKeys.has(stepKey)) return "completed"
  if (groupIndex < currentGroupIndex) return "completed"
  if (groupIndex === currentGroupIndex) return "current"
  return "pending"
}

const getPointStatus = (
  groupIndex: number,
  pointIndex: number,
  currentGroupIndex: number,
  currentPointIndex: number,
  completedTabKeys: Set<string>,
  pointKey: string
): PointStatus => {
  if (completedTabKeys.has(pointKey)) return "completed"
  if (groupIndex < currentGroupIndex) return "completed"
  if (groupIndex === currentGroupIndex) {
    if (pointIndex < currentPointIndex) return "completed"
    if (pointIndex === currentPointIndex) return "current"
  }
  return "pending"
}

function ProgressContent({
  domain,
  currentTabKey,
  completedTabKeys = new Set(),
  compact = false,
}: StepNavProps & { compact?: boolean }) {
  const { steps, currentGroupIndex, currentPointIndex } = getProgressIndexes(domain, currentTabKey)

  const totalPoints = steps.reduce((count, step) => count + step.points.length, 0)
  const completedPoints = steps.reduce((count, step, groupIndex) => {
    if (groupIndex < currentGroupIndex) return count + step.points.length
    if (groupIndex === currentGroupIndex) return count + Math.max(currentPointIndex, 0)
    return count
  }, 0)
  const progressPercentage = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0

  return (
    <div className={compact ? "overflow-x-auto pb-2" : "space-y-4"}>
      <div className={compact ? "min-w-max space-y-4" : "space-y-4"}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Progression par onglet</h3>
            <p className="text-xs text-gray-500">1 step = 1 onglet, les points sont les tableaux de l’onglet.</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-800">{progressPercentage}%</div>
            <div className="text-xs text-gray-500">{completedPoints}/{totalPoints} tableaux</div>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className={compact ? "flex gap-3 min-w-max" : "space-y-3"}>
          {steps.map((step, groupIndex) => {
            const stepStatus = getStepStatus(groupIndex, currentGroupIndex, completedTabKeys, step.key)
            const isCurrentStep = groupIndex === currentGroupIndex

            return (
              <div
                key={step.key}
                className={compact ? "min-w-[320px] rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" : "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      stepStatus === "current"
                        ? "bg-blue-500 text-white ring-2 ring-blue-100"
                        : stepStatus === "completed"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {stepStatus === "completed" ? <Check size={14} /> : groupIndex + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            stepStatus === "current"
                              ? "text-blue-700"
                              : stepStatus === "completed"
                              ? "text-green-700"
                              : "text-gray-700"
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-gray-500">{step.points.length} tableau{step.points.length > 1 ? "x" : ""}</p>
                      </div>

                      {isCurrentStep && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                          Onglet actif
                        </span>
                      )}
                    </div>

                    <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
                      {step.points.map((point, pointIndex) => {
                        const pointStatus = getPointStatus(
                          groupIndex,
                          pointIndex,
                          currentGroupIndex,
                          currentPointIndex,
                          completedTabKeys,
                          point.key
                        )

                        return (
                          <div
                            key={point.key}
                            className={`flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors ${
                              pointStatus === "current"
                                ? "border-blue-200 bg-blue-50"
                                : pointStatus === "completed"
                                ? "border-green-200 bg-green-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <span
                              className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                                pointStatus === "current"
                                  ? "bg-blue-500"
                                  : pointStatus === "completed"
                                  ? "bg-green-500"
                                  : "bg-gray-400"
                              }`}
                            />
                            <div className="min-w-0">
                              <p
                                className={`text-xs font-semibold leading-snug ${
                                  pointStatus === "current"
                                    ? "text-blue-700"
                                    : pointStatus === "completed"
                                    ? "text-green-700"
                                    : "text-gray-700"
                                }`}
                              >
                                {point.label}
                              </p>
                              <p className="text-[11px] text-gray-500">Point {pointIndex + 1} / {step.points.length}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TableauStepNav({
  domain,
  currentTabKey,
  completedTabKeys = new Set(),
}: StepNavProps) {
  const { steps, currentGroupIndex, currentPointIndex } = getProgressIndexes(domain, currentTabKey)

  return (
    <div className="w-full">
      {/* Timeline horizontale centrée */}
      <div className="flex justify-center overflow-x-auto px-4 py-8">
        <div className="relative inline-flex items-center gap-8">
          {/* SVG pour la ligne de parcours */}
          <svg
            className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 pointer-events-none"
            style={{
              width: steps.length > 0 ? `calc((${steps.length} - 1) * 120px)` : "0",
            }}
          >
            <defs>
              <linearGradient id="timelineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: "#16a34a", stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: "#3b82f6", stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="0"
              stroke="url(#timelineGradient)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Cercles avec timeline */}
          {steps.map((step, groupIndex) => {
            const stepStatus = getStepStatus(groupIndex, currentGroupIndex, completedTabKeys, step.key)

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center gap-3">
                {/* Grand cercle pour l'onglet */}
                <div
                  className={`relative flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold transition-all flex-shrink-0 ${
                    stepStatus === "current"
                      ? "bg-blue-500 text-white ring-4 ring-blue-200 shadow-lg"
                      : stepStatus === "completed"
                      ? "bg-green-500 text-white shadow-md"
                      : "bg-gray-200 text-gray-600 shadow-sm"
                  }`}
                >
                  {stepStatus === "completed" ? <Check size={24} /> : groupIndex + 1}
                </div>

                {/* Nom de l'onglet */}
                <div className="text-center">
                  <p
                    className={`text-xs font-semibold leading-tight max-w-[90px] ${
                      stepStatus === "current"
                        ? "text-blue-700"
                        : stepStatus === "completed"
                        ? "text-green-700"
                        : "text-gray-600"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>

                {/* Points (tableaux) en dessous sans texte */}
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {step.points.map((point, pointIndex) => {
                    const pointStatus = getPointStatus(
                      groupIndex,
                      pointIndex,
                      currentGroupIndex,
                      currentPointIndex,
                      completedTabKeys,
                      point.key
                    )

                    return (
                      <div
                        key={point.key}
                        className={`h-2 w-2 rounded-full transition-all ${
                          pointStatus === "current"
                            ? "bg-blue-500 ring-1 ring-blue-300 scale-110"
                            : pointStatus === "completed"
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                        title={point.label}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TableauStepNavHorizontal({
  domain,
  currentTabKey,
  completedTabKeys = new Set(),
}: StepNavProps) {
  const { steps, currentGroupIndex, currentPointIndex } = getProgressIndexes(domain, currentTabKey)

  return (
    <div className="overflow-x-auto pb-6 relative">
      {/* Scroll horizontal d'onglets compacts avec ligne de parcours */}
      <div className="flex gap-4 min-w-max px-4 relative">
        {/* SVG pour la ligne de parcours */}
        <svg
          className="absolute top-7 left-0 w-full h-6 pointer-events-none"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="completedGradientHorizontal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "#16a34a", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "#3b82f6", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path
            d={generatePathForStepsHorizontal(steps.length)}
            stroke="url(#completedGradientHorizontal)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {steps.map((step, groupIndex) => {
          const stepStatus = getStepStatus(groupIndex, currentGroupIndex, completedTabKeys, step.key)

          return (
            <div key={step.key} className="flex flex-col items-center gap-2 relative z-10">
              {/* Grand cercle pour l'onglet */}
              <div
                className={`relative flex h-14 w-14 items-center justify-center rounded-full text-base font-bold transition-all flex-shrink-0 ${
                  stepStatus === "current"
                    ? "bg-blue-500 text-white ring-4 ring-blue-200 shadow-lg"
                    : stepStatus === "completed"
                    ? "bg-green-500 text-white shadow-md"
                    : "bg-gray-200 text-gray-600 shadow-sm"
                }`}
              >
                {stepStatus === "completed" ? <Check size={20} /> : groupIndex + 1}
              </div>

              {/* Nom de l'onglet */}
              <p
                className={`text-xs font-semibold text-center leading-tight max-w-[70px] ${
                  stepStatus === "current"
                    ? "text-blue-700"
                    : stepStatus === "completed"
                    ? "text-green-700"
                    : "text-gray-600"
                }`}
              >
                {step.label}
              </p>

              {/* Points (tableaux) */}
              <div className="flex flex-wrap gap-1 justify-center">
                {step.points.map((point, pointIndex) => {
                  const pointStatus = getPointStatus(
                    groupIndex,
                    pointIndex,
                    currentGroupIndex,
                    currentPointIndex,
                    completedTabKeys,
                    point.key
                  )

                  return (
                    <div
                      key={point.key}
                      className={`h-2 w-2 rounded-full transition-all ${
                        pointStatus === "current"
                          ? "bg-blue-500 ring-1 ring-blue-300 scale-110"
                          : pointStatus === "completed"
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                      title={point.label}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function generatePathForStepsHorizontal(count: number): string {
  // Pour la version horizontale, créer une ligne droite qui relie tous les cercles
  const circleRadius = 28 // h-14 = 56px, rayon = 28
  const gap = 16 // gap-4 = 16px
  const spacing = circleRadius * 2 + gap
  
  let path = `M ${spacing / 2} 12`
  
  for (let i = 1; i < count; i++) {
    const x = (i * spacing) + spacing / 2
    path += ` L ${x} 12`
  }
  
  return path
}
