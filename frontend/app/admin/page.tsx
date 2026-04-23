"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import AdminUserManagement from "@/components/admin-user-management"
import AdminAuditLogs from "@/components/admin-audit-logs"
import { logout } from "@/lib/auth-client"

export default function AdminPage() {
  const router = useRouter()
  const { user, isLoading, status } = useAuth({ requireAuth: true, redirectTo: "/login" })

  useEffect(() => {
    if (
      !isLoading &&
      status === "authenticated" &&
      (user as { role?: string } | null)?.role !== "admin"
    ) {
      router.replace("/dashbord")
    }
  }, [isLoading, status, user, router])

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  if (isLoading || !user || (user as { role?: string }).role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Administration</h1>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashbord")}
            >
              Retour a la plateforme
            </Button>

            <Button variant="outline" onClick={handleLogout}>
              DÃ©connexion
            </Button>
          </div>
        </div>

        {/* TABS */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des utilisateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminUserManagement />
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDIT */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Journal d'audit</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminAuditLogs />
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}
