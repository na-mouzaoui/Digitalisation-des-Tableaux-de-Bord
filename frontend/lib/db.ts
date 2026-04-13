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
