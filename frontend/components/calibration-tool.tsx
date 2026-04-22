"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import type { Bank } from "@/lib/db"
import { splitAmountInWords } from "@/lib/text-utils"
import { DEFAULT_BANK_POSITIONS, mergeBankPositions, parseBankPositions } from "@/lib/bank-positions"
import dynamic from "next/dynamic"
import { CheckCanvas } from "./check-canvas"
import { useToast } from "@/hooks/use-toast"
import { API_BASE } from "@/lib/config"

type CalibrationToolProps = {
  refreshKey?: number
  preSelectedBankId?: string
}

// Import PDFViewer dynamically with ssr disabled
const PDFViewer = dynamic(() => import("./pdf-viewer").then(mod => mod.PDFViewer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4">Chargement...</div>
})

export function CalibrationTool({ refreshKey, preSelectedBankId }: CalibrationToolProps) {
  const { toast } = useToast()
  const [banks, setBanks] = useState<Bank[]>([])
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageWidth, setPageWidth] = useState(600)
  const [pageHeight, setPageHeight] = useState(850)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedFields, setExpandedFields] = useState({
    city: true,
    date: true,
    payee: true,
    amountInWords: true,
    amountInWordsLine2: true,
    amount: true,
    checkLayout: true,
  })
  const [positions, setPositions] = useState(DEFAULT_BANK_POSITIONS)
  const [hasSecondLine, setHasSecondLine] = useState(false)

  const loadBanks = useCallback(async () => {
    const response = await requestWithAuth(`${API_BASE}/api/banks`)
    if (!response.ok) {
      return
    }
    const data = await response.json()
    const rawBanks = Array.isArray(data.banks) ? data.banks : []
    
    // Load user-specific calibrations for each bank
    const normalizedBanks = await Promise.all(rawBanks.map(async (bank: Bank & { positionsJson?: string }) => {
      // Try to get user-specific calibration
      const calibrationResponse = await requestWithAuth(`${API_BASE}/api/banks/${bank.id}/user-calibration`)
      if (calibrationResponse.ok) {
        const calibrationData = await calibrationResponse.json()
        return {
          ...bank,
          positions: mergeBankPositions(parseBankPositions(calibrationData.positionsJson)),
        }
      }
      
      // Fallback to default bank positions if no user calibration exists
      return {
        ...bank,
        positions: mergeBankPositions(parseBankPositions(bank.positionsJson)),
      }
    }))
    
    setBanks(normalizedBanks)
    if (normalizedBanks.length === 0) {
      setSelectedBank(null)
      return
    }

    // Priority: preSelectedBankId from URL > previous selection > first bank
    let nextBank: Bank | undefined
    if (preSelectedBankId) {
      nextBank = normalizedBanks.find((bank: Bank) => String(bank.id) === String(preSelectedBankId))
    }
    if (!nextBank) {
      const previousId = selectedBank?.id
      nextBank = normalizedBanks.find((bank: Bank) => bank.id === previousId) ?? normalizedBanks[0]
    }
    setSelectedBank(nextBank || null)
  }, [preSelectedBankId, selectedBank?.id])

  useEffect(() => {
    loadBanks()
  }, [loadBanks, refreshKey, preSelectedBankId])

  useEffect(() => {
    const handleBanksUpdated = () => loadBanks()
    window.addEventListener("banks-updated", handleBanksUpdated)
    return () => window.removeEventListener("banks-updated", handleBanksUpdated)
  }, [loadBanks])

  useEffect(() => {
    if (selectedBank) {
      setPositions(selectedBank.positions)
      setHasSecondLine(!!selectedBank.positions.amountInWordsLine2)
    }
  }, [selectedBank])

  const onDocumentLoadSuccess = ({ numPages, pageWidth, pageHeight }: { numPages: number; pageWidth: number; pageHeight: number }) => {
    setNumPages(numPages)
    // Utiliser la taille native du PDF pour conserver l'Ã©chelle 1:1 durant le calibrage
    setPageWidth(Math.round(pageWidth))
    setPageHeight(Math.round(pageHeight))
  }

  const requestWithAuth = async (input: string, init: RequestInit = {}) => {
    const token = localStorage.getItem("jwt")
    return fetch(input, { 
      ...init, 
      credentials: "include",
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
  }


  const handleSave = async () => {
    if (!selectedBank) {
      toast({
        title: "Erreur",
        description: "Aucune banque sÃ©lectionnÃ©e",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    const finalPositions = hasSecondLine ? positions : { ...positions, amountInWordsLine2: undefined }

    try {
      // Save user-specific calibration
      const response = await requestWithAuth(`${API_BASE}/api/banks/${selectedBank.id}/user-calibration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPositions),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "âœ“ SuccÃ¨s",
          description: "Votre calibrage personnel a Ã©tÃ© sauvegardÃ© avec succÃ¨s!",
        })
        await loadBanks()
      } else {
        const errorData = await response.json().catch(() => null)
        
        const errorMessage = errorData?.error 
          ? `${errorData.error} (Banque ID: ${selectedBank.id})`
          : `La banque avec l'ID "${selectedBank.id}" n'a pas Ã©tÃ© trouvÃ©e. Code: ${response.status}`
        
        toast({
          title: "âœ— Erreur de sauvegarde",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Erreur inconnue"
      toast({
        title: "âœ— Erreur rÃ©seau",
        description: `Impossible de se connecter au serveur: ${errorMsg}`,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const updatePosition = (field: string, property: "x" | "y" | "width" | "fontSize", value: number) => {
    setPositions((prev) => ({
      ...prev,
      [field]: {
        ...prev[field as keyof typeof prev],
        [property]: value,
      },
    }))
  }

  const toggleField = (field: keyof typeof expandedFields) => {
    setExpandedFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  const sampleText = "cinquante mille trois cent quarante-deux dinars algÃ©riens"
  const { line1, line2 } = hasSecondLine
    ? splitAmountInWords(sampleText, positions.amountInWords.width, positions.amountInWords.fontSize)
    : { line1: sampleText, line2: "" }

  return (
    <div className="grid gap-4 lg:grid-cols-[500px_1fr] h-full">
      <Card className="p-4 flex flex-col h-[calc(160vh-200px)]">
        <h2 className="mb-3 text-lg font-semibold">Configuration</h2>
        <div className="flex-1 overflow-y-auto pr-2 mb-3">
          <div className="space-y-3">
          <div>
            <Label>SÃ©lectionner une banque</Label>
            <Select
              value={selectedBank?.id}
              onValueChange={(id) => {
                const bank = banks.find((b) => b.id === id)
                if (bank) setSelectedBank(bank)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une banque" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBank && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Calibrage des champs</h3>

              {/* Amount field - NOW FIRST */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Montant</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleField("amount")}
                    className="h-6 w-6 p-0"
                  >
                    {expandedFields.amount ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                {expandedFields.amount && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Position X (px)</Label>
                      <Input
                        type="number"
                        value={positions.amount.x}
                        onChange={(e) => updatePosition("amount", "x", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Position Y (px)</Label>
                      <Input
                        type="number"
                        value={positions.amount.y}
                        onChange={(e) => updatePosition("amount", "y", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Largeur (px)</Label>
                      <Input
                        type="number"
                        value={positions.amount.width}
                        onChange={(e) => updatePosition("amount", "width", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Taille police (px)</Label>
                      <Input
                        type="number"
                        value={positions.amount.fontSize}
                        onChange={(e) => updatePosition("amount", "fontSize", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rotation</Label>
                      <Select
                        value={String(positions.amount.rotation || 0)}
                        onValueChange={(val) => setPositions(prev => ({
                          ...prev,
                          amount: { ...prev.amount, rotation: Number(val) as 0 | 90 | 180 | 270 }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0Â°</SelectItem>
                          <SelectItem value="90">90Â°</SelectItem>
                          <SelectItem value="180">180Â°</SelectItem>
                          <SelectItem value="270">270Â°</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount in words - Line 1 */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Montant en lettres - Ligne 1</Label>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      const newHasSecondLine = !hasSecondLine
                      setHasSecondLine(newHasSecondLine)
                      if (newHasSecondLine && !positions.amountInWordsLine2) {
                        // Initialize line 2 with default values based on line 1
                        setPositions(prev => ({
                          ...prev,
                          amountInWordsLine2: {
                            x: prev.amountInWords.x,
                            y: prev.amountInWords.y + 25,
                            width: prev.amountInWords.width,
                            fontSize: prev.amountInWords.fontSize,
                            rotation: prev.amountInWords.rotation || 0
                          }
                        }))
                      }
                    }}>
                      {hasSecondLine ? <Trash2 className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
                      {hasSecondLine ? "Supprimer ligne 2" : "Ajouter ligne 2"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleField("amountInWords")}
                      className="h-8 w-8 p-0"
                    >
                      {expandedFields.amountInWords ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {expandedFields.amountInWords && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Position X (px)</Label>
                      <Input
                        type="number"
                        value={positions.amountInWords.x}
                        onChange={(e) => updatePosition("amountInWords", "x", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Position Y (px)</Label>
                      <Input
                        type="number"
                        value={positions.amountInWords.y}
                        onChange={(e) => updatePosition("amountInWords", "y", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Largeur (px)</Label>
                      <Input
                        type="number"
                        value={positions.amountInWords.width}
                        onChange={(e) => updatePosition("amountInWords", "width", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Taille police (px)</Label>
                      <Input
                        type="number"
                        value={positions.amountInWords.fontSize}
                        onChange={(e) => updatePosition("amountInWords", "fontSize", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rotation</Label>
                      <Select
                        value={String(positions.amountInWords.rotation || 0)}
                        onValueChange={(val) => setPositions(prev => ({
                          ...prev,
                          amountInWords: { ...prev.amountInWords, rotation: Number(val) as 0 | 90 | 180 | 270 }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0Â°</SelectItem>
                          <SelectItem value="90">90Â°</SelectItem>
                          <SelectItem value="180">180Â°</SelectItem>
                          <SelectItem value="270">270Â°</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount in words - Line 2 (conditional) */}
              {hasSecondLine && (
                <div className="space-y-2 rounded-lg border border-orange-300 bg-orange-50/50 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-orange-900">Montant en lettres - Ligne 2</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleField("amountInWordsLine2")}
                      className="h-6 w-6 p-0"
                    >
                      {expandedFields.amountInWordsLine2 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  {expandedFields.amountInWordsLine2 && positions.amountInWordsLine2 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Position X (px)</Label>
                      <Input
                        type="number"
                        value={positions.amountInWordsLine2.x}
                        onChange={(e) => updatePosition("amountInWordsLine2", "x", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Position Y (px)</Label>
                      <Input
                        type="number"
                        value={positions.amountInWordsLine2.y}
                        onChange={(e) => updatePosition("amountInWordsLine2", "y", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Largeur (px)</Label>
                      <Input
                        type="number"
                        value={positions.amountInWordsLine2.width}
                        onChange={(e) => updatePosition("amountInWordsLine2", "width", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Taille police (px)</Label>
                      <Input
                        type="number"
                        value={positions.amountInWordsLine2.fontSize}
                        onChange={(e) => updatePosition("amountInWordsLine2", "fontSize", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rotation</Label>
                      <Select
                        value={String(positions.amountInWordsLine2.rotation || 0)}
                        onValueChange={(val) => setPositions(prev => ({
                          ...prev,
                          amountInWordsLine2: prev.amountInWordsLine2 ? { ...prev.amountInWordsLine2, rotation: Number(val) as 0 | 90 | 180 | 270 } : prev.amountInWordsLine2
                        }))}
                        disabled={!positions.amountInWordsLine2}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0Â°</SelectItem>
                          <SelectItem value="90">90Â°</SelectItem>
                          <SelectItem value="180">180Â°</SelectItem>
                          <SelectItem value="270">270Â°</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* Payee field */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">BÃ©nÃ©ficiaire</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleField("payee")}
                    className="h-6 w-6 p-0"
                  >
                    {expandedFields.payee ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                {expandedFields.payee && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Position X (px)</Label>
                      <Input
                        type="number"
                        value={positions.payee.x}
                        onChange={(e) => updatePosition("payee", "x", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Position Y (px)</Label>
                      <Input
                        type="number"
                        value={positions.payee.y}
                        onChange={(e) => updatePosition("payee", "y", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Largeur (px)</Label>
                      <Input
                        type="number"
                        value={positions.payee.width}
                        onChange={(e) => updatePosition("payee", "width", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Taille police (px)</Label>
                      <Input
                        type="number"
                        value={positions.payee.fontSize}
                        onChange={(e) => updatePosition("payee", "fontSize", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rotation</Label>
                      <Select
                        value={String(positions.payee.rotation || 0)}
                        onValueChange={(val) => setPositions(prev => ({
                          ...prev,
                          payee: { ...prev.payee, rotation: Number(val) as 0 | 90 | 180 | 270 }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0Â°</SelectItem>
                          <SelectItem value="90">90Â°</SelectItem>
                          <SelectItem value="180">180Â°</SelectItem>
                          <SelectItem value="270">270Â°</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Date field */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Date</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleField("date")}
                    className="h-6 w-6 p-0"
                  >
                    {expandedFields.date ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                {expandedFields.date && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Position X (px)</Label>
                      <Input
                        type="number"
                        value={positions.date.x}
                        onChange={(e) => updatePosition("date", "x", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Position Y (px)</Label>
                      <Input
                        type="number"
                        value={positions.date.y}
                        onChange={(e) => updatePosition("date", "y", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Largeur (px)</Label>
                      <Input
                        type="number"
                        value={positions.date.width}
                        onChange={(e) => updatePosition("date", "width", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Taille police (px)</Label>
                      <Input
                        type="number"
                        value={positions.date.fontSize}
                        onChange={(e) => updatePosition("date", "fontSize", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rotation</Label>
                      <Select
                        value={String(positions.date.rotation || 0)}
                        onValueChange={(val) => setPositions(prev => ({
                          ...prev,
                          date: { ...prev.date, rotation: Number(val) as 0 | 90 | 180 | 270 }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0Â°</SelectItem>
                          <SelectItem value="90">90Â°</SelectItem>
                          <SelectItem value="180">180Â°</SelectItem>
                          <SelectItem value="270">270Â°</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* City field - NOW LAST */}
              <div className="space-y-2 rounded-lg border p-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Ville</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleField("city")}
                    className="h-6 w-6 p-0"
                  >
                    {expandedFields.city ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                {expandedFields.city && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Position X (px)</Label>
                      <Input
                        type="number"
                        value={positions.city.x}
                        onChange={(e) => updatePosition("city", "x", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Position Y (px)</Label>
                      <Input
                        type="number"
                        value={positions.city.y}
                        onChange={(e) => updatePosition("city", "y", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Largeur (px)</Label>
                      <Input
                        type="number"
                        value={positions.city.width}
                        onChange={(e) => updatePosition("city", "width", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Taille police (px)</Label>
                      <Input
                        type="number"
                        value={positions.city.fontSize}
                        onChange={(e) => updatePosition("city", "fontSize", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rotation</Label>
                      <Select
                        value={String(positions.city.rotation || 0)}
                        onValueChange={(val) => setPositions(prev => ({
                          ...prev,
                          city: { ...prev.city, rotation: Number(val) as 0 | 90 | 180 | 270 }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0Â°</SelectItem>
                          <SelectItem value="90">90Â°</SelectItem>
                          <SelectItem value="180">180Â°</SelectItem>
                          <SelectItem value="270">270Â°</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
        
        {/* Bouton de sauvegarde fixÃ© en bas */}
        {selectedBank && (
          <div className="pt-3 border-t">
            <Button onClick={handleSave} className="w-full" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Sauvegarde..." : "Sauvegarder les positions"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 flex flex-col h-[calc(160vh-200px)]">
        <h2 className="mb-3 text-lg font-semibold">AperÃ§u du chÃ¨que</h2>
        {selectedBank ? (
          <div className="flex-1 overflow-auto space-y-3">
            <CheckCanvas
              pdfUrl={selectedBank.pdfUrl && selectedBank.pdfUrl !== 'undefined' ? selectedBank.pdfUrl : undefined}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              containerRef={containerRef}
              positions={positions}
              showRectangles={true}
              values={{
                city: "Alger",
                date: new Date().toLocaleDateString("fr-FR"),
                payee: "M. Exemple BÃ©nÃ©ficiaire",
                amount: "50,342",
                amountLine1: line1,
                amountLine2: hasSecondLine ? line2 : "",
              }}
              PDFComponent={PDFViewer}
              onDocumentLoadSuccess={onDocumentLoadSuccess}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-sm text-muted-foreground bg-gray-50 rounded-lg border border-dashed p-6">
            <p className="text-center">SÃ©lectionnez une banque pour voir l'aperÃ§u.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
