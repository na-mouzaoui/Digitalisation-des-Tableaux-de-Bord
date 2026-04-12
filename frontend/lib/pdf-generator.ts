import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib"
import type { Bank } from "./db"

interface CheckData {
  city: string
  date: string
  payee: string
  amount: string
  amountInWords: string
  bankPdfUrl: string
  positions: Bank["positions"]
}

/**
 * Génère un PDF avec uniquement le texte de remplissage du chèque (sans le fond)
 * pour impression sur un chèque physique vierge
 * 
 * LOGIQUE DE COORDONNÉES:
 * - Canvas (calibrage): Origine top-left (0,0 en haut à gauche), Y vers le bas, en pixels
 * - PDF: Origine bottom-left (0,0 en bas à gauche), Y vers le haut, en points
 * - checkLayout définit un rectangle qui reste fixe (ne tourne pas)
 * - Les champs à l'intérieur tournent selon checkLayout.rotation
 * - Rotation autour du coin top-left du checkLayout (dans le système canvas)
 */
export async function generateCheckPDF(data: CheckData): Promise<Uint8Array> {
  // Créer un PDF vierge avec les dimensions A4 (sans fond de chèque)
  const pdfDoc = await PDFDocument.create()
  
  // Charger le PDF de la banque uniquement pour obtenir les dimensions
  const existingPdfBytes = await fetch(data.bankPdfUrl).then(res => res.arrayBuffer())
  const templateDoc = await PDFDocument.load(existingPdfBytes)
  const templatePage = templateDoc.getPages()[0]
  const { width: templateWidth, height: templateHeight } = templatePage.getSize()
  
  // Créer une page vierge avec les mêmes dimensions
  const page = pdfDoc.addPage([templateWidth, templateHeight])

  // Charger les polices
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Fonction pour diviser le montant en lettres si nécessaire
  const splitAmountInWords = (text: string, maxWidth: number, fontSize: number): { line1: string; line2: string } => {
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    
    if (textWidth <= maxWidth) {
      return { line1: text, line2: "" }
    }

    // Trouver le dernier espace avant la limite
    const words = text.split(" ")
    let line1 = ""
    let line2 = ""
    let currentWidth = 0

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const wordWidth = font.widthOfTextAtSize(word + " ", fontSize)
      
      if (currentWidth + wordWidth <= maxWidth) {
        line1 += word + " "
        currentWidth += wordWidth
      } else {
        line2 = words.slice(i).join(" ")
        break
      }
    }

    return {
      line1: line1.trim(),
      line2: line2.trim()
    }
  }

  const { line1: amountLine1, line2: amountLine2 } = data.positions.amountInWordsLine2
    ? splitAmountInWords(data.amountInWords, data.positions.amountInWords.width, data.positions.amountInWords.fontSize)
    : { line1: data.amountInWords, line2: "" }

  // Convertit un point (origine top-left du document) en coordonnées PDF (origine bottom-left)
  const toPdfCoords = (absX: number, absY: number) => {
    return { x: absX, y: templateHeight - absY }
  }

  /**
   * Convertit une position du système canvas vers le système PDF (origine page).
   * La rotation se fait autour du coin TOP-LEFT du champ (comme dans l'aperçu CSS).
   * transformOrigin: 'top left' dans le canvas = rotation autour de (x, y)
   */
  const convertPosition = (
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    text: string, 
    fontSize: number, 
    currentFont: any,
    rotationDeg?: number
  ) => {
    const pdf = toPdfCoords(x, y)
    
    // Calculer la largeur du texte pour le centrage horizontal
    const textWidth = currentFont.widthOfTextAtSize(text, fontSize)
    
    // Position centrée dans le champ (avant rotation)
    const centeredX = pdf.x + (width - textWidth) / 2
    const centeredY = pdf.y - height / 2 - fontSize * 0.3 - 4
    
    // Si pas de rotation, retourner la position centrée
    if (!rotationDeg || rotationDeg === 0) {
      return { x: centeredX, y: centeredY }
    }
    
    // Avec rotation : calculer la position après rotation autour du coin TOP-LEFT (pdf.x, pdf.y)
    // Le texte doit être centré dans le champ AVANT rotation
    const relX = centeredX - pdf.x  // Distance horizontale du texte par rapport au coin
    const relY = centeredY - pdf.y  // Distance verticale du texte par rapport au coin
    
    // Appliquer la rotation autour du coin TOP-LEFT du champ
    const angleRad = -(rotationDeg * Math.PI) / 180  // Négatif car rotation inverse en PDF
    const rotatedRelX = relX * Math.cos(angleRad) - relY * Math.sin(angleRad)
    const rotatedRelY = relX * Math.sin(angleRad) + relY * Math.cos(angleRad)
    
    // Position finale après rotation
    return { 
      x: pdf.x + rotatedRelX, 
      y: pdf.y + rotatedRelY 
    }
  }

  /**
   * Obtient l'angle de rotation pour le texte dans le PDF (par champ)
   * Rotation autour du point de départ du texte
   */
  const getTextRotation = (rotationDeg?: number) => {
    if (!rotationDeg || rotationDeg === 0) return undefined
    // Appliquer la rotation du texte lui-même (indépendamment de la position)
    return degrees(-rotationDeg)
  }

  const cityPos = convertPosition(
    data.positions.city.x, 
    data.positions.city.y, 
    data.positions.city.width,
    data.positions.city.fontSize * 1.2, // hauteur approximative
    data.city,
    data.positions.city.fontSize,
    font,
    data.positions.city.rotation
  )
  page.drawText(data.city, {
    x: cityPos.x,
    y: cityPos.y,
    size: data.positions.city.fontSize,
    font: font,
    color: rgb(0, 0, 0),
    rotate: getTextRotation(data.positions.city.rotation)
  })

  const datePos = convertPosition(
    data.positions.date.x, 
    data.positions.date.y, 
    data.positions.date.width,
    data.positions.date.fontSize * 1.2,
    data.date,
    data.positions.date.fontSize,
    font,
    data.positions.date.rotation
  )
  page.drawText(data.date, {
    x: datePos.x,
    y: datePos.y,
    size: data.positions.date.fontSize,
    font: font,
    color: rgb(0, 0, 0),
    rotate: getTextRotation(data.positions.date.rotation)
  })

  const payeePos = convertPosition(
    data.positions.payee.x, 
    data.positions.payee.y, 
    data.positions.payee.width,
    data.positions.payee.fontSize * 1.2,
    data.payee,
    data.positions.payee.fontSize,
    font,
    data.positions.payee.rotation
  )
  page.drawText(data.payee, {
    x: payeePos.x,
    y: payeePos.y,
    size: data.positions.payee.fontSize,
    font: font,
    color: rgb(0, 0, 0),
    rotate: getTextRotation(data.positions.payee.rotation)
  })

  const amountWordsPos = convertPosition(
    data.positions.amountInWords.x, 
    data.positions.amountInWords.y, 
    data.positions.amountInWords.width,
    data.positions.amountInWords.fontSize * 1.2,
    amountLine1,
    data.positions.amountInWords.fontSize,
    font,
    data.positions.amountInWords.rotation
  )
  page.drawText(amountLine1, {
    x: amountWordsPos.x,
    y: amountWordsPos.y,
    size: data.positions.amountInWords.fontSize,
    font: font,
    color: rgb(0, 0, 0),
    maxWidth: data.positions.amountInWords.width,
    rotate: getTextRotation(data.positions.amountInWords.rotation)
  })

  // Montant en lettres - Ligne 2 (si activée)
  if (data.positions.amountInWordsLine2 && amountLine2) {
    const amountWords2Pos = convertPosition(
      data.positions.amountInWordsLine2.x, 
      data.positions.amountInWordsLine2.y, 
      data.positions.amountInWordsLine2.width,
      data.positions.amountInWordsLine2.fontSize * 1.2,
      amountLine2,
      data.positions.amountInWordsLine2.fontSize,
      font,
      data.positions.amountInWordsLine2.rotation
    )
    page.drawText(amountLine2, {
      x: amountWords2Pos.x,
      y: amountWords2Pos.y,
      size: data.positions.amountInWordsLine2.fontSize,
      font: font,
      color: rgb(0, 0, 0),
      maxWidth: data.positions.amountInWordsLine2.width,
      rotate: getTextRotation(data.positions.amountInWordsLine2.rotation)
    })
  }

  const amountPos = convertPosition(
    data.positions.amount.x, 
    data.positions.amount.y, 
    data.positions.amount.width,
    data.positions.amount.fontSize * 1.2,
    data.amount,
    data.positions.amount.fontSize,
    fontBold,
    data.positions.amount.rotation
  )
  page.drawText(data.amount, {
    x: amountPos.x,
    y: amountPos.y,
    size: data.positions.amount.fontSize,
    font: fontBold,
    color: rgb(0, 0, 0),
    rotate: getTextRotation(data.positions.amount.rotation)
  })

  // Sérialiser le PDF
  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}

/**
 * Ouvre le PDF dans une nouvelle fenêtre pour impression
 */
export function printCheckPDF(pdfBytes: Uint8Array) {
  // Créer un Blob à partir des bytes du PDF
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  
  // Ouvrir dans une nouvelle fenêtre
  const printWindow = window.open(url, "_blank")
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
      // Nettoyer l'URL après un délai
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } else {
    // Si le popup est bloqué, télécharger le fichier
    const link = document.createElement("a")
    link.href = url
    link.download = "cheque.pdf"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/**
 * Télécharge le PDF généré
 */
export function downloadCheckPDF(pdfBytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.pdf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
