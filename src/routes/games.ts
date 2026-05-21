import { Hono } from 'hono'
import { z } from 'zod'
import { eq, desc, sql as drizzleSql } from 'drizzle-orm'
import { gameHistory, users, type User } from '../../db/schema'
import { calculateVipTier } from '../utils/vip'

interface Env {
  DB: D1Database
  KV_STORE: KVNamespace
  NODE_ENV: string
  BLOCKED_STATES: string
}

type Variables = {
  user: User
  db: any
}

const gameRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

const JoinSchema = z.object({
  betAmount: z.number().positive().finite().min(1),
  autoCashoutAt: z.number().min(1.01).optional(),
})

function geoBlock(c: any, next: () => Promise<void>) {
  if (c.env.NODE_ENV !== 'production') return next()
  const country = c.req.header('CF-IPCountry') ?? ''
  const region = c.req.header('CF-Region') ?? ''
  const blockedStates = (c.env.BLOCKED_STATES ?? 'ID,WA,MI').split(',').map((s: string) => s.trim().toUpperCase())
  if (blockedStates.includes(region.toUpperCase()) || blockedStates.includes(country.toUpperCase())) {
    return c.json({ error: 'Service unavailable in your region', region, country }, 451)
  }
  return next()
}

gameRouter.use('*', geoBlock)

gameRouter.get('/crash/current', async (c) => {
  const raw = await c.env.KV_STORE.get('crash:currentGame', 'text')
  if (!raw) return c.json({ state: 'waiting', players: [], multiplier: 1.0 })
  const game: any = JSON.parse(raw)
  const { serverSeed: _s, ...safe } = game
  return c.json(safe)
})

gameRouter.post('/crash/join', async (c) => {
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const parsed = JoinSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 422)

  const user: User = c.get('user')
  const { betAmount, autoCashoutAt } = parsed.data
  const db = c.get('db')

  if ((user.goldCoins ?? 0) < betAmount) return c.json({ error: 'Insufficient gold coins' }, 402)

  const raw = await c.env.KV_STORE.get('crash:currentGame', 'text')
  if (!raw) return c.json({ error: 'No active game' }, 409)

  const game: any = JSON.parse(raw)
  if (game.state !== 'betting') return c.json({ error: 'Betting window closed' }, 409)
  if (Date.now() > game.bettingEndsAt) return c.json({ error: 'Betting window closed' }, 409)

  if (game.players?.find((p: any) => p.userId === user.id)) {
    return c.json({ error: 'Already in game' }, 409)
  }

  game.players = game.players ?? []
  game.players.push({
    userId: user.id,
    username: user.username,
    betAmount,
    autoCashoutAt: autoCashoutAt ?? null,
    cashedOut: false,
    cashoutAt: null,
    winAmount: null,
  })

  const result = await db.run(
    drizzleSql`UPDATE users SET gold_coins = gold_coins - ${betAmount} WHERE id = ${user.id} AND gold_coins >= ${betAmount}`
  )
  if (result.meta.changes === 0) return c.json({ error: 'Insufficient gold coins' }, 402)

  await c.env.KV_STORE.put('crash:currentGame', JSON.stringify(game), { expirationTtl: 300 })
  return c.json({ success: true, betAmount })
})

gameRouter.post('/crash/cashout', async (c) => {
  const user: User = c.get('user')
  const db = c.get('db')

  const raw = await c.env.KV_STORE.get('crash:currentGame', 'text')
  if (!raw) return c.json({ error: 'No active game' }, 409)

  const game: any = JSON.parse(raw)
  if (game.state !== 'running') return c.json({ error: 'Game not running' }, 409)

  const playerIdx = (game.players ?? []).findIndex((p: any) => p.userId === user.id)
  if (playerIdx === -1) return c.json({ error: 'Not in game' }, 409)

  const player = game.players[playerIdx]
  if (player.cashedOut) return c.json({ error: 'Already cashed out' }, 409)

  const currentMultiplier = game.currentMultiplier ?? 1.0
  const winAmount = Math.floor(player.betAmount * currentMultiplier * 100) / 100

  game.players[playerIdx] = {
    ...player,
    cashedOut: true,
    cashoutAt: currentMultiplier,
    winAmount,
  }

  await c.env.KV_STORE.put('crash:currentGame', JSON.stringify(game), { expirationTtl: 300 })

  await db.run(
    drizzleSql`UPDATE users SET gold_coins = gold_coins + ${winAmount}, total_won = total_won + ${winAmount}, total_wagered = total_wagered + ${player.betAmount}, games_played = games_played + 1 WHERE id = ${user.id}`
  )

  const [updated] = await db.select({ totalWagered: users.totalWagered }).from(users).where(eq(users.id, user.id)).limit(1)
  const { tier, progress } = calculateVipTier(updated.totalWagered ?? 0)
  await db.update(users).set({ vipTier: tier, vipProgress: progress }).where(eq(users.id, user.id))

  return c.json({ success: true, winAmount, multiplier: currentMultiplier })
})

gameRouter.get('/crash/history', async (c) => {
  const db = c.get('db')
  const history = await db.select({
    id: gameHistory.id,
    crashPoint: gameHistory.crashPoint,
    serverSeedHash: gameHistory.serverSeedHash,
    createdAt: gameHistory.createdAt,
  }).from(gameHistory)
    .where(eq(gameHistory.gameType, 'crash'))
    .orderBy(desc(gameHistory.createdAt))
    .limit(20)

  return c.json(history)
})

export default gameRouter
