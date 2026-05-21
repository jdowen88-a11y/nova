/**
 * Lightweight JWT implementation using Web Crypto (HMAC-SHA256).
 * Compatible with Cloudflare Workers — no jsonwebtoken dependency.
 */

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)
const dec = (buf: Uint8Array): string => new TextDecoder().decode(buf)

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export interface JWTPayload {
  sub: string
  email: string
  role: string
  iat: number
  exp: number
}

const HEADER = base64UrlEncode(enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))

export async function signJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = 86400
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + expiresInSeconds }
  const body = base64UrlEncode(enc(JSON.stringify(fullPayload)))
  const signingInput = `${HEADER}.${body}`
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc(signingInput))
  return `${signingInput}.${base64UrlEncode(sig)}`
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  const [header, body, sig] = parts
  const signingInput = `${header}.${body}`
  const key = await importKey(secret)
  const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(sig), enc(signingInput))
  if (!valid) throw new Error('Invalid JWT signature')
  const payload: JWTPayload = JSON.parse(dec(base64UrlDecode(body)))
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) throw new Error('JWT expired')
  return payload
}
