import { Hono } from 'hono'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import { auditLogs, users, type User } from '../../db/schema'
import { uuidv4 } from '../utils/uuid'

interface Env {
  DB: D1Database
  KV_STORE: KVNamespace
}

type Variables = {
  user: User
  db: any
}

const adminRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

const RtpSchema = z.object({ rtp: z.number().int().min(85).max(99) })

adminRouter.get('/rtp', async (c) => {
  const raw = await c.env.KV_STORE.get('rtpSettings', 'text')
  if (!raw) {
    const defaults = { crash: 97, slots: 96, mines: 97 }
    await c.env.KV_STORE.put('rtpSettings', JSON.stringify(defaults))
    return c.json(defaults)
  }
  return c.json(JSON.parse(raw))
})

adminRouter.patch('/rtp/:game', async (c) => {
  const game = c.req.param('game')
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const parsed = RtpSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 422)

  const adminUser: User = c.get('user')
  const db = c.get('db')

  const raw = await c.env.KV_STORE.get('rtpSettings', 'text')
  const settings: Record<string, number> = raw ? JSON.parse(raw) : { crash: 97, slots: 96, mines: 97 }
  const oldRtp = settings[game]
  settings[game] = parsed.data.rtp
  await c.env.KV_STORE.put('rtpSettings', JSON.stringify(settings))

  await db.insert(auditLogs).values({
    id: uuidv4(),
    adminId: adminUser.id,
    action: 'RTP_UPDATE',
    target: `game:${game}`,
    oldValue: JSON.stringify({ rtp: oldRtp }),
    newValue: JSON.stringify({ rtp: parsed.data.rtp }),
    timestamp: new Date().toISOString(),
  })

  return c.json(settings)
})

adminRouter.get('/users', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100)
  const offset = parseInt(c.req.query('offset') ?? '0')
  const db = c.get('db')

  const results = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    goldCoins: users.goldCoins,
    novaCrystals: users.novaCrystals,
    vipTier: users.vipTier,
    totalWagered: users.totalWagered,
    gamesPlayed: users.gamesPlayed,
    role: users.role,
    createdAt: users.createdAt,
    selfExclusionUntil: users.selfExclusionUntil,
  }).from(users).limit(limit).offset(offset)

  return c.json({ users: results, limit, offset })
})

adminRouter.get('/audit-logs', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100)
  const offset = parseInt(c.req.query('offset') ?? '0')
  const db = c.get('db')

  const logs = await db.select().from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit).offset(offset)

  return c.json({ logs, limit, offset })
})

export default adminRouter
