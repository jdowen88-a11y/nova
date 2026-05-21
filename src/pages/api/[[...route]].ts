import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzle } from 'drizzle-orm/d1'
import authRouter from '../../routes/auth'
import userRouter from '../../routes/user'
import gameRouter from '../../routes/games'
import adminRouter from '../../routes/admin'
import { users, type User } from '../../../db/schema'

interface Env {
  DB: D1Database
  KV_STORE: KVNamespace
  RATE_LIMIT: KVNamespace
  CRASH_GAME: DurableObjectNamespace
  JWT_SECRET: string
  SESSION_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  TOS_VERSION: string
  BLOCKED_STATES: string
  ALLOWED_ORIGINS: string
  NODE_ENV: string
}

type Variables = {
  user: User
  db: ReturnType<typeof drizzle>
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', logger())

app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim())
  const origin = c.req.header('Origin') ?? ''
  const allowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  const corsMiddleware = cors({
    origin: allowed || '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
  return corsMiddleware(c, next)
})

app.use('*', async (c, next) => {
  c.set('db', drizzle(c.env.DB))
  await next()
})

app.route('/api/auth', authRouter)
app.route('/api/user', userRouter)
app.route('/api/games', gameRouter)
app.route('/api/admin', adminRouter)

app.get('/api/ws/crash', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426)
  }

  const id = c.env.CRASH_GAME.idFromName('global')
  const stub = c.env.CRASH_GAME.get(id)
  return stub.fetch(c.req.raw)
})

app.get('/api/health', (c) => c.json({ status: 'ok', ts: Date.now() }))

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error('[API Error]', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export const onRequest = app.fetch
