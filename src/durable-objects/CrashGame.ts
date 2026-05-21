/**
 * CrashGame Durable Object
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the crash game engine using Cloudflare Durable Objects.
 * Uses alarm() API instead of setInterval for scheduled game loop ticks.
 * WebSocket connections are handled via webSocketMessage().
 *
 * Events broadcast to clients:
 *  crash_new_round  – new betting window starts
 *  crash_running    – game is now running (multiplier increasing)
 *  crash_tick       – multiplier update every ~50ms
 *  crash_bust       – game crashed, reveals serverSeed
 *  crash_cashout    – a player cashed out
 *  crash_join       – a player joined the round
 *  crash_error      – error message to client
 */

import { generateCrashRound } from '../src/utils/provablyFair'
import { verifyJWT } from '../src/utils/jwt'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player {
  userId: string
  username: string
  betAmount: number
  autoCashoutAt: number | null
  cashedOut: boolean
  cashoutAt: number | null
  winAmount: number | null
}

interface GameState {
  id: string
  state: 'waiting' | 'betting' | 'running' | 'crashed'
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  crashPoint: number
  currentMultiplier: number
  bettingEndsAt: number
  startedAt: number | null
  crashedAt: number | null
  players: Player[]
  tickInterval: number // ms between ticks
  lastTickAt: number
}

const BETTING_WINDOW_MS = 5000   // 5-second betting window
const TICK_INTERVAL_MS = 50      // 50ms ticks
const MULTIPLIER_RATE = 1.005    // multiply per tick
const ALARM_INTERVAL_MS = 50     // alarm fires every 50ms during running

// ─── Durable Object Class ─────────────────────────────────────────────────────
export class CrashGame {
  private state: DurableObjectState
  private env: { JWT_SECRET: string; KV_STORE: KVNamespace }
  private sessions: Map<WebSocket, { userId: string | null; username: string | null }>

  constructor(state: DurableObjectState, env: any) {
    this.state = state
    this.env = env
    this.sessions = new Map()
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  // ─── Fetch handler (WebSocket upgrade + routing) ──────────────────────────
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const upgradeHeader = request.headers.get('Upgrade')

    if (upgradeHeader === 'websocket') {
      return this.handleWebSocket(request)
    }

    return new Response('Not found', { status: 404 })
  }

