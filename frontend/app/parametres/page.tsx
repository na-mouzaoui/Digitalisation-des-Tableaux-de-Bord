"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { ParametersPanel } from "@/components/parameters-panel"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import { useAuth } from "@/hooks/use-auth"

function ParametresContent() {
  const searchParams = useSearchParams()
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })
  const preSelectedBankId = searchParams.get("bank") ?? undefined

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  if (!user || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirection...</p>
      </div>
    )
  }

  const hasAccess = user.role !== "direction"

  return (
    <LayoutWrapper user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ParamÃ¨tres</h1>
        </div>
        {hasAccess ? (
          <ParametersPanel preSelectedBankId={preSelectedBankId} />
        ) : (
          <AccessDeniedDialog
            title="AccÃ¨s refusÃ©"
            message="Votre rÃ´le ne vous permet pas de crÃ©er, modifier ou supprimer des banques, ni de modifier les paramÃ¨tres de calibrage. Seuls les utilisateurs avec le rÃ´le 'Finance', 'RÃ©gionale' ou 'Admin' peuvent effectuer cette action."
            redirectTo="/tableu_dashbord"
          />
        )}
      </div>
    </LayoutWrapper>
  )
}

export default function ParametresPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement...</div>}>
      <ParametresContent />
    </Suspense>
  )
}
