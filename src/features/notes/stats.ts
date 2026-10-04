/** Word counts for the editor status bar. Whitespace-only text is zero words. */
export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}