  // ─── WebSocket connection handler ─────────────────────────────────────────
  private async handleWebSocket(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const token = url.searchParams.get('token') ?? ''

    let userId: string | null = null
    let username: string | null = null

    if (token) {
      try {
        const payload = await verifyJWT(token, this.env.JWT_SECRET)
        userId = payload.sub
        username = null // We'll load from game state when needed
      } catch {
        // Allow unauthenticated spectators; they can't place bets though
      }
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]

    this.state.acceptWebSocket(server)
    this.sessions.set(server, { userId, username })

    // Send current game state immediately on connect
    const gameState = await this.getGameState()
    if (gameState) {
      const safe = this.safeGameState(gameState)
      this.sendToSocket(server, 'crash_new_round', safe)
      if (gameState.state === 'running') {
        this.sendToSocket(server, 'crash_running', { multiplier: gameState.currentMultiplier })
      }
    } else {
      await this.startNewRound()
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  // ─── WebSocket message handler ────────────────────────────────────────────
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return
    let parsed: { event: string; data?: any }
    try { parsed = JSON.parse(message) } catch { return }

    const session = this.sessions.get(ws)
    if (!session) return

    switch (parsed.event) {
      case 'crash_join':
        await this.handleJoin(ws, session, parsed.data)
        break
      case 'crash_cashout':
        await this.handleCashout(ws, session)
        break
      default:
        break
    }
  }

  // ─── WebSocket close/error handlers ──────────────────────────────────────
  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws)
  }

  // ─── Handle player join via WebSocket ────────────────────────────────────
  private async handleJoin(ws: WebSocket, session: { userId: string | null; username: string | null }, data: any): Promise<void> {
    if (!session.userId) {
      this.sendToSocket(ws, 'crash_error', { msg: 'Authentication required' })
      return
    }

    const betAmount = Number(data?.betAmount)
    if (!isFinite(betAmount) || betAmount < 1) {
      this.sendToSocket(ws, 'crash_error', { msg: 'Invalid bet amount' })
      return
    }

    const gameState = await this.getGameState()
    if (!gameState || gameState.state !== 'betting') {
      this.sendToSocket(ws, 'crash_error', { msg: 'Not in betting window' })
      return
    }
    if (Date.now() > gameState.bettingEndsAt) {
      this.sendToSocket(ws, 'crash_error', { msg: 'Betting window closed' })
      return
    }
    if (gameState.players.find((p) => p.userId === session.userId)) {
      this.sendToSocket(ws, 'crash_error', { msg: 'Already in game' })
      return
    }

    // The actual balance deduction is handled by the HTTP route
    // DO only updates the game state
    const autoCashoutAt = data?.autoCashoutAt ? Number(data.autoCashoutAt) : null

    const player: Player = {
      userId: session.userId,
      username: data?.username ?? session.username ?? 'Player',
      betAmount,
      autoCashoutAt,
      cashedOut: false,
      cashoutAt: null,
      winAmount: null,
    }

    gameState.players.push(player)
    await this.saveGameState(gameState)
    await this.syncKV(gameState)

    this.broadcast('crash_join', { userId: session.userId, username: player.username, betAmount })
  }

  // ─── Handle player cashout via WebSocket ─────────────────────────────────
  private async handleCashout(ws: WebSocket, session: { userId: string | null; username: string | null }): Promise<void> {
    if (!session.userId) {
      this.sendToSocket(ws, 'crash_error', { msg: 'Authentication required' })
      return
    }

    const gameState = await this.getGameState()
    if (!gameState || gameState.state !== 'running') {
      this.sendToSocket(ws, 'crash_error', { msg: 'Game not running' })
      return
    }

    const playerIdx = gameState.players.findIndex((p) => p.userId === session.userId)
    if (playerIdx === -1) {
      this.sendToSocket(ws, 'crash_error', { msg: 'Not in game' })
      return
    }

    const player = gameState.players[playerIdx]
    if (player.cashedOut) {
      this.sendToSocket(ws, 'crash_error', { msg: 'Already cashed out' })
      return
    }

    const multiplier = gameState.currentMultiplier
    const winAmount = Math.floor(player.betAmount * multiplier * 100) / 100

    gameState.players[playerIdx] = {
      ...player,
      cashedOut: true,
      cashoutAt: multiplier,
      winAmount,
    }

    await this.saveGameState(gameState)
    await this.syncKV(gameState)

    this.broadcast('crash_cashout', {
      userId: session.userId,
      username: player.username,
      multiplier,
      winAmount,
    })
    this.sendToSocket(ws, 'crash_cashout', { success: true, multiplier, winAmount })
  }

  // ─── Alarm handler (game loop) ────────────────────────────────────────────
  async alarm(): Promise<void> {
    const gameState = await this.getGameState()
    if (!gameState) {
      await this.startNewRound()
      return
    }

    switch (gameState.state) {
      case 'betting':
        await this.handleBettingAlarm(gameState)
        break
      case 'running':
        await this.handleRunningAlarm(gameState)
        break
      case 'crashed':
        await this.startNewRound()
        break
      case 'waiting':
        await this.startNewRound()
        break
    }
  }

  // ─── Handle betting phase alarm ───────────────────────────────────────────
  private async handleBettingAlarm(gameState: GameState): Promise<void> {
    if (Date.now() >= gameState.bettingEndsAt) {
      gameState.state = 'running'
      gameState.startedAt = Date.now()
      gameState.currentMultiplier = 1.0
      gameState.lastTickAt = Date.now()
      await this.saveGameState(gameState)
      await this.syncKV(gameState)
      this.broadcast('crash_running', {
        startedAt: gameState.startedAt,
        serverSeedHash: gameState.serverSeedHash,
      })
      await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS)
    } else {
      const remaining = gameState.bettingEndsAt - Date.now()
      await this.state.storage.setAlarm(Date.now() + Math.min(remaining, 1000))
    }
  }

  // ─── Handle running phase alarm ───────────────────────────────────────────
  private async handleRunningAlarm(gameState: GameState): Promise<void> {
    const now = Date.now()
    const ticksSinceStart = Math.floor((now - (gameState.startedAt ?? now)) / TICK_INTERVAL_MS)
    const multiplier = Math.pow(MULTIPLIER_RATE, ticksSinceStart)
    gameState.currentMultiplier = Math.round(multiplier * 100) / 100

    // Check auto-cashouts
    for (let i = 0; i < gameState.players.length; i++) {
      const p = gameState.players[i]
      if (!p.cashedOut && p.autoCashoutAt !== null && gameState.currentMultiplier >= p.autoCashoutAt) {
        const winAmount = Math.floor(p.betAmount * p.autoCashoutAt * 100) / 100
        gameState.players[i] = {
          ...p,
          cashedOut: true,
          cashoutAt: p.autoCashoutAt,
          winAmount,
        }
        this.broadcast('crash_cashout', {
          userId: p.userId,
          username: p.username,
          multiplier: p.autoCashoutAt,
          winAmount,
          auto: true,
        })
      }
    }

    // Check if should crash
    if (gameState.currentMultiplier >= gameState.crashPoint) {
      gameState.state = 'crashed'
      gameState.crashedAt = now
      gameState.currentMultiplier = gameState.crashPoint

      await this.saveGameState(gameState)
      await this.syncKV(gameState)

      this.broadcast('crash_bust', {
        crashPoint: gameState.crashPoint,
        serverSeed: gameState.serverSeed,
        serverSeedHash: gameState.serverSeedHash,
        players: gameState.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          betAmount: p.betAmount,
          cashedOut: p.cashedOut,
          cashoutAt: p.cashoutAt,
          winAmount: p.winAmount,
        })),
      })

      // Schedule next round after 5 seconds
      await this.state.storage.setAlarm(now + 5000)
    } else {
      await this.saveGameState(gameState)
      await this.syncKV(gameState)
      this.broadcast('crash_tick', { multiplier: gameState.currentMultiplier })
      await this.state.storage.setAlarm(now + ALARM_INTERVAL_MS)
    }
  }

  // ─── Start a new round ────────────────────────────────────────────────────
  private async startNewRound(): Promise<void> {
    const { crashPoint, serverSeed, serverSeedHash, clientSeed } = await generateCrashRound()

    const gameState: GameState = {
      id: crypto.randomUUID(),
      state: 'betting',
      serverSeed,
      serverSeedHash,
      clientSeed,
      crashPoint,
      currentMultiplier: 1.0,
      bettingEndsAt: Date.now() + BETTING_WINDOW_MS,
      startedAt: null,
      crashedAt: null,
      players: [],
      tickInterval: TICK_INTERVAL_MS,
      lastTickAt: Date.now(),
    }

    await this.saveGameState(gameState)
    await this.syncKV(gameState)

    this.broadcast('crash_new_round', this.safeGameState(gameState))
    await this.state.storage.setAlarm(gameState.bettingEndsAt)
  }

  // ─── Storage helpers ──────────────────────────────────────────────────────
  private async getGameState(): Promise<GameState | null> {
    return (await this.state.storage.get<GameState>('gameState')) ?? null
  }

  private async saveGameState(state: GameState): Promise<void> {
    await this.state.storage.put('gameState', state)
  }

  /** Sync current game state to KV for HTTP API reads */
  private async syncKV(gameState: GameState): Promise<void> {
    try {
      await this.env.KV_STORE.put('crash:currentGame', JSON.stringify(gameState), { expirationTtl: 300 })
    } catch {
      // KV write failure is non-fatal for the DO
    }
  }

  // ─── Broadcast to all connected sockets ──────────────────────────────────
  private broadcast(event: string, data: any): void {
    const msg = JSON.stringify({ event, data })
    const activeSockets = this.state.getWebSockets()
    for (const ws of activeSockets) {
      try { ws.send(msg) } catch { /* client disconnected */ }
    }
  }

  // ─── Send to a single socket ──────────────────────────────────────────────
  private sendToSocket(ws: WebSocket, event: string, data: any): void {
    try { ws.send(JSON.stringify({ event, data })) } catch { /* client disconnected */ }
  }

  // ─── Safe game state (no serverSeed) ─────────────────────────────────────
  private safeGameState(gs: GameState): Omit<GameState, 'serverSeed'> & { serverSeed?: never } {
    const { serverSeed: _, ...safe } = gs
    return safe
  }
}