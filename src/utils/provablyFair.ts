/**
 * Provably Fair utilities using Web Crypto API (crypto.subtle)
 * Compatible with Cloudflare Workers runtime — no Node.js crypto module.
 */

/** Encode a string to Uint8Array */
const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

/** Convert ArrayBuffer to lowercase hex string */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a cryptographically random server seed (32 bytes → 64 hex chars)
 */
export function generateServerSeed(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bufToHex(bytes.buffer)
}

/**
 * Hash a server seed with SHA-256.
 * Returns 64-char lowercase hex.
 */
export async function generateServerSeedHash(serverSeed: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc(serverSeed))
  return bufToHex(digest)
}

/**
 * Calculate a game result (float 0–1) using HMAC-SHA256.
 */
export async function calculateGameResult(
  clientSeed: string,
  serverSeed: string,
  gameType: string
): Promise<number> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc(serverSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const message = `${clientSeed}:${gameType}`
  const sig = await crypto.subtle.sign('HMAC', key, enc(message))
  const hex = bufToHex(sig)
  const first8 = parseInt(hex.slice(0, 8), 16)
  return first8 / 0x100000000
}

/**
 * Generate a provably fair crash point from result (float 0–1).
 * House edge: 1%
 */
export function resultToCrashPoint(result: number): number {
  const houseEdge = 0.01
  if (result < houseEdge) return 1.0
  const raw = 0.99 / (1 - result)
  return Math.max(1.0, Math.floor(raw * 100) / 100)
}

/**
 * Full crash point generation pipeline.
 */
export async function generateCrashRound(clientSeed?: string): Promise<{
  crashPoint: number
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
}> {
  const serverSeed = generateServerSeed()
  const resolvedClientSeed = clientSeed ?? generateServerSeed()
  const serverSeedHash = await generateServerSeedHash(serverSeed)
  const result = await calculateGameResult(resolvedClientSeed, serverSeed, 'crash')
  const crashPoint = resultToCrashPoint(result)
  return { crashPoint, serverSeed, serverSeedHash, clientSeed: resolvedClientSeed }
}
