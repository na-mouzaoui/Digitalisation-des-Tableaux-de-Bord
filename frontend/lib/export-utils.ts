import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Bank, Check, User } from "./db"
import { parseFlexibleDate } from "./date-utils"

const timestampSuffix = () => {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
}

const getBankCode = (bankNameOrCode: string, banks: Bank[]) => {
  const target = (bankNameOrCode || "").trim().toLowerCase()
  const found = banks.find(b => b.name.trim().toLowerCase() === target || b.code.trim().toLowerCase() === target)
  return found?.code || bankNameOrCode
}

export function exportToExcel(
  stats: {
    totalAmount: number
    totalChecks: number
    checksByBank: Record<string, number>
    amountByUser: Record<string, number>
  },
  checks: Check[],
  users: User[],
) {
  const wb = XLSX.utils.book_new()

  // Feuille 1: Statistiques gÃ©nÃ©rales
  const statsData = [
    ["Statistique", "Valeur"],
    ["Montant Total (DZD)", stats.totalAmount.toFixed(2)],
    ["Nombre de ChÃ¨ques", stats.totalChecks],
    ["Montant Moyen (DZD)", stats.totalChecks > 0 ? (stats.totalAmount / stats.totalChecks).toFixed(2) : "0"],
    ["Nombre de Banques", Object.keys(stats.checksByBank).length],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(statsData)
  XLSX.utils.book_append_sheet(wb, ws1, "Statistiques")

  // Feuille 2: ChÃ¨ques par banque
  const bankData = [["Banque", "Nombre de ChÃ¨ques"], ...Object.entries(stats.checksByBank)]
  const ws2 = XLSX.utils.aoa_to_sheet(bankData)
  XLSX.utils.book_append_sheet(wb, ws2, "Par Banque")

  // Feuille 3: Montant par utilisateur
  const userMap = users.reduce(
    (acc, user) => {
      acc[user.id] = user.email
      return acc
    },
    {} as Record<string, string>,
  )
  const userAmountData = [
    ["Utilisateur", "Montant Total (DZD)", "Nombre de ChÃ¨ques", "Montant Moyen (DZD)"],
    ...Object.entries(stats.amountByUser).map(([userId, amount]) => {
      const userChecks = checks.filter((c) => c.userId === userId)
      const avgAmount = userChecks.length > 0 ? amount / userChecks.length : 0
      return [userMap[userId] || "Inconnu", amount.toFixed(2), userChecks.length, avgAmount.toFixed(2)]
    }),
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(userAmountData)
  XLSX.utils.book_append_sheet(wb, ws3, "Par Utilisateur")

  // Feuille 4: Tous les chÃ¨ques
  const checksData = [
    ["Date", "Utilisateur", "Banque", "Montant (DZD)", "Ã€ l'ordre de", "Ville", "RÃ©fÃ©rence"],
    ...checks.map((check) => [
      new Date(check.createdAt).toLocaleString("fr-FR"),
      userMap[check.userId] || "Inconnu",
      check.bank,
      check.amount.toFixed(2),
      check.payee,
      check.city,
      check.reference || "N/A",
    ]),
  ]
  const ws4 = XLSX.utils.aoa_to_sheet(checksData)
  XLSX.utils.book_append_sheet(wb, ws4, "Tous les ChÃ¨ques")

  XLSX.writeFile(wb, `tableau_bord_cheques_${new Date().toISOString().split("T")[0]}.xlsx`)
}

export function exportStatsToPDF(
  stats: {
    totalAmount: number
    totalChecks: number
    checksByBank: Record<string, number>
    amountByUser: Record<string, number>
  },
  checks: Check[],
  users: User[],
) {
  const doc = new jsPDF()

  // Charger le logo
  const logo = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = "/logo_doc.png"
  })

  logo.then((logoImg) => {
    // Logo en haut Ã  droite
    if (logoImg) {
      const pageWidth = doc.internal.pageSize.getWidth()
      doc.addImage(logoImg, "PNG", pageWidth - 48, 8, 40, 20)
    }

    // Titre
    doc.setFontSize(18)
    doc.text("Tableau de Bord - Statistiques des ChÃ¨ques", 14, 22)

    // Date
    doc.setFontSize(10)
    doc.text(`GÃ©nÃ©rÃ© le: ${new Date().toLocaleString("fr-FR")}`, 14, 30)

    // Statistiques gÃ©nÃ©rales
    doc.setFontSize(14)
    doc.text("Statistiques GÃ©nÃ©rales", 14, 42)

    const statsTable = [
      ["Montant Total", `${stats.totalAmount.toFixed(2)} DZD`],
      ["Nombre de ChÃ¨ques", stats.totalChecks.toString()],
      ["Montant Moyen", stats.totalChecks > 0 ? `${(stats.totalAmount / stats.totalChecks).toFixed(2)} DZD` : "0 DZD"],
      ["Nombre de Banques", Object.keys(stats.checksByBank).length.toString()],
    ]

    autoTable(doc, {
      startY: 46,
      head: [["Statistique", "Valeur"]],
      body: statsTable,
      theme: "grid",
    })

    // ChÃ¨ques par banque
    doc.addPage()
    if (logoImg) {
      const pageWidth = doc.internal.pageSize.getWidth()
      doc.addImage(logoImg, "PNG", pageWidth - 48, 8, 40, 20)
    }
    doc.setFontSize(14)
    doc.text("RÃ©partition par Banque", 14, 22)

    const bankTable = Object.entries(stats.checksByBank).map(([bank, count]) => [bank, count.toString()])

    autoTable(doc, {
      startY: 28,
      head: [["Banque", "Nombre de ChÃ¨ques"]],
      body: bankTable,
      theme: "grid",
    })

    // Montant par utilisateur
    doc.addPage()
    if (logoImg) {
      const pageWidth = doc.internal.pageSize.getWidth()
      doc.addImage(logoImg, "PNG", pageWidth - 48, 8, 40, 20)
    }
    doc.setFontSize(14)
    doc.text("Montant par Utilisateur", 14, 22)

    const userMap = users.reduce(
      (acc, user) => {
        acc[user.id] = user.email
        return acc
      },
      {} as Record<string, string>,
    )

    const userTable = Object.entries(stats.amountByUser).map(([userId, amount]) => {
      const userChecks = checks.filter((c) => c.userId === userId)
      const avgAmount = userChecks.length > 0 ? amount / userChecks.length : 0
      return [
        userMap[userId] || "Inconnu",
        `${amount.toFixed(2)} DZD`,
        userChecks.length.toString(),
        `${avgAmount.toFixed(2)} DZD`,
      ]
    })

    autoTable(doc, {
      startY: 28,
      head: [["Utilisateur", "Montant Total", "Nombre", "Montant Moyen"]],
      body: userTable,
      theme: "grid",
    })

    doc.save(`statistiques_cheques_${timestampSuffix()}.pdf`)
  })
}

