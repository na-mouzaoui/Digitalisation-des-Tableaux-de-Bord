"use client"

import { CheckForm } from "@/components/check-form"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { AccessDeniedDialog } from "@/components/access-denied-dialog"
import { useAuth } from "@/hooks/use-auth"

export default function ChequePage() {
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })

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
          <h1 className="text-3xl font-bold text-gray-900">Nouveau Chèque</h1>
        </div>
        {hasAccess ? (
          <CheckForm user={user} />
        ) : (
          <AccessDeniedDialog
            title="Accès refusé"
            message="Votre rôle ne vous permet pas de créer ou imprimer des chèques. Seuls les utilisateurs avec le rôle 'Finance', 'Régionale' ou 'Admin' peuvent effectuer cette action."
            redirectTo="/cheque_dashbord"
          />
        )}
      </div>
    </LayoutWrapper>
  )
}
