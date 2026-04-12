export function splitAmountInWords(text: string, maxWidth: number, fontSize: number): { line1: string; line2: string } {
  if (!text) return { line1: "", line2: "" }

  // Approximate character width based on font size
  const avgCharWidth = fontSize * 0.6
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth)

  // If text fits in one line, return it
  if (text.length <= maxCharsPerLine) {
    return { line1: text, line2: "" }
  }

  // Split at the last space before maxCharsPerLine
  const words = text.split(" ")
  let line1 = ""
  let line2 = ""
  let currentLength = 0

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const wordLength = word.length + (line1 ? 1 : 0) // +1 for space

    if (currentLength + wordLength <= maxCharsPerLine) {
      line1 += (line1 ? " " : "") + word
      currentLength += wordLength
    } else {
      // Start second line with remaining words
      line2 = words.slice(i).join(" ")
      break
    }
  }

  return { line1, line2 }
}
