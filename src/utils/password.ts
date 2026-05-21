/**
 * Password hashing using Web Crypto (PBKDF2).
 * Workers-compatible — no bcrypt.
 * Format: pbkdf2:iterations:salt:hash
 */

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

const ITERATIONS = 100_000
const SALT_BYTES = 16

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(salt)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc(password) as unknown as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  return `pbkdf2:${ITERATIONS}:${bufToHex(salt.buffer as ArrayBuffer)}:${bufToHex(derived)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const [, itersStr, saltHex, hashHex] = parts
  const iterations = parseInt(itersStr, 10)
  const salt = hexToBuf(saltHex)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc(password) as unknown as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  const derivedHex = bufToHex(derived)
  if (derivedHex.length !== hashHex.length) return false
  let diff = 0
  for (let i = 0; i < derivedHex.length; i++) {
    diff |= derivedHex.charCodeAt(i) ^ hashHex.charCodeAt(i)
  }
  return diff === 0
}