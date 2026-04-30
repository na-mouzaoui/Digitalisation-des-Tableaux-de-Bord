"use client"

import { useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { getNextStepPath, DomainKey } from "@/lib/tableau-domain-steps"

export function useTableauStepNavigation(domain: DomainKey) {
  const searchParams = useSearchParams()

  const getCurrentTabKey = useCallback(() => {
    return searchParams.get("tab") || undefined
  }, [searchParams])

  const getMoisAnnee = useCallback(
    () => ({
      mois: searchParams.get("mois") || undefined,
      annee: searchParams.get("annee") || undefined,
    }),
    [searchParams]
  )

  const navigateToNextStep = useCallback((currentTabKey?: string, mois?: string, annee?: string) => {
    const resolvedTabKey = currentTabKey ?? getCurrentTabKey()
    const resolvedPeriod = mois !== undefined || annee !== undefined
      ? { mois, annee }
      : getMoisAnnee()

    const nextPath = getNextStepPath(domain, resolvedTabKey, resolvedPeriod.mois, resolvedPeriod.annee)
    window.location.assign(nextPath)
  }, [domain, getCurrentTabKey, getMoisAnnee])

  return {
    navigateToNextStep,
    getCurrentTabKey,
    getMoisAnnee,
  }
}
