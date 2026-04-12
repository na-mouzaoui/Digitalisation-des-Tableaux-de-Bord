"use client"

import { useState } from "react"
import { CalibrationTool } from "./calibration-tool"
import { CheckbookManagement } from "./checkbook-management"
import { SupplierManagement } from "./supplier-management"

type ParametersPanelProps = {
  preSelectedBankId?: string
}

export function ParametersPanel({ preSelectedBankId }: ParametersPanelProps) {
  const [banksVersion, setBanksVersion] = useState(0)

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Gestion des chéquiers</h2>
        </div>
        <CheckbookManagement />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Gestion des fournisseurs</h2>
        </div>
        <SupplierManagement />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Calibrage des chèques</h2>
          <p className="text-muted-foreground">Ajustez la position des champs sur les modèles PDF.</p>
        </div>
        <CalibrationTool refreshKey={banksVersion} preSelectedBankId={preSelectedBankId} />
      </section>
    </div>
  )
}
