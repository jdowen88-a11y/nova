import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users, type User } from '../../db/schema'

interface Env {
  DB: D1Database
  KV_STORE: KVNamespace
  TOS_VERSION: string
}

type Variables = {
  user: User
  db: any
}

const userRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

const SelfExclusionSchema = z.object({ months: z.number().int().min(1).max(60) })
const SessionLimitSchema = z.object({ minutes: z.number().int().min(15).max(480) })
const SettingsSchema = z.object({
  soundEnabled: z.number().int().min(0).max(1).optional(),
  chatEnabled: z.number().int().min(0).max(1).optional(),
})

userRouter.post('/self-exclusion', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const parsed = SelfExclusionSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 422)

  const user: User = c.get('user')
  const db = c.get('db')
  const until = new Date()
  until.setMonth(until.getMonth() + parsed.data.months)

  await db.update(users).set({
    selfExclusionUntil: until.toISOString(),
    selfExclusionRemovalRequestedAt: null,
  }).where(eq(users.id, user.id))

  await c.env.KV_STORE.delete(`session:${user.id}:start`)
  return c.json({ msg: `Self-excluded until ${until.toISOString()}` })
})

userRouter.delete('/self-exclusion', async (c) => {
  const user: User = c.get('user')
  const db = c.get('db')

  if (!user.selfExclusionUntil) return c.json({ error: 'No active self-exclusion' }, 400)

  if (!user.selfExclusionRemovalRequestedAt) {
    const requestedAt = new Date().toISOString()
    await db.update(users).set({ selfExclusionRemovalRequestedAt: requestedAt }).where(eq(users.id, user.id))
    return c.json({ msg: 'Removal request recorded. Please confirm after 24 hours.' })
  }

  const requestedAt = new Date(user.selfExclusionRemovalRequestedAt)
  const elapsed = Date.now() - requestedAt.getTime()
  if (elapsed < 24 * 60 * 60 * 1000) {
    const remaining = Math.ceil((24 * 60 * 60 * 1000 - elapsed) / 3600_000)
    return c.json({ msg: `Please wait ${remaining} more hour(s) before cancelling self-exclusion.` }, 425)
  }

  await db.update(users).set({
    selfExclusionUntil: null,
    selfExclusionRemovalRequestedAt: null,
  }).where(eq(users.id, user.id))

  return c.json({ msg: 'Self-exclusion lifted.' })
})

userRouter.post('/session-limit', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const parsed = SessionLimitSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 422)

  const user: User = c.get('user')
  const db = c.get('db')
  await db.update(users).set({ sessionLimitMinutes: parsed.data.minutes }).where(eq(users.id, user.id))
  return c.json({ msg: `Session limit set to ${parsed.data.minutes} minutes` })
})

userRouter.post('/accept-tos', async (c) => {
  const user: User = c.get('user')
  const db = c.get('db')
  await db.update(users).set({
    tosAcceptedAt: new Date().toISOString(),
    tosVersion: c.env.TOS_VERSION,
  }).where(eq(users.id, user.id))
  return c.json({ msg: 'Terms accepted' })
})

userRouter.get('/profile', async (c) => {
  const user: User = c.get('user')
  const { passwordHash, ...safe } = user
  return c.json(safe)
})

userRouter.patch('/settings', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const parsed = SettingsSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 422)

  const user: User = c.get('user')
  const db = c.get('db')
  const updates: Record<string, any> = {}
  if (parsed.data.soundEnabled !== undefined) updates.soundEnabled = parsed.data.soundEnabled
  if (parsed.data.chatEnabled !== undefined) updates.chatEnabled = parsed.data.chatEnabled

  await db.update(users).set(updates).where(eq(users.id, user.id))
  const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)

  const { passwordHash, ...safe } = updated
  return c.json(safe)
})

export default userRouter
