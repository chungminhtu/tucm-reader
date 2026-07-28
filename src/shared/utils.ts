import type { FontSettings } from './types'
import { DEFAULT_SETTINGS, DEFAULT_FEATURES } from './constants'

export function normalizeSettings(raw: Partial<FontSettings>): FontSettings {
  const features: typeof DEFAULT_FEATURES = {
    ...DEFAULT_FEATURES,
    ...(raw.features ?? {}),
  }

  const allowedDomains = Array.isArray(raw.allowedDomains)
    ? raw.allowedDomains
        .filter((domain): domain is string => typeof domain === 'string' && domain.trim().length > 0)
        .map((domain) => domain.trim().toLowerCase())
    : []

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    features,
    allowedDomains,
  }
}

export function isDomainAllowed(hostname: string, allowedDomains: string[]): boolean {
  return Array.isArray(allowedDomains) && allowedDomains.includes(hostname.toLowerCase())
}

export function parseHostname(input?: string | null): string | null {
  if (!input) return null
  try {
    const url = new URL(input)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.hostname.toLowerCase()
    }
  } catch {
    // ignore parse failures
  }
  return null
}

export function sanitizeDomains(domains: string[]): string[] {
  return Array.from(
    new Set(
      domains
        .map((domain) => domain.trim().toLowerCase())
        .filter((domain) => domain.length > 0)
    )
  )
}

