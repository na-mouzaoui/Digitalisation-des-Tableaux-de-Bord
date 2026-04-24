// Check template configuration for different Algerian banks
// Users can provide PDF scans which will be used as background images

export interface FieldPosition {
  x: number // Position horizontale (px)
  y: number // Position verticale (px)
  width: number // Largeur disponible pour le champ (px)
  fontSize: number // Taille de la police (px)
  rotation: number // Rotation en degrés (optionnel)
}

export interface CheckTemplate {
  bankCode: string
  bankName: string
  imageUrl?: string // Will be populated when user uploads bank check scan
  // Position coordinates for each field with width and font size
  positions: {
    city: FieldPosition
    date: FieldPosition
    payee: FieldPosition
    amountInWords: FieldPosition
    amountInWordsLine2?: FieldPosition // Optional second line
    amount: FieldPosition
    reference?: FieldPosition
  }
}

// Default templates - positions can be adjusted when user provides actual check scans
export const checkTemplates: Record<string, CheckTemplate> = {
  BNA: {
    bankCode: "BNA",
    bankName: "BNA - Banque Nationale d'Algérie",
    positions: {
      city: { x: 301, y: 215, width: 80, fontSize: 14, rotation: 270 },
      date: { x: 301, y: 125, width: 78, fontSize: 13, rotation: 270 },
      payee: { x: 277, y: 417, width: 360, fontSize: 14, rotation: 270 },
      amountInWords: { x: 241, y: 369, width: 295, fontSize: 12, rotation: 270 },
      amount: { x: 209, y: 94, width: 88, fontSize: 15, rotation: 270 },
      
    },
  },
  CCP: {
    bankCode: "CCP",
    bankName: "CCP - Caisse Centrale de la Poste",
    positions: {
      city: { x: 301, y: 215, width: 80, fontSize: 14, rotation: 270 },
      date: { x: 301, y: 125, width: 78, fontSize: 13, rotation: 270 },
      payee: { x: 277, y: 417, width: 360, fontSize: 14, rotation: 270 },
      amountInWords: { x: 241, y: 369, width: 295, fontSize: 12, rotation: 270 },
      amount: { x: 209, y: 94, width: 88, fontSize: 15, rotation: 270 },
    },
  },
  
}

export function getCheckTemplate(bankName: string): CheckTemplate | undefined {
  // Try to find by full name first
  const template = Object.values(checkTemplates).find((t) => t.bankName === bankName)
  if (template) return template

  // Try to find by bank code
  const bankCode = bankName.split(" ")[0] // Extract code like "BNA" from "BNA - Banque..."
  return checkTemplates[bankCode]
}
