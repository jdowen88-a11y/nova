import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { signJWT, verifyJWT } from '../utils/jwt'
import { hashPassword, verifyPassword } from '../utils/password'
import { uuidv4 } from '../utils/uuid'
import { users, type User } from '../../db/schema'

interface Env {
  DB: D1Database
  KV_STORE: KVNamespace
  JWT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
}

type Variables = {
  user: User
  db: any
}

const authRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

function safeUser(u: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = u
  return rest
}

const RegisterSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscores only'),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  dateOfBirth: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

authRouter.post('/register', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 422)

  const { username, email, password, dateOfBirth } = parsed.data
  const dob = new Date(dateOfBirth)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--
  if (age < 18) return c.json({ error: 'You must be 18 or older to register' }, 403)

  const db = c.get('db')
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existing.length) return c.json({ error: 'Email already in use' }, 409)

  const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
  if (existingUser.length) return c.json({ error: 'Username already taken' }, 409)

  const passwordHash = await hashPassword(password)
  const id = uuidv4()
  const now2 = new Date().toISOString()

  await db.insert(users).values({
    id,
    username,
    email: email.toLowerCase(),
    passwordHash,
    birthYear: dob.getFullYear(),
    birthMonth: dob.getMonth() + 1,
    isAgeVerified: 1,
    goldCoins: 1000,
    novaCrystals: 0,
    vipTier: 'Stardust',
    role: 'user',
    createdAt: now2,
  })

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  const token = await signJWT({ sub: id, email: email.toLowerCase(), role: 'user' }, c.env.JWT_SECRET)
  return c.json({ token, user: safeUser(user) }, 201)
})

authRouter.post('/login', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 422)

  const { email, password } = parsed.data
  const db = c.get('db')
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)

  if (!user) return c.json({ error: 'Invalid email or password' }, 401)
  if (!user.passwordHash) return c.json({ error: 'Please sign in with OAuth' }, 401)

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return c.json({ error: 'Invalid email or password' }, 401)

  await c.env.KV_STORE.put(`session:${user.id}:start`, String(Date.now()), { expirationTtl: 86400 })

  const token = await signJWT({ sub: user.id, email: user.email, role: user.role ?? 'user' }, c.env.JWT_SECRET)
  return c.json({ token, user: safeUser(user) })
})

authRouter.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
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

  return c.json(safeUser(user))
})

export default authRouter