export function exportHistoryToPDF(checks: Check[], users: User[], banks: Bank[] = []) {
  const doc = new jsPDF({ orientation: "landscape" })

  // Charger le logo
  const logo = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = "/logo_doc.png"
  })

  logo.then((logoImg) => {
    // Logo en haut Ã  droite
    if (logoImg) {
      const pageWidth = doc.internal.pageSize.getWidth()
      doc.addImage(logoImg, "PNG", pageWidth - 48, 8, 40, 20)
    }

    // Titre
    doc.setFontSize(18)
    doc.text("Historique des ChÃ¨ques", 14, 22)

    // Date
    doc.setFontSize(10)
    doc.text(`GÃ©nÃ©rÃ© le: ${new Date().toLocaleString("fr-FR")}`, 14, 30)

    const userMap = users.reduce(
      (acc, user) => {
        acc[user.id] = user.email
        return acc
      },
      {} as Record<string, string>,
    )

    // Aligner avec les colonnes Excel (mÃªme ordre)
    const sortedChecks = [...checks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const checksData = sortedChecks.map((check, index) => {
      const createdDate = new Date(check.createdAt)
      const emissionDate = parseFlexibleDate(check.date)
      const bankCode = getBankCode(check.bank, banks)
      return [
        index + 1,
        check.reference || "â€”",
        createdDate.toLocaleDateString("fr-FR", { year: "2-digit", month: "2-digit", day: "2-digit" }),
        createdDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        emissionDate ? emissionDate.toLocaleDateString("fr-FR", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "",
        userMap[check.userId] || "Inconnu",
        bankCode,
        check.payee,
        check.city,
        `${check.amount.toFixed(2)} DZD`,
        check.status || "emit",
        check.motif || "",
      ]
    })

    autoTable(doc, {
      startY: 38,
      head: [[
        "NÂ°",
        "RÃ©fÃ©rence",
        "Date CrÃ©ation",
        "Heure CrÃ©ation",
        "Date",
        "Utilisateur",
        "Banque",
        "BÃ©nÃ©ficiaire",
        "Ville",
        "Montant",
        "Statut",
        "Motif"
      ]],
      body: checksData,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [232, 44, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    })

    doc.save(`historique_cheques_${timestampSuffix()}.pdf`)
  })
}

export function exportHistoryToExcel(checks: Check[], users: User[], banks: Bank[] = []) {
  const wb = XLSX.utils.book_new()

  const userMap = users.reduce(
    (acc, user) => {
      acc[user.id] = user.email
      return acc
    },
    {} as Record<string, string>,
  )

  // Trier les chÃ¨ques par date de crÃ©ation (plus rÃ©cents en premier)
  const sortedChecks = [...checks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  // En-tÃªte avec toutes les colonnes
  const checksData = [
    [
      "NÂ°", 
      "RÃ©fÃ©rence", 
      "Date CrÃ©ation", 
      "Heure CrÃ©ation",
      "Date Ã‰mission",
      "Utilisateur", 
      "Banque", 
      "BÃ©nÃ©ficiaire (Ã€ l'ordre de)", 
      "Ville",
      "Montant (DZD)", 
      "Statut",
      "Motif",
    ],
    ...sortedChecks.map((check, index) => {
      const createdDate = new Date(check.createdAt)
      const emissionDate = parseFlexibleDate(check.date)
      return [
        index + 1, // NumÃ©ro de ligne
        check.reference || "â€”",
          createdDate.toLocaleDateString("fr-FR", { year: '2-digit', month: '2-digit', day: '2-digit' }),
        createdDate.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' }),
          emissionDate ? emissionDate.toLocaleDateString("fr-FR", { year: '2-digit', month: '2-digit', day: '2-digit' }) : "",
        userMap[check.userId] || "Inconnu",
          getBankCode(check.bank, banks),
        check.payee,
        check.city,
        check.amount,
        check.status || "emit",
        check.motif || "",
      ]
    }),
  ]

  const ws = XLSX.utils.aoa_to_sheet(checksData)

  // DÃ©finir les largeurs de colonnes optimisÃ©es
  ws['!cols'] = [
    { wch: 5 },   // NÂ°
    { wch: 18 },  // RÃ©fÃ©rence
    { wch: 13 },  // Date CrÃ©ation
    { wch: 10 },  // Heure CrÃ©ation
    { wch: 13 },  // Date Ã‰mission
    { wch: 28 },  // Utilisateur
    { wch: 18 },  // Banque
    { wch: 30 },  // BÃ©nÃ©ficiaire
    { wch: 15 },  // Ville
    { wch: 16 },  // Montant
    { wch: 12 },  // Statut
    { wch: 28 },  // Motif
  ]

  // Style de l'en-tÃªte avec couleur verte de l'entreprise
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill: { fgColor: { rgb: "e82c2a" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "medium", color: { rgb: "7f1d1d" } },
      bottom: { style: "medium", color: { rgb: "7f1d1d" } },
      left: { style: "thin", color: { rgb: "7f1d1d" } },
      right: { style: "thin", color: { rgb: "7f1d1d" } },
    },
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  
  // Appliquer le style Ã  l'en-tÃªte
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
    if (!ws[cellAddress]) continue
    ws[cellAddress].s = headerStyle
  }

  // DÃ©finir la hauteur de l'en-tÃªte
  ws['!rows'] = [{ hpt: 30 }]

  // Appliquer des styles aux lignes de donnÃ©es
  for (let row = 1; row <= range.e.r; row++) {
    const isEvenRow = row % 2 === 0
    
    // Calculer le total pour ajouter une ligne de total Ã  la fin
    const isLastRow = row === range.e.r
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      if (!ws[cellAddress]) continue
      
      // Style de base pour toutes les cellules
      const baseStyle = {
        fill: { fgColor: { rgb: isEvenRow ? "f9fafb" : "FFFFFF" } },
        alignment: { vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "d1d5db" } },
          bottom: { style: "thin", color: { rgb: "d1d5db" } },
          left: { style: "thin", color: { rgb: "d1d5db" } },
          right: { style: "thin", color: { rgb: "d1d5db" } },
        },
      }

      // Colonne NÂ° (0) - centrÃ©
      if (col === 0) {
        ws[cellAddress].s = {
          ...baseStyle,
          font: { bold: true, sz: 10 },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: isEvenRow ? "e5e7eb" : "f3f4f6" } },
        }
      }
      // Colonne RÃ©fÃ©rence (1) - centrÃ©, police mono
      else if (col === 1) {
        ws[cellAddress].s = {
          ...baseStyle,
          font: { name: "Courier New", sz: 10 },
          alignment: { horizontal: "center", vertical: "center" },
        }
      }
      // Colonnes Date et Heure (2, 3, 4) - centrÃ©
      else if (col === 2 || col === 3 || col === 4) {
        ws[cellAddress].s = {
          ...baseStyle,
          alignment: { horizontal: "center", vertical: "center" },
          font: { sz: 10 },
        }
      }
      // Colonne Utilisateur (5)
      else if (col === 5) {
        ws[cellAddress].s = {
          ...baseStyle,
          alignment: { horizontal: "left", vertical: "center" },
          font: { sz: 10 },
        }
      }
      // Colonne Banque (6) - centrÃ©
      else if (col === 6) {
        ws[cellAddress].s = {
          ...baseStyle,
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true, sz: 10 },
          fill: { fgColor: { rgb: isEvenRow ? "dbeafe" : "eff6ff" } },
        }
      }
      // Colonne BÃ©nÃ©ficiaire (7)
      else if (col === 7) {
        ws[cellAddress].s = {
          ...baseStyle,
          alignment: { horizontal: "left", vertical: "center" },
          font: { sz: 10 },
        }
      }
      // Colonne Ville (8) - centrÃ©
      else if (col === 8) {
        ws[cellAddress].s = {
          ...baseStyle,
          alignment: { horizontal: "center", vertical: "center" },
          font: { sz: 10 },
        }
      }
      // Colonne Montant (9) - alignÃ© Ã  droite, vert, gras
      else if (col === 9) {
        ws[cellAddress].s = {
          ...baseStyle,
          numFmt: "#,##0.00\" DZD\"",
          font: { bold: true, color: { rgb: "2db34b" }, sz: 11 },
          alignment: { horizontal: "right", vertical: "center" },
          fill: { fgColor: { rgb: isEvenRow ? "f0fdf4" : "f7fee7" } },
        }
      }
      // Colonne Statut (10)
      else if (col === 10) {
        ws[cellAddress].s = {
          ...baseStyle,
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true, sz: 10, color: { rgb: "e82c2a" } },
          fill: { fgColor: { rgb: isEvenRow ? "fff1f2" : "ffe4e6" } },
        }
      }
      // Colonne Motif (11)
      else if (col === 11) {
        ws[cellAddress].s = {
          ...baseStyle,
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          font: { sz: 10 },
        }
      }
    }
  }

  // Ajouter une ligne de total
  const totalRow = range.e.r + 2
  const totalAmount = sortedChecks.reduce((sum, check) => sum + check.amount, 0)
  
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 7 })] = { v: "TOTAL GÃ‰NÃ‰RAL:", t: "s" }
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 9 })] = { v: totalAmount, t: "n" }
  
  // Style pour la ligne de total
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 7 })].s = {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "right", vertical: "center" },
    fill: { fgColor: { rgb: "2db34b" } },
    border: {
      top: { style: "medium", color: { rgb: "000000" } },
      bottom: { style: "medium", color: { rgb: "000000" } },
      left: { style: "medium", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  }
  
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 9 })].s = {
    numFmt: "#,##0.00\" DZD\"",
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
    alignment: { horizontal: "right", vertical: "center" },
    fill: { fgColor: { rgb: "2db34b" } },
    border: {
      top: { style: "medium", color: { rgb: "000000" } },
      bottom: { style: "medium", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "medium", color: { rgb: "000000" } },
    },
  }

  // Fusionner les cellules pour le label "TOTAL GÃ‰NÃ‰RAL"
  if (!ws['!merges']) ws['!merges'] = []
  ws['!merges'].push({
    s: { r: totalRow, c: 7 },
    e: { r: totalRow, c: 8 }
  })

  XLSX.utils.book_append_sheet(wb, ws, "Historique Complet")

  XLSX.writeFile(wb, `historique_cheques_complet_${timestampSuffix()}.xlsx`)
}
