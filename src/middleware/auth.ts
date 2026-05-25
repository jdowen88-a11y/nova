import { eq } from 'drizzle-orm'
import { verifyJWT } from '../utils/jwt'
import { users, type User } from '../../db/schema'

function bearerToken(c: any): string | null {
  const authHeader = c.req.header('Authorization') ?? ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
}

export async function requireAuth(c: any, next: () => Promise<void>) {
  const token = bearerToken(c)
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  let payload: any
  try {
    payload = await verifyJWT(token, c.env.JWT_SECRET)
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  const db = c.get('db')
  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
  if (!user) return c.json({ error: 'User not found' }, 401)

  c.set('user', user as User)
  await next()
}

export async function requireAdmin(c: any, next: () => Promise<void>) {
  const user = c.get('user') as User | undefined
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }
  await next()
}

export async function requirePlayable(c: any, next: () => Promise<void>) {
  const user = c.get('user') as User | undefined
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  if (user.selfExclusionUntil && new Date(user.selfExclusionUntil).getTime() > Date.now()) {
    return c.json({ error: 'Account is self-excluded', until: user.selfExclusionUntil }, 403)
  }

  if (user.sessionLimitMinutes && c.env.KV_STORE) {
    const key = `session:${user.id}:start`
    let start = await c.env.KV_STORE.get(key, 'text')
    if (!start) {
      start = String(Date.now())
      await c.env.KV_STORE.put(key, start, { expirationTtl: 86400 })
    }
    const elapsedMinutes = (Date.now() - Number(start)) / 60_000
    if (Number.isFinite(elapsedMinutes) && elapsedMinutes > user.sessionLimitMinutes) {
      return c.json({ error: 'Session time limit reached' }, 403)
    }
  }

  await next()
}
