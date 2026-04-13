import type React from "react"
import type { Metadata } from "next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

// Polices Google supprimées pour compatibilité VM entreprise
// Les polices système (sans-serif, monospace) sont utilisées via globals.css

export const metadata: Metadata = {
  title: "Tableau de bord",
  description: "Tableau de bord - Application de gestion des declarations fiscales",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster />
        {/* Vercel Analytics supprimé */}
      </body>
    </html>
  )
}
