/** Epoch milliseconds. Centralised so a single clock source can be swapped in later. */
export function now(): number {
  return Date.now()
}
