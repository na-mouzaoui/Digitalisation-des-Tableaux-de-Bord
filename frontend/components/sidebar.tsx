"use client"

import { useState } from "react"
import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  LogOut,
  FilePlus,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/auth-client"
import type { User } from "@/lib/db"
import UserProfileMenu from "./user-profile-menu"

const tableuLinks = [
  { name: "Commercial", href: "/tableu/commercial" },
  { name: "Réseaux technique (DVDRS)", href: "/tableu/DVDRS" },
  { name: "Qualité réseau (DQRPC)", href: "/tableu/DQRPC" },
  { name: "Support", href: "/tableu/Support" },
  { name: "Finances", href: "/tableu/finances" },
  { name: "Direction régionale", href: "/tableu/regionale" },
]

interface SidebarProps {
  user: User
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const modules = (user.accessModules || "tableu")
    .split(",")
    .map((m: string) => m.trim())

  const hasTableu = modules.includes("tableu")

  const [openTableu, setOpenTableu] = useState(
    pathname.startsWith("/tableu")
  )

  const handleLogout = async () => {
    await logout()
    router.push("/login")
    router.refresh()
  }

  const renderNavLink = (
    name: string,
    href: string,
    Icon?: React.ElementType
  ) => {
    const isActive = pathname === href

    return (
      <Link
        key={name}
        href={href}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        style={{
          backgroundColor: isActive ? "#2db34b" : "transparent",
          color: isActive ? "white" : "#1f2937",
        }}
      >
        {Icon && (
          <Icon
            className="h-5 w-5"
            style={{ color: isActive ? "white" : "#e82c2a" }}
          />
        )}
        {name}
      </Link>
    )
  }

  return (
    <div className="relative flex h-full flex-col border-r bg-white w-64">
      
      {/* Logo */}
      <div className="border-b p-4 flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="Logo"
          width={180}
          height={60}
          className="object-contain"
          priority
        />
      </div>

      {/* NAV */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        
        {hasTableu && (
          <>
            {/* Dashboard */}
            {renderNavLink("Dashboard", "/dashbord", LayoutDashboard)}

            {/* Accordion Nouveaux Tableaux */}
            <div className="mt-2">
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
                
                {/* Lien vers /declaration */}
                <Link
                  href="/declaration"
                  className="flex items-center gap-2 flex-1"
                >
                  <FilePlus className="h-5 w-5 text-red-500" />
                  Nouveaux tableaux
                </Link>

                {/* Toggle accordion */}
                <button
                  type="button"
                  onClick={() => setOpenTableu(!openTableu)}
                  className="ml-2"
                >
                  {openTableu ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>

              {openTableu && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
                  {tableuLinks.map((item) =>
                    renderNavLink(item.name, item.href)
                  )}
                </div>
              )}
            </div>
          </>
        )}

      </nav>

      {/* Footer */}
      <div className="border-t p-4 space-y-2">
        <div className="text-xs text-gray-600 truncate" title={user.email}>
          {user.email}
        </div>

        <div className="flex items-center gap-2">
          <UserProfileMenu />

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex-1 justify-start gap-2"
          >
            <LogOut className="h-4 w-4 text-red-500" />
            Déconnexion
          </Button>
        </div>
      </div>

    </div>
  )
}