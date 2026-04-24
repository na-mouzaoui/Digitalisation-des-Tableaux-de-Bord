"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { login } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Eye, EyeOff } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get("registered")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const result = await login(email, password)
    if (result.success) {
      // Decode JWT to determine role-based redirect
      let destination = "/tableau_dashbord"
      try {
        const token = localStorage.getItem("jwt")
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]))
          if (payload.role === "admin") destination = "/admin"
        }
      } catch { /* use default */ }
      setLoading(false)
      router.push(destination)
    } else {
      setError(result.error || "Erreur de connexion")
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Entrez vos identifiants pour accéder é votre compte</CardDescription>
      </CardHeader>
      <CardContent>
        {registered && (
          <Alert className="mb-4" style={{ borderColor: '#2db34b', backgroundColor: '#f0fdf4' }}>
            <CheckCircle2 className="h-4 w-4" style={{ color: '#2db34b' }} />
            <AlertDescription style={{ color: '#2db34b' }}>
              Votre compte a été créé avec succés ! Vous pouvez maintenant vous connecter.
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              placeholder="prenom.nom@mobilis.dz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="????????????????????????"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading} style={{ backgroundColor: '#2db34b' }}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
