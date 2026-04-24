"use client"

import { Card } from "@/components/ui/card"
import { useEffect, useState, useRef } from "react"
import type { Bank } from "@/lib/db"
import { splitAmountInWords } from "@/lib/text-utils"
import { mergeBankPositions, parseBankPositions } from "@/lib/bank-positions"
import dynamic from "next/dynamic"
import { CheckCanvas } from "./check-canvas"
import { formatDateFR } from "@/lib/date-utils"
import { API_BASE } from "@/lib/config"

// Import PDFViewer dynamically with ssr disabled
const PDFViewer = dynamic(() => import("./pdf-viewer").then(mod => mod.PDFViewer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4">Chargement...</div>
})

interface CheckPreviewProps {
  amount: string
  amountInWords: string
  payee: string
  city: string
  date: string
  reference: string
  bank: string
  showRectangles?: boolean
}

export function CheckPreview({
  amount,
  amountInWords,
  payee,
  city,
  date,
  reference,
  bank,
  showRectangles = false,
}: CheckPreviewProps) {
  const [bankData, setBankData] = useState<Bank | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageWidth, setPageWidth] = useState(600)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bank) {
      setBankData(null)
      return
    }

    const loadBankData = async () => {
      const token = localStorage.getItem("jwt")
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      const response = await fetch(`${API_BASE}/api/banks`, { 
        credentials: "include",
        headers 
      })
      if (!response.ok) {
        console.error("Impossible de charger les banques pour la prévisualisation", await response.text().catch(() => ""))
        setBankData(null)
        return
      }
      const data = await response.json()
      const rawBanks = Array.isArray(data.banks) ? data.banks : []
      
      // Load user-specific calibrations for each bank
      const normalizedBanks = await Promise.all(rawBanks.map(async (rawBank: Bank & { positionsJson?: string }) => {
        // Try to get user-specific calibration
        const calibrationResponse = await fetch(`${API_BASE}/api/banks/${rawBank.id}/user-calibration`, {
          credentials: "include",
          headers
        })
        if (calibrationResponse.ok) {
          const calibrationData = await calibrationResponse.json()
          return {
            ...rawBank,
            positions: mergeBankPositions(parseBankPositions(calibrationData.positionsJson)),
          }
        }
        
        // Fallback to default bank positions if no user calibration exists
        return {
          ...rawBank,
          positions: mergeBankPositions(parseBankPositions(rawBank.positionsJson)),
        }
      }))
      
      const selectedBank = normalizedBanks.find((b: Bank) => b.name === bank)
      setBankData(selectedBank || null)
    }

    loadBankData()
  }, [bank])

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth
        setPageWidth(width)
      }
    }
    // Delay to ensure container is fully rendered
    const timer = setTimeout(updateWidth, 100)
    window.addEventListener('resize', updateWidth)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateWidth)
    }
  }, [bankData])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const positions = bankData?.positions

  if (positions) {
    const { line1: amountLine1, line2: amountLine2 } = positions.amountInWordsLine2
      ? splitAmountInWords(amountInWords, positions.amountInWords.width, positions.amountInWords.fontSize)
      : { line1: amountInWords, line2: "" }

    return (
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Aperéu du chéque</h2>
        <CheckCanvas
          pdfUrl={bankData?.pdfUrl && bankData.pdfUrl !== 'undefined' ? bankData.pdfUrl : undefined}
          pageWidth={pageWidth}
          containerRef={containerRef}
          positions={positions}
          showRectangles={showRectangles}
          values={{
            city,
            date: formatDateFR(date),
            payee,
            amount: amount || "",
            amountLine1,
            amountLine2,
          }}
          PDFComponent={PDFViewer}
          onDocumentLoadSuccess={onDocumentLoadSuccess}
        />
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Prévisualisation</h2>
      <div className="relative flex h-[600px] items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-100"></div>
    </Card>
  )
}
