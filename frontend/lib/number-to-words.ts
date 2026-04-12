export function numberToWordsFR(num: number): string {
  if (!Number.isFinite(num)) return "montant invalide"
  if (num === 0) return "zéro DA"
  if (num < 0) return "montant invalide"
  if (num > Number.MAX_SAFE_INTEGER) return "montant trop élevé"

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"]
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"]
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"]

  function convertUnderHundred(n: number): string {
    if (n === 0) return ""
    if (n < 10) return units[n]
    if (n < 20) return teens[n - 10]
    
    const ten = Math.floor(n / 10)
    const unit = n % 10
    
    // 70-79: soixante-dix, soixante et onze, etc.
    if (n >= 70 && n < 80) {
      if (n === 71) return "soixante et onze"
      if (unit === 0) return "soixante-dix"
      return "soixante-" + teens[unit]
    }
    
    // 80-99: quatre-vingt(s), quatre-vingt-un, etc.
    if (n >= 80) {
      if (n === 80) return "quatre-vingts"
      if (n < 90) return "quatre-vingt-" + units[unit]
      // Pour 90-99, on utilise les teens (dix, onze, douze... dix-neuf)
      if (n === 91) return "quatre-vingt-onze"
      if (unit === 0) return "quatre-vingt-dix"
      return "quatre-vingt-" + teens[unit]
    }
    
    // 20-69
    if (unit === 0) return tens[ten]
    if (unit === 1 && ten < 8) return tens[ten] + " et un"
    return tens[ten] + "-" + units[unit]
  }

  function convertUnderThousand(n: number): string {
    if (n === 0) return ""
    if (n < 100) return convertUnderHundred(n)
    
    const hundreds = Math.floor(n / 100)
    const remainder = n % 100
    
    let result = ""
    if (hundreds === 1) {
      result = "cent"
    } else {
      result = units[hundreds] + " cent"
      if (remainder === 0) result += "s"
    }
    
    if (remainder > 0) {
      result += " " + convertUnderHundred(remainder)
    }
    
    return result
  }

  function convertUnderMillion(n: number): string {
    if (n < 1000) return convertUnderThousand(n)
    
    const thousands = Math.floor(n / 1000)
    const remainder = n % 1000
    
    let result = ""
    if (thousands === 1) {
      result = "mille"
    } else {
      result = convertUnderThousand(thousands) + " mille"
    }
    
    if (remainder > 0) {
      result += " " + convertUnderThousand(remainder)
    }
    
    return result
  }

  function convertUnderBillion(n: number): string {
    if (n < 1000000) return convertUnderMillion(n)
    
    const millions = Math.floor(n / 1000000)
    const remainder = n % 1000000
    
    let result = ""
    if (millions === 1) {
      result = "un million"
    } else {
      result = convertUnderMillion(millions) + " millions"
    }
    
    if (remainder > 0) {
      result += " " + convertUnderMillion(remainder)
    }
    
    return result
  }

  function convertNumber(n: number): string {
    if (n < 1000000000) return convertUnderBillion(n)
    
    const billions = Math.floor(n / 1000000000)
    const remainder = n % 1000000000
    
    let result = ""
    if (billions === 1) {
      result = "un milliard"
    } else {
      result = convertUnderBillion(billions) + " milliards"
    }
    
    if (remainder > 0) {
      result += " " + convertUnderBillion(remainder)
    }
    
    return result
  }

  // Séparer partie entière et décimale
  let integerPart = Math.floor(num)
  let decimalPart = Math.round((num - integerPart + Number.EPSILON) * 100)

  if (decimalPart === 100) {
    integerPart += 1
    decimalPart = 0
  }

  let result = integerPart === 0 ? "zéro" : convertNumber(integerPart)

  // Ajouter la devise
  result += " DA"

  // Ajouter les centimes (uniquement si > 0), en chiffres
  if (decimalPart > 0) {
    const centimes = String(decimalPart).padStart(2, "0")
    result += " et " + centimes + " cts"
  }

  // Mettre la première lettre en majuscule
  const finalResult = result.trim()
  return finalResult.charAt(0).toUpperCase() + finalResult.slice(1)
}
