import { Hono } from 'hono'
import type { User } from '../../db/schema'

interface Env {
  DB: D1Database
}

type Variables = {
  user: User
  db: any
}

const currencyRouter = new Hono<{ Bindings: Env; Variables: Variables }>()

currencyRouter.get('/balance', async (c) => {
  const user = c.get('user')
  return c.json({
    goldCoins: user.goldCoins ?? 0,
    novaCrystals: user.novaCrystals ?? 0,
    vipTier: user.vipTier ?? 'Stardust',
    vipProgress: user.vipProgress ?? 0,
  })
})

export default currencyRouter
