"use client"

type ParametersPanelProps = {
  preSelectedBankId?: string
}

export function ParametersPanel({ preSelectedBankId }: ParametersPanelProps) {
  void preSelectedBankId

  return (
    <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
      Aucun paramétre disponible.
    </div>
  )
}
