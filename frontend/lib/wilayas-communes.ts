export type WilayaCommuneEntry = {
  code: string
  wilaya: string
  communes: number[]
}

const WILAYAS_COMMUNES: WilayaCommuneEntry[] = [
  { code: "01A", wilaya: "ADRAR", communes: [] },
  { code: "16A", wilaya: "ALGER", communes: [] },
  { code: "31A", wilaya: "ORAN", communes: [] },
  { code: "19A", wilaya: "SETIF", communes: [] },
  { code: "25A", wilaya: "CONSTANTINE", communes: [] },
]

export default WILAYAS_COMMUNES
