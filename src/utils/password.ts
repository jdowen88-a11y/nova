const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex length')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16)
    if (Number.isNaN(byte)) throw new Error('Invalid hex')
    bytes[i / 2] = byte
  }
  return bytes
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

const ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BITS = 256

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const keyMaterial = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS
  )
  return `pbkdf2:${ITERATIONS}:${bufToHex(salt)}:${bufToHex(derived)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, itersStr, saltHex, hashHex] = stored.split(':')
  if (scheme !== 'pbkdf2') return false

  const iterations = Number.parseInt(itersStr, 10)
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  let salt: Uint8Array
  let expected: Uint8Array
  try {
    salt = hexToBytes(saltHex)
    expected = hexToBytes(hashHex)
  } catch {
    return false
  }

  const keyMaterial = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    expected.length * 8
  )

  return constantTimeEqual(new Uint8Array(derived), expected)
}
