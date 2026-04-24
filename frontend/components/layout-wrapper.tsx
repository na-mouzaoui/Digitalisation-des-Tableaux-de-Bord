"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "./sidebar"
import type { User } from "@/lib/db"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { logout } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

interface LayoutWrapperProps {
  user: User
  children: React.ReactNode
}

export function LayoutWrapper({ user, children }: LayoutWrapperProps) {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearInactivityTimer = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current)
      inactivityTimeoutRef.current = null
    }
  }

  const clearCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }

  const handleLogout = async () => {
    clearInactivityTimer()
    clearCountdown()
    await logout()
    router.push("/login")
    router.refresh()
  }

  const startCountdown = () => {
    clearCountdown()
    setCountdown(10)
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
  }

  const resetInactivityTimer = () => {
    clearInactivityTimer()
    inactivityTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
    }, 20 * 60 * 1000)
  }

  const handleStayConnected = () => {
    setShowWarning(false)
    clearCountdown()
    resetInactivityTimer()
  }

  useEffect(() => {
    if (showWarning) {
      startCountdown()
    } else {
      clearCountdown()
      setCountdown(10)
    }
  }, [showWarning])

  useEffect(() => {
    if (showWarning && countdown === 0) {
      handleLogout()
    }
  }, [showWarning, countdown])

  useEffect(() => {
    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"]
    const handleActivity = () => {
      if (!showWarning) {
        resetInactivityTimer()
      }
    }

    activityEvents.forEach((event) => window.addEventListener(event, handleActivity))
    resetInactivityTimer()

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, handleActivity))
      clearInactivityTimer()
      clearCountdown()
    }
  }, [showWarning])

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={user} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-auto bg-gray-50 p-6">{children}</main>
        </div>
      </div>

      <AlertDialog open={showWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inactivité détectée</AlertDialogTitle>
            <AlertDialogDescription>
              La plateforme va se déconnecter automatiquement dans {countdown}s en raison de l'inactivité.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
              <Button onClick={handleLogout} className="bg-destructive text-white hover:bg-destructive/90">
                Déconnecter maintenant
              </Button>
              <Button variant="outline" onClick={handleStayConnected}>
                Rester connecté
              </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
