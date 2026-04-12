"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface PrintConfirmationDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PrintConfirmationDialog({ open, onConfirm, onCancel }: PrintConfirmationDialogProps) {
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = () => {
    if (confirmed) {
      onConfirm()
      setConfirmed(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Instructions d'impression</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="rounded-lg border bg-muted p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                1
              </div>
              <p className="font-semibold">Positionnement du chèque</p>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-white">
              <svg viewBox="0 0 400 200" className="h-full w-full">
                {/* Printer representation */}
                <rect x="50" y="20" width="300" height="160" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
                <rect x="60" y="30" width="280" height="10" fill="#6b7280" />

                {/* Paper tray */}
                <rect x="70" y="50" width="260" height="120" fill="white" stroke="#9ca3af" strokeWidth="2" />

                {/* Check positioning */}
                <rect x="90" y="70" width="220" height="80" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
                <text x="200" y="115" textAnchor="middle" fill="#92400e" fontSize="14" fontWeight="bold">
                  CHÈQUE
                </text>

                {/* Arrow indicators */}
                <path d="M 35 110 L 70 110" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" />
                <path d="M 365 110 L 330 110" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" />

                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
                  </marker>
                </defs>
              </svg>
            </div>
            
          </div>

          <div className="rounded-lg border bg-muted p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                2
              </div>
              <p className="font-semibold">Paramètres d'impression</p>
            </div>
          </div>

          <div className="flex items-start space-x-2 rounded-lg border p-4">
            <Checkbox id="confirm" checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="confirm"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                J'ai vérifié que toutes les informations sont correctes
              </Label>
              
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!confirmed}>
            Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
