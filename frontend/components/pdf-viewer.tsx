"use client"

import { useState, useEffect, useRef, useMemo } from 'react'

interface PDFViewerProps {
  fileUrl: string
  width: number
  onLoadSuccess?: (data: { numPages: number; pageWidth: number; pageHeight: number }) => void
  className?: string
  forceScale?: number
}

export function PDFViewer({ fileUrl, width, onLoadSuccess, className, forceScale }: PDFViewerProps) {
  const [isClient, setIsClient] = useState(false)
  const [PDFComponents, setPDFComponents] = useState<any>(null)
  const [documentKey, setDocumentKey] = useState(0)
  const [scale, setScale] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const loadingTaskRef = useRef<any>(null)

  useEffect(() => {
    setIsClient(true)
    
    // Import react-pdf only on client side
    const loadPDF = async () => {
      try {
        const { pdfjs, Document, Page } = await import('react-pdf')
        
        // Use local worker file from public directory
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        // Import styles
        await import('react-pdf/dist/Page/AnnotationLayer.css')
        await import('react-pdf/dist/Page/TextLayer.css')

        setPDFComponents({ Document, Page })
      } catch (error) {
        console.error('Error loading PDF components:', error)
      }
    }
    
    loadPDF()

    return () => {
      // Cleanup on unmount
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {})
      }
    }
  }, [])

  // Force remount when fileUrl changes to properly cleanup previous document
  useEffect(() => {
    if (fileUrl && PDFComponents) {
      setDocumentKey(prev => prev + 1)
    }
  }, [fileUrl, PDFComponents])

  // Load PDF as binary data to avoid URL parsing issues in some runtimes.
  useEffect(() => {
    let isCancelled = false

    const loadPdfData = async () => {
      if (!fileUrl || fileUrl === 'undefined' || fileUrl.includes('undefined')) {
        setPdfData(null)
        return
      }

      try {
        setError(null)
        const response = await fetch(fileUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/pdf',
          },
          credentials: 'omit',
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const buffer = await response.arrayBuffer()
        if (!isCancelled) {
          setPdfData(new Uint8Array(buffer))
          setDocumentKey(prev => prev + 1)
        }
      } catch (err: any) {
        if (!isCancelled) {
          setPdfData(null)
          setError(err?.message || 'Erreur de chargement du PDF')
        }
      }
    }

    loadPdfData()

    return () => {
      isCancelled = true
    }
  }, [fileUrl])

  // Memoize file object to prevent unnecessary reloads - MUST BE BEFORE ANY RETURN
  const fileConfig = useMemo(() => {
    if (!pdfData) {
      return null
    }

    return {
      data: pdfData,
    }
  }, [pdfData])

  // Memoize options to prevent unnecessary reloads - MUST BE BEFORE ANY RETURN
  const pdfOptions = useMemo(() => ({
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  }), [])

  if (!isClient || !PDFComponents) {
    return <div className="flex items-center justify-center p-4">Chargement du PDF...</div>
  }

  const { Document, Page } = PDFComponents

  const handleLoadSuccess = (pdf: any) => {
    setError(null)
    loadingTaskRef.current = pdf
    if (onLoadSuccess) {
      // Get the first page to extract dimensions
      pdf.getPage(1).then((page: any) => {
        const viewport = page.getViewport({ scale: 1 })
        // Calculate scale to fit the desired width unless a fixed scale is provided
        const calculatedScale = forceScale ?? (width / viewport.width)
        setScale(calculatedScale)
        onLoadSuccess({ 
          numPages: pdf.numPages,
          pageWidth: viewport.width,
          pageHeight: viewport.height
        })
      })
    }
  }

  const handleLoadError = (error: any) => {
    // Silently handle network errors (likely means PDF doesn't exist yet or backend is down)
    const errorMessage = error?.message || 'Erreur de chargement du PDF'
    
    // Only log to console in development, not as a React warning
    if (process.env.NODE_ENV === 'development') {
      console.info('PDF Load Info:', { error: errorMessage, fileUrl })
    }
    
    setError(errorMessage)
  }

  // Don't render Document if fileUrl is invalid or empty
  if (!fileUrl || fileUrl === 'undefined' || fileUrl.includes('undefined')) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-400">
        Aucun PDF disponible
      </div>
    )
  }

  if (!fileConfig) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-400">
        {error ? 'PDF non disponible' : 'Chargement du PDF...'}
      </div>
    )
  }

  return (
    <Document
      key={documentKey}
      file={fileConfig}
      onLoadSuccess={handleLoadSuccess}
      onLoadError={handleLoadError}
      className={className}
      loading={<div className="flex items-center justify-center p-4">Chargement du PDF...</div>}
      error={<div className="flex items-center justify-center p-4 text-gray-400">PDF non disponible</div>}
      options={pdfOptions}
    >
      <Page
        pageNumber={1}
        scale={scale}
        renderTextLayer={false}
        renderAnnotationLayer={false}
      />
    </Document>
  )
}
