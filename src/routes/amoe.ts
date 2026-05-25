import { Hono } from 'hono'
import { z } from 'zod'
import { desc, eq, sql as drizzleSql } from 'drizzle-orm'
import { amoeRequests, users, type User } from '../../db/schema'
import { uuidv4 } from '../utils/uuid'

interface Env {
  DB: D1Database
}

type Variables = {
  user: User
  db: any
}

const amoeRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

const AmoeSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().min(8).max(500),
})

amoeRouter.get('/status', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const rows = await db.select().from(amoeRequests)
    .where(eq(amoeRequests.userId, user.id))
    .orderBy(desc(amoeRequests.requestedAt))
    .limit(25)
  return c.json(rows)
})

amoeRouter.post('/request', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const parsed = AmoeSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 422)

  const user = c.get('user')
  const db = c.get('db')
  const id = uuidv4()
  const now = new Date().toISOString()

  await db.insert(amoeRequests).values({
    id,
    userId: user.id,
    name: parsed.data.name,
    address: parsed.data.address,
    status: 'fulfilled',
    requestedAt: now,
    fulfilledAt: now,
  })

  await db.run(
    drizzleSql`UPDATE users SET nova_crystals = nova_crystals + 100 WHERE id = ${user.id}`
  )

  return c.json({ msg: 'AMOE request recorded. 100 NC credited.', id }, 201)
})

export default amoeRouter
