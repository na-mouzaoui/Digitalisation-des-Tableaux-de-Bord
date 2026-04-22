"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { numberToWordsFR } from "@/lib/number-to-words"
import { CheckPreview } from "./check-preview"
import { RefreshCcw, Settings } from "lucide-react"
import type { Bank } from "@/lib/db"
import { VILLES } from "@/lib/villes"
import Link from "next/link"
import dynamic from "next/dynamic"
import { splitAmountInWords } from "@/lib/text-utils"
import { mergeBankPositions, parseBankPositions } from "@/lib/bank-positions"
import { generateCheckPDF, printCheckPDF } from "@/lib/pdf-generator"
import { useToast } from "@/hooks/use-toast"
import { formatDateFR, getTodayISODate } from "@/lib/date-utils"
import { API_BASE } from "@/lib/config"

const PDFViewer = dynamic(() => import("./pdf-viewer").then(mod => mod.PDFViewer), {
  ssr: false,
})

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

const createCheck = async (data: {
  userId: string
  amount: number
  payee: string
  city: string
  date: string
  reference: string
  bank: string
  checkbookId?: number
}) => {
  const response = await requestWithAuth(`${API_BASE}/api/checks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: data.userId,
      amount: data.amount,
      payee: data.payee,
      city: data.city,
      date: data.date,
      reference: data.reference,
      bank: data.bank,
      ville: data.city, // Send city as ville
      checkbookId: data.checkbookId,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => "")
    throw new Error(payload || `Erreur ${response.status}`)
  }
  return response
}

function PrintCheckCanvas({ positions, values }: {
  positions: Bank["positions"]
  values: {
    city: string
    date: string
    payee: string
    amount: string
    amountLine1: string
    amountLine2?: string
  }
}) {
  const { line1: amountLine1, line2: amountLine2 } = positions.amountInWordsLine2
    ? splitAmountInWords(values.amountLine1, positions.amountInWords.width, positions.amountInWords.fontSize)
    : { line1: values.amountLine1, line2: "" }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        style={{
          position: 'absolute',
          left: `${positions.city.x}px`,
          top: `${positions.city.y}px`,
          fontSize: `${positions.city.fontSize}px`,
          fontWeight: '500',
          color: 'black',
          fontFamily: 'Arial, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        {values.city}
      </div>
      <div
        style={{
          position: 'absolute',
          left: `${positions.date.x}px`,
          top: `${positions.date.y}px`,
          fontSize: `${positions.date.fontSize}px`,
          fontWeight: '500',
          color: 'black',
          fontFamily: 'Arial, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        {values.date}
      </div>
      <div
        style={{
          position: 'absolute',
          left: `${positions.payee.x}px`,
          top: `${positions.payee.y}px`,
          fontSize: `${positions.payee.fontSize}px`,
          fontWeight: '500',
          color: 'black',
          fontFamily: 'Arial, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        {values.payee}
      </div>
      <div
        style={{
          position: 'absolute',
          left: `${positions.amountInWords.x}px`,
          top: `${positions.amountInWords.y}px`,
          maxWidth: `${positions.amountInWords.width}px`,
          fontSize: `${positions.amountInWords.fontSize}px`,
          fontWeight: '500',
          color: 'black',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {amountLine1}
      </div>
      {positions.amountInWordsLine2 && amountLine2 && (
        <div
          style={{
            position: 'absolute',
            left: `${positions.amountInWordsLine2.x}px`,
            top: `${positions.amountInWordsLine2.y}px`,
            maxWidth: `${positions.amountInWordsLine2.width}px`,
            fontSize: `${positions.amountInWordsLine2.fontSize}px`,
            fontWeight: '500',
            color: 'black',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {amountLine2}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: `${positions.amount.x}px`,
          top: `${positions.amount.y}px`,
          fontSize: `${positions.amount.fontSize}px`,
          fontWeight: 'bold',
          color: 'black',
          fontFamily: 'Arial, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        {values.amount}
      </div>
    </div>
  )
}

interface CheckFormProps {
  user: {
    id: string | number
    role: string
    region?: string | null
  }
}

interface Checkbook {
  id: number
  bankId: number
  bankName: string
  agencyName: string
  agencyCode: string
  serie: string
  startNumber: number
  endNumber: number
  capacity: number
  usedCount: number
  remaining: number
}

interface RegionData {
  id: number
  name: string
  villes: string[]
}

export function CheckForm({ user }: CheckFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [amountInWords, setAmountInWords] = useState("")
  const [payee, setPayee] = useState("")
  const [city, setCity] = useState("")
  const [date, setDate] = useState(() => getTodayISODate())
  const [reference, setReference] = useState("")
  const [bank, setBank] = useState("")
  const [checkbookId, setCheckbookId] = useState("")
  const [checkbooks, setCheckbooks] = useState<Checkbook[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [banks, setBanks] = useState<Bank[]>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([])
  const [isPrinting, setIsPrinting] = useState(false)
  const [loadingCheckbooks, setLoadingCheckbooks] = useState(false)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null)
  const generatedPreviewRef = useRef<HTMLDivElement>(null)
  const [generatedPreviewWidth, setGeneratedPreviewWidth] = useState(620)
  const [regionCities, setRegionCities] = useState<string[]>([])
  const [isRegionalUser, setIsRegionalUser] = useState(false)

  const loadBanks = useCallback(async () => {
    const response = await requestWithAuth(`${API_BASE}/api/banks`)
    if (!response.ok) {
      return
    }
    const data = await response.json()
    const payload = Array.isArray(data.banks) ? data.banks : []
    
    // Load user-specific calibrations for each bank
    const normalizedBanks = await Promise.all(payload.map(async (bank: Bank & { positionsJson?: string }) => {
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
  }, [])

  useEffect(() => {
    const updateWidth = () => {
      if (generatedPreviewRef.current) {
        setGeneratedPreviewWidth(generatedPreviewRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => {
      window.removeEventListener("resize", updateWidth)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (generatedPdfUrl) {
        URL.revokeObjectURL(generatedPdfUrl)
      }
    }
  }, [generatedPdfUrl])

  useEffect(() => {
    loadBanks()

    const loadSuppliers = async () => {
      const response = await requestWithAuth(`${API_BASE}/api/suppliers`)
      if (!response.ok) {
        return
      }
      const data = await response.json()
      setSuppliers(Array.isArray(data) ? data : [])
    }
    loadSuppliers()

    // Load region data for regional users
    const loadRegionData = async () => {
      if (user.role === "regionale" && user.region) {
        setIsRegionalUser(true)
        try {
          const response = await requestWithAuth(`${API_BASE}/api/regions`)
          if (response.ok) {
            const regions: RegionData[] = await response.json()
            const userRegion = regions.find(r => r.name === user.region)
            if (userRegion && userRegion.villes && userRegion.villes.length > 0) {
              setRegionCities(userRegion.villes)
              // Set default city to first city in region for regional users
              setCity(userRegion.villes[0])
            } else {
              setCity("Alger") // Fallback
            }
          }
        } catch (error) {
          console.error("Error loading region data:", error)
          setCity("Alger") // Fallback
        }
      } else {
        setIsRegionalUser(false)
        setCity("Alger") // Default for non-regional users
      }
    }
    loadRegionData()
  }, [])

  useEffect(() => {
    const handleBanksUpdated = () => loadBanks()
    window.addEventListener("banks-updated", handleBanksUpdated)
    return () => window.removeEventListener("banks-updated", handleBanksUpdated)
  }, [loadBanks])

  useEffect(() => {
    if (bank) {
      loadCheckbooksForBank(bank)
    } else {
      setCheckbooks([])
      setCheckbookId("")
      setReference("")
    }
  }, [bank])

  useEffect(() => {
    if (checkbookId) {
      // Charger automatiquement le premier numÃ©ro disponible
      loadNextReference()
    } else {
      setReference("")
    }
  }, [checkbookId])

  const loadCheckbooksForBank = async (bankName: string) => {
    setLoadingCheckbooks(true)
    try {
      const selectedBank = banks.find(b => b.name === bankName)
      if (!selectedBank) return

      const response = await requestWithAuth(`${API_BASE}/api/checkbooks?bankId=${selectedBank.id}`)
      if (response.ok) {
        const data = await response.json()
        const available = data.filter((cb: Checkbook) => cb.remaining > 0)
        setCheckbooks(available)
        if (available.length === 0) {
          toast({
            title: "Attention",
            description: "Aucun chÃ©quier disponible pour cette banque",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
    } finally {
      setLoadingCheckbooks(false)
    }
  }

  const loadNextReference = async () => {
    if (!checkbookId) return
    try {
      const response = await requestWithAuth(`${API_BASE}/api/checkbooks/${checkbookId}/next-reference`)
      if (response.ok) {
        const data = await response.json()
        setReference(data.reference)
      }
    } catch (error) {
    }
  }

  const checkReferenceUnique = async (ref: string): Promise<{ unique: boolean; error?: string }> => {
    try {
      const response = await requestWithAuth(`${API_BASE}/api/checks/check-reference?reference=${encodeURIComponent(ref)}`)
      if (response.ok) {
        const data = await response.json()
        return { unique: !data.exists, error: data.exists ? `La rÃ©fÃ©rence ${ref} est dÃ©jÃ  utilisÃ©e` : undefined }
      }
      return { unique: true }
    } catch (error) {
      return { unique: true }
    }
  }

  const formatAmountWithSpaces = (value: string): string => {
    const cleaned = value.replace(/\s/g, "").replace(/[^0-9.,]/g, "").replace(/\./g, ",")
    const hasTrailingComma = cleaned.endsWith(",")
    const parts = cleaned.split(",")
    const integerRaw = parts[0] ?? ""
    const decimalRaw = parts.slice(1).join("")
    const integerPart = integerRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    if (decimalRaw.length > 0) {
      return `${integerPart || "0"},${decimalRaw}`
    }
    if (hasTrailingComma) {
      return `${integerPart || "0"},`
    }
    return integerPart
  }

  const parseAmountToNumber = (value: string): number | null => {
    const cleaned = value.replace(/\s/g, "").replace(/\./g, ",")
    if (!cleaned) return null
    const parts = cleaned.split(",")
    const integerPart = parts[0] || "0"
    const decimalPart = parts.slice(1).join("")
    const numericString = decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart
    const numericValue = Number.parseFloat(numericString)
    return Number.isNaN(numericValue) ? null : numericValue
  }

  const handleAmountChange = (value: string) => {
    // VÃ©rifier que la valeur ne contient que des chiffres, espaces, points et virgules
    const hasInvalidChars = /[^0-9\s.,]/.test(value)
    if (hasInvalidChars) {
      toast({
        title: "Erreur de saisie",
        description: "Le montant ne peut pas contenir de lettres",
        variant: "destructive"
      })
      return
    }
    
    const formatted = formatAmountWithSpaces(value)
    setAmount(formatted)

    const numValue = parseAmountToNumber(formatted)
    if (numValue !== null && numValue > 0) {
      setAmountInWords(numberToWordsFR(numValue))
    } else {
      setAmountInWords("")
    }
  }

  const handleRegenerateWords = () => {
    const numValue = parseAmountToNumber(amount)
    if (numValue !== null && numValue > 0) {
      setAmountInWords(numberToWordsFR(numValue))
    }
  }

  const handlePrintClick = () => {
    handlePrintConfirmed()
  }

  const validateReference = (ref: string, checkbook: Checkbook | undefined): { valid: boolean; error?: string } => {
    if (!checkbook) {
      return { valid: false, error: "ChÃ©quier non trouvÃ©" }
    }

    // La rÃ©fÃ©rence doit Ãªtre au format: SÃ‰RIE (2 car.) + NUMÃ‰RO (7 chiffres)
    if (ref.length !== 9) {
      return { valid: false, error: "La rÃ©fÃ©rence doit contenir exactement 9 caractÃ¨res (2 lettres + 7 chiffres)" }
    }

    const serie = ref.substring(0, 2).toUpperCase()
    const numeroStr = ref.substring(2)

    // VÃ©rifier que la sÃ©rie correspond
    if (serie !== checkbook.serie.toUpperCase()) {
      return { 
        valid: false, 
        error: `La sÃ©rie "${serie}" ne correspond pas au chÃ©quier sÃ©lectionnÃ© (sÃ©rie attendue: "${checkbook.serie}")` 
      }
    }

    // VÃ©rifier que le numÃ©ro est bien un nombre
    const numero = parseInt(numeroStr, 10)
    if (isNaN(numero)) {
      return { valid: false, error: "Les 7 derniers caractÃ¨res doivent Ãªtre des chiffres" }
    }

    // VÃ©rifier que le numÃ©ro est dans l'intervalle du chÃ©quier
    if (numero < checkbook.startNumber || numero > checkbook.endNumber) {
      return { 
        valid: false, 
        error: `Le numÃ©ro ${numero} n'est pas dans l'intervalle du chÃ©quier (${checkbook.startNumber} - ${checkbook.endNumber})` 
      }
    }

    return { valid: true }
  }

  const handlePrintConfirmed = async () => {
    setIsPrinting(true)
    
    try {
      // Valider la rÃ©fÃ©rence avec le chÃ©quier
      const selectedCheckbook = checkbooks.find(cb => cb.id === parseInt(checkbookId))
      const validation = validateReference(reference, selectedCheckbook)
      
      if (!validation.valid) {
        toast({
          title: "âŒ Erreur de validation",
          description: validation.error,
          variant: "destructive"
        })
        setIsPrinting(false)
        return
      }

      // VÃ©rifier l'unicitÃ© de la rÃ©fÃ©rence
      const uniqueCheck = await checkReferenceUnique(reference)
      if (!uniqueCheck.unique) {
        toast({
          title: "âŒ RÃ©fÃ©rence dÃ©jÃ  utilisÃ©e",
          description: uniqueCheck.error,
          variant: "destructive"
        })
        setIsPrinting(false)
        return
      }

      // Sauvegarder le chÃ¨que dans la base de donnÃ©es
      await createCheck({
        userId: user.id.toString(),
        amount: parseAmountToNumber(amount) ?? 0,
        payee,
        city,
        date,
        reference,
        bank,
        checkbookId: checkbookId ? parseInt(checkbookId) : undefined
      })

      // GÃ©nÃ©rer et imprimer le PDF avec les positions de calibrage
      const currentBank = banks.find((b) => b.name === bank)
      const positions = currentBank?.positions
      const pdfUrl = currentBank?.pdfUrl

      if (positions && pdfUrl) {
        const normalizedPdfUrl = pdfUrl.startsWith("http")
          ? pdfUrl
          : `${API_BASE}${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`

        const pdfBytes = await generateCheckPDF({
          city: city,
          date: formatDateFR(date),
          payee,
          amount: amount || "",
          amountInWords,
          bankPdfUrl: normalizedPdfUrl,
          positions
        })
        const blob = new Blob([pdfBytes], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        setGeneratedPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })

        printCheckPDF(pdfBytes)
      } else {
        toast({
          title: "âš ï¸ Alerte",
          description: "PDF de la banque ou positions manquants, impression sautÃ©e",
        })
      }

      toast({
        title: "âœ“ SuccÃ¨s",
        description: "ChÃ¨que enregistrÃ© et PDF gÃ©nÃ©rÃ©",
      })

      // RÃ©initialiser le formulaire aprÃ¨s un dÃ©lai
      setTimeout(() => {
        setAmount("")
        setAmountInWords("")
        setPayee("")
        // Reset to appropriate default city based on user role
        if (isRegionalUser && regionCities.length > 0) {
          setCity(regionCities[0])
        } else {
          setCity("Alger")
        }
        setReference("")
        setIsPrinting(false)
        router.push("/cheque_dashbord")
      }, 1500)

    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Ã‰chec de l'impression",
        variant: "destructive",
      })
      setIsPrinting(false)
    }
  }

  const validBanks = banks.filter((b) => !!b.name && b.name.trim().length > 0)
  const selectedBank = validBanks.find((b) => b.name === bank)
  const isBankSelected = Boolean(bank)

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="bank">Banque</Label>
                <Select value={bank} onValueChange={setBank} required>
                  <SelectTrigger>
                    <SelectValue placeholder="SÃ©lectionner une banque" />
                  </SelectTrigger>
                  <SelectContent>
                      {validBanks.map((b) => (
                        <SelectItem key={b.id} value={b.name}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkbook">ChÃ©quier *</Label>
                <Select 
                  value={checkbookId} 
                  onValueChange={setCheckbookId} 
                  disabled={!isBankSelected || loadingCheckbooks}
                  required
                >
                  <SelectTrigger id="checkbook">
                    <SelectValue placeholder={loadingCheckbooks ? "Chargement..." : "SÃ©lectionner un chÃ©quier"} />
                  </SelectTrigger>
                  <SelectContent>
                    {checkbooks.map((cb) => (
                      <SelectItem key={cb.id} value={cb.id.toString()}>
                        {cb.serie} ({cb.agencyName}) - {cb.remaining} restants
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bank && checkbooks.length === 0 && !loadingCheckbooks && (
                  <p className="text-xs text-emerald-500">
                    Aucun chÃ©quier disponible
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Montant (DZD)</Label>
                <Input
                  id="amount"
                  type="text"
                  placeholder="10 000,00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  disabled={!isBankSelected}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amountInWords">Montant en lettres</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateWords}
                    className="h-8"
                    disabled={!isBankSelected || !amount}
                  >
                    <RefreshCcw className="mr-1 h-3 w-3" style={{ color: '#e82c2a' }} />
                    RÃ©gÃ©nÃ©rer
                  </Button>
                </div>
                <Textarea
                  id="amountInWords"
                  placeholder="dix mille dinars algÃ©riens"
                  value={amountInWords}
                  onChange={(e) => {
                    setAmountInWords(e.target.value)
                  }}
                  disabled={!isBankSelected}
                  rows={2}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payee">Ã€ l'ordre de</Label>
                <Select 
                  value={payee} 
                  onValueChange={setPayee} 
                  disabled={!isBankSelected}
                  required
                >
                  <SelectTrigger id="payee">
                    <SelectValue placeholder="SÃ©lectionner un bÃ©nÃ©ficiaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.name}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Wilaya</Label>
                  <Select value={city} onValueChange={setCity} required disabled={!isBankSelected}>
                    <SelectTrigger>
                      <SelectValue placeholder="SÃ©lectionner une wilaya" />
                    </SelectTrigger>
                    <SelectContent>
                      {VILLES.map((wilaya) => {
                        const isCityAllowed = !isRegionalUser || regionCities.includes(wilaya.name)
                        return (
                          <SelectItem 
                            key={wilaya.code} 
                            value={wilaya.name}
                            disabled={!isCityAllowed}
                            className={!isCityAllowed ? "text-gray-400 cursor-not-allowed" : ""}
                          >
                            {wilaya.code} - {wilaya.name} {!isCityAllowed && "(Non autorisÃ©)"}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={!isBankSelected}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">RÃ©fÃ©rence du chÃ¨que</Label>
                <Input
                  id="reference"
                  type="text"
                  placeholder="AA0000001"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={!checkbookId}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {checkbookId 
                    ? "Premier numÃ©ro disponible suggÃ©rÃ© automatiquement (modifiable)" 
                    : "SÃ©lectionnez un chÃ©quier pour obtenir le numÃ©ro disponible"}
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    // Validation avant impression
                    if (!amount || !payee || !city || !date || !bank) {
                      toast({
                        title: "âŒ Erreur",
                        description: "Veuillez remplir tous les champs obligatoires",
                        variant: "destructive"
                      })
                      return
                    }

                    // VÃ©rifier que le montant est un nombre valide
                    const numericAmount = parseAmountToNumber(amount)
                    if (numericAmount === null || numericAmount <= 0) {
                      toast({
                        title: "âŒ Erreur",
                        description: "Le montant doit Ãªtre un nombre valide et positif",
                        variant: "destructive"
                      })
                      return
                    }

                    // VÃ©rifier que le montant en lettres n'est pas vide
                    if (!amountInWords || amountInWords.trim().length === 0) {
                      toast({
                        title: "âŒ Erreur",
                        description: "Le montant en lettres est requis",
                        variant: "destructive"
                      })
                      return
                    }

                    // Toutes les validations sont OK, continuer avec l'impression
                    handlePrintClick()
                  }}
                  disabled={!amount || !payee || !city || !date || !bank}
                >
                  Imprimer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <CheckPreview
            amount={amount}
            amountInWords={amountInWords}
            payee={payee}
            city={city}
            date={date}
            reference={reference}
            bank={bank}
            showRectangles={true}
          />

          {generatedPdfUrl && (
            <Card ref={generatedPreviewRef}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">PDF gÃ©nÃ©rÃ©</h3>
                </div>
                <PDFViewer fileUrl={generatedPdfUrl} width={generatedPreviewWidth} className="w-full" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showPreview && selectedBank && (
        <div className="print-only">
          <PrintCheckCanvas
            positions={selectedBank.positions}
            values={{
              city,
              date: formatDateFR(date),
              payee,
              amount: amount || "",
              amountLine1: amountInWords,
              amountLine2: "",
            }}
          />
        </div>
      )}
    </>
  )
}
