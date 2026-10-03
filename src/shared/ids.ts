/** Stable, collision-resistant ids. UUIDv4 from the platform CSPRNG. */
export function newId(): string {
  return crypto.randomUUID()
}
