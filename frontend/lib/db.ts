export interface User {
  id: string | number
  email: string
  password: string
  firstName: string
  lastName: string
  phoneNumber: string
  role: string
  direction: string
  region?: string
  isRegionalApprover?: boolean
  isFinanceApprover?: boolean
  accessModules?: string
  createdAt: string
}

export interface Check {
  reference: string // Clé primaire
  userId: string | number
  amount: number
  payee: string
  city: string
  date: string
  bank: string
  ville: string
  status: string
  motif?: string
  createdAt: string
  checkbookId?: number | null
}

export interface Bank {
  id: string
  code: string
  name: string
  pdfUrl?: string
  checkImage?: string
  template?: {
    city: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    date: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    payee: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    amountInWords: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    amountInWordsLine2?: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    amount: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    reference?: { x: number; y: number; width: number; fontSize: number; rotation?: number }
  }
  positionsJson?: string
  positions: {
    city: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    date: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    payee: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    amountInWords: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    amountInWordsLine2?: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    amount: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    reference?: { x: number; y: number; width: number; fontSize: number; rotation?: number }
    checkLayout?: {
      width: number
      height: number
      x: number
      y: number
      rotation: 0 | 90 | 180 | 270
    }
  }
  createdAt: string
}
