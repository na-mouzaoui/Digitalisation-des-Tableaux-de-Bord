"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@/lib/db"
import { API_BASE } from "@/lib/config"

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated"

interface UseAuthOptions {
  requireAuth?: boolean
  redirectIfFound?: boolean
  redirectTo?: string
  enabled?: boolean
}

interface UseAuthResult {
  user: User | null
  status: AuthStatus
  isLoading: boolean
  error: string | null
  refresh: () => Promise<User | null>
}

export function useAuth(options: UseAuthOptions = {}): UseAuthResult {
  const {
    requireAuth = false,
    redirectIfFound = false,
    redirectTo,
    enabled = true,
  } = options
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleRedirects = useCallback(
    (nextUser: User | null) => {
      if (!redirectTo) {
        return
      }

      if (nextUser && redirectIfFound) {
        router.replace(redirectTo)
      } else if (!nextUser && requireAuth) {
        router.replace(redirectTo)
      }
    },
    [redirectIfFound, redirectTo, requireAuth, router],
  )

  const fetchUser = useCallback(async () => {
    if (!enabled) {
      setUser(null)
      setStatus("idle")
      return null
    }

    setStatus("loading")
    setError(null)

    try {
      let token: string | null = null
      try {
        token = localStorage.getItem("jwt")
      } catch {
        token = null
      }

      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (!response.ok) {
        throw new Error("Session invalide")
      }

      const payload = await response.json().catch(() => ({}))
      const nextUser: User | null = payload?.user ?? null

      if (!mountedRef.current) {
        return nextUser
      }

      setUser(nextUser)
      setStatus(nextUser ? "authenticated" : "unauthenticated")
      handleRedirects(nextUser)
      return nextUser
    } catch (err) {
      if (!mountedRef.current) {
        return null
      }

      setUser(null)
      setStatus("unauthenticated")
      setError(err instanceof Error ? err.message : "Erreur d'authentification")
      handleRedirects(null)
      return null
    }
  }, [enabled, handleRedirects])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return {
    user,
    status,
    isLoading: status === "idle" || status === "loading",
    error,
    refresh: fetchUser,
  }
}
