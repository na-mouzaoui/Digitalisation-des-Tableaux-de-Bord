import type { DomainKey } from "@/lib/tableau-domain-steps"

export const DOMAIN_IDS: Record<DomainKey, number> = {
  commercial: 1,
  DVDRS: 2,
  DQRPC: 3,
  Support: 4,
  finances: 5,
  regionale: 6,
}

export const DOMAIN_ID_TO_KEY: Record<number, DomainKey> = {
  1: "commercial",
  2: "DVDRS",
  3: "DQRPC",
  4: "Support",
  5: "finances",
  6: "regionale",
}

export function isDomainAllowed(domainKey: DomainKey, allowedDomaines: number[]): boolean {
  if (!allowedDomaines || allowedDomaines.length === 0) return true
  const domainId = DOMAIN_IDS[domainKey]
  return allowedDomaines.includes(domainId)
}

export function filterAllowedDomains(
  links: { name: string; href: string; domainKey: DomainKey }[],
  allowedDomaines: number[]
): { name: string; href: string; domainKey: DomainKey }[] {
  if (!allowedDomaines || allowedDomaines.length === 0) return links
  return links.filter((link) => allowedDomaines.includes(DOMAIN_IDS[link.domainKey]))
}
