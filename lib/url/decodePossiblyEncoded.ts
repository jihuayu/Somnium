export function decodePossiblyEncoded(value: string, maxPasses = 2): string {
  let decoded = value

  for (let i = 0; i < maxPasses; i += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      break
    }
  }

  return decoded
}
