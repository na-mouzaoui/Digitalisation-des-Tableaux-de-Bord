"use client"

import { RefObject } from "react"
import type { Bank } from "@/lib/db"
import { API_BASE } from "@/lib/config"

export type PDFComponent = React.ComponentType<{
  fileUrl: string
  width: number
  onLoadSuccess?: (data: { numPages: number; pageWidth: number; pageHeight: number }) => void
  className?: string
}>

interface CheckCanvasProps {
  pdfUrl?: string
  pageWidth: number
  pageHeight?: number
  containerRef: RefObject<HTMLDivElement | null>
  positions: Bank["positions"]
  showRectangles: boolean
  values: {
    city: string
    date: string
    payee: string
    amount: string
    amountLine1: string
    amountLine2?: string
  }
  PDFComponent: PDFComponent
  onDocumentLoadSuccess?: (data: { numPages: number; pageWidth: number; pageHeight: number }) => void
}

export function CheckCanvas({
  pdfUrl,
  pageWidth,
  pageHeight,
  containerRef,
  positions,
  showRectangles,
  values,
  PDFComponent,
  onDocumentLoadSuccess,
}: CheckCanvasProps) {
  const { city, date, payee, amount, amountLine1, amountLine2 } = values
  const normalizePdfUrl = (url?: string) => {
    if (!url) return undefined
    // Check for invalid URLs
    if (url === 'undefined' || url.includes('undefined') || url.includes('null')) return undefined
    if (url.startsWith("http")) return url
    if (url.startsWith("/")) return `${API_BASE}${url}`
    return `${API_BASE}/${url}`
  }

  const normalizedPdfUrl = normalizePdfUrl(pdfUrl)
  // Keep 1:1 scale for calibration: use native PDF dimensions when provided
  const safePageWidth = pageWidth || 600
  const safePageHeight = pageHeight || 800

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded border-2 border-dashed border-gray-300 bg-white"
      style={{ width: `${safePageWidth}px`, height: `${safePageHeight}px` }}
    >
      {normalizedPdfUrl && (
        <div
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: `${safePageWidth}px`, height: `${safePageHeight}px` }}
        >
          <PDFComponent
            fileUrl={normalizedPdfUrl}
            width={safePageWidth}
            onLoadSuccess={onDocumentLoadSuccess}
            className="w-full h-full"
          />
        </div>
      )}

      {!normalizedPdfUrl && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <p className="text-muted-foreground">Aucun PDF téléchargé pour cette banque</p>
        </div>
      )}

      {showRectangles ? (
        <>
          {/* Ville */}
          <div
            className="absolute border-2 border-blue-500 bg-blue-100/30"
            style={{
              left: `${positions.city.x}px`,
              top: `${positions.city.y}px`,
              width: `${positions.city.width}px`,
              height: `${positions.city.fontSize * 1.5}px`,
              transform: `rotate(${positions.city.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="flex h-full items-center justify-center px-1 text-center font-medium text-blue-900"
              style={{ fontSize: `${positions.city.fontSize}px` }}
            >
              {city}
            </div>
          </div>

          {/* Date */}
          <div
            className="absolute border-2 border-green-500 bg-green-100/30"
            style={{
              left: `${positions.date.x}px`,
              top: `${positions.date.y}px`,
              width: `${positions.date.width}px`,
              height: `${positions.date.fontSize * 1.5}px`,
              transform: `rotate(${positions.date.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="flex h-full items-center justify-center px-1 text-center font-medium text-green-900"
              style={{ fontSize: `${positions.date.fontSize}px` }}
            >
              {date}
            </div>
          </div>

          {/* Bénéficiaire */}
          <div
            className="absolute border-2 border-purple-500 bg-purple-100/30"
            style={{
              left: `${positions.payee.x}px`,
              top: `${positions.payee.y}px`,
              width: `${positions.payee.width}px`,
              height: `${positions.payee.fontSize * 1.5}px`,
              transform: `rotate(${positions.payee.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="flex h-full items-center justify-center px-1 text-center font-medium text-purple-900"
              style={{ fontSize: `${positions.payee.fontSize}px` }}
            >
              {payee}
            </div>
          </div>

          {/* Montant en lettres */}
          <div
            className="absolute border-2 border-orange-500 bg-orange-100/30"
            style={{
              left: `${positions.amountInWords.x}px`,
              top: `${positions.amountInWords.y}px`,
              width: `${positions.amountInWords.width}px`,
              height: `${positions.amountInWords.fontSize * 1.5}px`,
              transform: `rotate(${positions.amountInWords.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="flex h-full items-center px-1 font-medium text-orange-900 overflow-hidden"
              style={{ fontSize: `${positions.amountInWords.fontSize}px` }}
            >
              {amountLine1}
            </div>
          </div>

          {/* Montant en lettres ligne 2 */}
          {positions.amountInWordsLine2 && amountLine2 && (
          <div
              className="absolute border-2 border-orange-600 bg-orange-200/30"
              style={{
                left: `${positions.amountInWordsLine2.x}px`,
                top: `${positions.amountInWordsLine2.y}px`,
                width: `${positions.amountInWordsLine2.width}px`,
                height: `${positions.amountInWordsLine2.fontSize * 1.5}px`,
                transform: `rotate(${positions.amountInWordsLine2.rotation || 0}deg)`,
                transformOrigin: 'top left',
              }}
            >
              <div
                className="flex h-full items-center px-1 font-medium text-orange-900 overflow-hidden"
                style={{ fontSize: `${positions.amountInWordsLine2.fontSize}px` }}
              >
                {amountLine2}
              </div>
            </div>
          )}

          {/* Montant */}
          <div
            className="absolute border-2 border-emerald-500 bg-emerald-100/30"
            style={{
              left: `${positions.amount.x}px`,
              top: `${positions.amount.y}px`,
              width: `${positions.amount.width}px`,
              height: `${positions.amount.fontSize * 1.5}px`,
              transform: `rotate(${positions.amount.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="flex h-full items-center justify-center px-1 text-center font-bold text-emerald-900"
              style={{ fontSize: `${positions.amount.fontSize}px` }}
            >
              {amount}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Mode sans rectangles - affichage simple du texte */}
          {/* Mode sans rectangles - affichage simple du texte, relatif é la page */}
          <div
            className="check-text absolute font-medium text-gray-900"
            style={{
              left: `${positions.city.x}px`,
              top: `${positions.city.y}px`,
              fontSize: `${positions.city.fontSize}px`,
              whiteSpace: 'nowrap',
              transform: `rotate(${positions.city.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            {city}
          </div>
          <div
            className="check-text absolute font-medium text-gray-900"
            style={{
              left: `${positions.date.x}px`,
              top: `${positions.date.y}px`,
              fontSize: `${positions.date.fontSize}px`,
              whiteSpace: 'nowrap',
              transform: `rotate(${positions.date.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            {date}
          </div>
          <div
            className="check-text absolute font-medium text-gray-900"
            style={{
              left: `${positions.payee.x}px`,
              top: `${positions.payee.y}px`,
              fontSize: `${positions.payee.fontSize}px`,
              whiteSpace: 'nowrap',
              transform: `rotate(${positions.payee.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            {payee}
          </div>
          <div
            className="check-text absolute font-medium text-gray-900"
            style={{
              left: `${positions.amountInWords.x}px`,
              top: `${positions.amountInWords.y}px`,
              fontSize: `${positions.amountInWords.fontSize}px`,
              maxWidth: `${positions.amountInWords.width}px`,
              transform: `rotate(${positions.amountInWords.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            {amountLine1}
          </div>
          {positions.amountInWordsLine2 && amountLine2 && (
            <div
              className="check-text absolute font-medium text-gray-900"
              style={{
                left: `${positions.amountInWordsLine2.x}px`,
                top: `${positions.amountInWordsLine2.y}px`,
                fontSize: `${positions.amountInWordsLine2.fontSize}px`,
                maxWidth: `${positions.amountInWordsLine2.width}px`,
                transform: `rotate(${positions.amountInWordsLine2.rotation || 0}deg)`,
                transformOrigin: 'top left',
              }}
            >
              {amountLine2}
            </div>
          )}
          <div
            className="check-text absolute font-bold text-gray-900"
            style={{
              left: `${positions.amount.x}px`,
              top: `${positions.amount.y}px`,
              fontSize: `${positions.amount.fontSize}px`,
              whiteSpace: 'nowrap',
              transform: `rotate(${positions.amount.rotation || 0}deg)`,
              transformOrigin: 'top left',
            }}
          >
            {amount}
          </div>
        </>
      )}
    </div>
  )
}
