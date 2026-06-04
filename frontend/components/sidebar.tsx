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
import type { DomainKey } from "@/lib/tableau-domain-steps"
import UserProfileMenu from "./user-profile-menu"

const tableauLinks: { name: string; href: string; domainKey: DomainKey }[] = [
  { name: "Commercial", href: "/tableau/commercial", domainKey: "commercial" },
  { name: "Réseaux technique (DVDRS)", href: "/tableau/DVDRS", domainKey: "DVDRS" },
  { name: "Qualité réseau (DQRPC)", href: "/tableau/DQRPC", domainKey: "DQRPC" },
  { name: "Support", href: "/tableau/Support", domainKey: "Support" },
  { name: "Finances", href: "/tableau/finances", domainKey: "finances" },
  { name: "Direction régionale", href: "/tableau/regionale", domainKey: "regionale" },
]

interface SidebarProps {
  user: User
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const modules = (user.accessModules || "tableau")
    .split(",")
    .map((m: string) => m.trim())

  const hastableau = modules.includes("tableau")

  const [opentableau, setOpentableau] = useState(
    pathname.startsWith("/tableau")
  )
  const isTableauSectionActive = pathname.startsWith("/tableau")

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
    const isActive = pathname === href || pathname.startsWith(href + "/")

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
      
      {/* Logo: prefer attached custom logo, fallback to `logo_slogan.png` */}
      <div className="border-b p-4 flex items-center justify-center">
        {/* Use a normal img with onError fallback so developers can drop a file named
            logo-attached.png into frontend/public/ to override the logo without code changes. */}
        <img
          src="/logo-attached.png"
          alt="Logo"
          width={180}
          height={60}
          className="object-contain"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement
            if (img.src.endsWith('/logo-attached.png')) {
              img.src = '/logo_slogan.png'
            }
          }}
        />
      </div>

      {/* NAV */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        
        {hastableau && (
          <>
            {/* Dashboard */}
            {renderNavLink("Dashboard", "/dashbord", LayoutDashboard)}

            {/* Accordion Nouveaux Tableaux */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setOpentableau(!opentableau)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <FilePlus className="h-5 w-5 text-red-600" />
                <span className="flex-1 text-left">Nouveaux tableaux</span>
                {opentableau ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {opentableau && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
                  {tableauLinks.map((item) =>
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