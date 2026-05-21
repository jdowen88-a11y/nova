import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react'
import socket from '../socket'

// ─── Types ─────────────────────────────────────────────────────────────────
interface HistoryEntry {
  id: string
  crashPoint: number
  serverSeedHash: string
  createdAt: string
}

interface ActivePlayer {
  userId: string
  username: string
  betAmount: number
  cashedOut: boolean
  cashoutAt: number | null
  winAmount: number | null
}

type GamePhase = 'waiting' | 'betting' | 'running' | 'crashed'

// ─── Crash Page Component ───────────────────────────────────────────────────
export default function Crash() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting')
  const [multiplier, setMultiplier] = useState(1.0)
  const [crashedAt, setCrashedAt] = useState<number | null>(null)
  const [inGame, setInGame] = useState(false)
  const [betAmount, setBetAmount] = useState(10)
  const [autoCashoutAt, setAutoCashoutAt] = useState<string>('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([])
  const [serverSeedHash, setServerSeedHash] = useState<string>('')
  const [goldCoins, setGoldCoins] = useState<number>(1000)
  const [statusMsg, setStatusMsg] = useState('')
  const [bettingEndsAt, setBettingEndsAt] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [connected, setConnected] = useState(false)
  const [isFlashing, setIsFlashing] = useState(false)
  const [myWin, setMyWin] = useState<{ amount: number; mult: number } | null>(null)

  const multiplierRef = useRef(multiplier)
  multiplierRef.current = multiplier

  const inGameRef = useRef(inGame)
  inGameRef.current = inGame

  const autoCashoutRef = useRef(autoCashoutAt)
  autoCashoutRef.current = autoCashoutAt

  const token = localStorage.getItem('nova_token') ?? ''
  const userId = getUserIdFromToken(token)

  // ─── Load initial data ──────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [balRes, histRes] = await Promise.all([
          fetch('/api/currency/balance', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/games/crash/history', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (balRes.ok) {
          const bal = await balRes.json() as { goldCoins: number }
          setGoldCoins(bal.goldCoins)
        }
        if (histRes.ok) {
          const hist = await histRes.json() as HistoryEntry[]
          setHistory(hist)
        }
      } catch {
        // ignore load errors
      }
    }
    if (token) loadData()
  }, [token])

  // ─── WebSocket setup ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return

    // Named event handlers for proper cleanup
    const onConnected = () => setConnected(true)
    const onDisconnected = () => setConnected(false)

    const onNewRound = (data: any) => {
      setGamePhase(data.state === 'betting' ? 'betting' : 'waiting')
      setMultiplier(1.0)
      setCrashedAt(null)
      setInGame(false)
      setMyWin(null)
      setIsFlashing(false)
      setServerSeedHash(data.serverSeedHash ?? '')
      setBettingEndsAt(data.bettingEndsAt ?? null)
      setActivePlayers(
        (data.players ?? []).map((p: any) => ({
          userId: p.userId,
          username: p.username,
          betAmount: p.betAmount,
          cashedOut: p.cashedOut,
          cashoutAt: p.cashoutAt,
          winAmount: p.winAmount,
        }))
      )
    }

    const onRunning = (data: any) => {
      setGamePhase('running')
      setBettingEndsAt(null)
      setMultiplier(1.0)
      setStatusMsg('')
    }

    const onTick = (data: any) => {
      const mult = data.multiplier as number
      setMultiplier(mult)

      // Auto-cashout logic
      const autoCashout = parseFloat(autoCashoutRef.current)
      if (inGameRef.current && !isNaN(autoCashout) && autoCashout >= 1.01 && mult >= autoCashout) {
        handleCashout()
      }
    }

    const onBust = (data: any) => {
      setGamePhase('crashed')
      setCrashedAt(data.crashPoint)
      setMultiplier(data.crashPoint)
      setIsFlashing(true)
      setTimeout(() => setIsFlashing(false), 1000)
      setActivePlayers(
        (data.players ?? []).map((p: any) => ({
          userId: p.userId,
          username: p.username,
          betAmount: p.betAmount,
          cashedOut: p.cashedOut,
          cashoutAt: p.cashoutAt,
          winAmount: p.winAmount,
        }))
      )
      // Add to history
      setHistory((prev) => [
        { id: Date.now().toString(), crashPoint: data.crashPoint, serverSeedHash: data.serverSeedHash ?? '', createdAt: new Date().toISOString() },
        ...prev.slice(0, 19),
      ])
    }

    const onCashout = (data: any) => {
      setActivePlayers((prev) =>
        prev.map((p) =>
          p.userId === data.userId
            ? { ...p, cashedOut: true, cashoutAt: data.multiplier, winAmount: data.winAmount }
            : p
        )
      )
      if (data.userId === userId) {
        setInGame(false)
        setMyWin({ amount: data.winAmount, mult: data.multiplier })
        setGoldCoins((prev) => prev + data.winAmount)
        setStatusMsg(`Cashed out at ${data.multiplier.toFixed(2)}x — won ${data.winAmount.toFixed(2)} GC!`)
      }
    }

    const onJoin = (data: any) => {
      setActivePlayers((prev) => {
        if (prev.find((p) => p.userId === data.userId)) return prev
        return [...prev, {
          userId: data.userId,
          username: data.username,
          betAmount: data.betAmount,
          cashedOut: false,
          cashoutAt: null,
          winAmount: null,
        }]
      })
    }

    const onError = (data: any) => {
      setStatusMsg(data.msg ?? 'An error occurred')
    }

    socket.on('__connected', onConnected)
    socket.on('__disconnected', onDisconnected)
    socket.on('crash_new_round', onNewRound)
    socket.on('crash_running', onRunning)
    socket.on('crash_tick', onTick)
    socket.on('crash_bust', onBust)
    socket.on('crash_cashout', onCashout)
    socket.on('crash_join', onJoin)
    socket.on('crash_error', onError)

    socket.connect(token)

    // Heartbeat ping every 25 seconds
    const pingInterval = setInterval(() => socket.ping(), 25_000)

    return () => {
      socket.off('__connected', onConnected)
      socket.off('__disconnected', onDisconnected)
      socket.off('crash_new_round', onNewRound)
      socket.off('crash_running', onRunning)
      socket.off('crash_tick', onTick)
      socket.off('crash_bust', onBust)
      socket.off('crash_cashout', onCashout)
      socket.off('crash_join', onJoin)
      socket.off('crash_error', onError)
      clearInterval(pingInterval)
      socket.disconnect()
    }
  }, [token])

  // ─── Countdown timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!bettingEndsAt) { setCountdown(0); return }
    const tick = () => {
      const remaining = Math.max(0, bettingEndsAt - Date.now())
      setCountdown(Math.ceil(remaining / 1000))
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [bettingEndsAt])

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (inGame || betAmount < 1 || betAmount > goldCoins) return
    if (gamePhase !== 'betting') {
      setStatusMsg('Wait for the next betting window')
      return
    }
    setStatusMsg('')
    try {
      const res = await fetch('/api/games/crash/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          betAmount,
          autoCashoutAt: parseFloat(autoCashoutAt) || undefined,
        }),
      })
      const json = await res.json() as any
      if (!res.ok) {
        setStatusMsg(json.error ?? 'Failed to place bet')
        return
      }
      setInGame(true)
      setGoldCoins((prev) => prev - betAmount)
      setStatusMsg('Bet placed!')
      socket.send('crash_join', { betAmount, autoCashoutAt: parseFloat(autoCashoutAt) || null, username: 'You' })
    } catch {
      setStatusMsg('Network error, please retry')
    }
  }

  const handleCashout = useCallback(async () => {
    if (!inGameRef.current) return
    setInGame(false) // Optimistic update
    try {
      const res = await fetch('/api/games/crash/cashout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json() as any
      if (!res.ok) {
        setInGame(true) // Revert
        setStatusMsg(json.error ?? 'Cashout failed')
        return
      }
      setGoldCoins((prev) => prev + json.winAmount)
      setMyWin({ amount: json.winAmount, mult: json.multiplier })
      setStatusMsg(`Cashed out at ${json.multiplier.toFixed(2)}x — won ${json.winAmount.toFixed(2)} GC!`)
    } catch {
      setInGame(true)
      setStatusMsg('Network error during cashout')
    }
  }, [token])

  // ─── Derived UI values ─────────────────────────────────────────────────
  // Rocket Y position: starts near bottom, rises as multiplier increases
  const rocketY = Math.max(5, 95 - Math.log(Math.max(1, multiplier)) * 38)
  const rocketX = Math.min(85, 10 + Math.log(Math.max(1, multiplier)) * 20)

  const multiplierColor =
    gamePhase === 'crashed'
      ? 'text-red-500'
      : multiplier >= 10
      ? 'text-electric-purple'
      : multiplier >= 2
      ? 'text-green-400'
      : 'text-supernova-gold'

  const historyColor = (cp: number) =>
    cp >= 10 ? 'bg-electric-purple text-white' : cp >= 2 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'

  return (
    <div className="min-h-screen bg-cosmic-gradient text-star-white font-body">
      {/* Header */}
      <header className="border-b border-nebula-gray/30 px-4 py-3 flex items-center justify-between bg-void-black/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-display font-bold text-supernova-gold tracking-wider">NOVA</span>
          <span className="text-2xl font-display font-bold text-electric-purple tracking-wider">CASINO</span>
          <span className="ml-2 px-2 py-0.5 text-xs rounded bg-electric-purple/20 text-electric-purple border border-electric-purple/30">CRASH</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 text-sm ${connected ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {connected ? 'Live' : 'Offline'}
          </div>
          <div className="text-supernova-gold font-semibold">
            💰 {goldCoins.toFixed(2)} <span className="text-xs text-gray-400">GC</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Game Canvas */}
        <section className="lg:col-span-2 flex flex-col gap-4">
          {/* Crash Display */}
          <div
            className={`relative rounded-2xl overflow-hidden border border-nebula-gray/40 transition-all duration-300 ${
              isFlashing ? 'animate-crash-flash border-red-500 shadow-lg shadow-red-500/30' : ''
            } ${gamePhase === 'betting' ? 'border-supernova-gold/40 shadow-lg shadow-supernova-gold/10' : ''}`}
            style={{ height: '380px', background: 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)' }}
          >
            {/* Stars */}
            <StarField />

            {/* Phase banner */}
            {gamePhase === 'betting' && (
              <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
                <div className="px-4 py-2 rounded-full bg-supernova-gold/10 border border-supernova-gold/30 text-supernova-gold text-sm font-semibold animate-pulse-slow">
                  🚀 Launching in {countdown}s — Place Your Bets!
                </div>
              </div>
            )}
            {gamePhase === 'waiting' && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="text-6xl mb-3 animate-spin-slow">🌌</div>
                  <div className="text-white/60 text-sm">Preparing next round…</div>
                </div>
              </div>
            )}

            {/* Rocket */}
            {(gamePhase === 'running' || gamePhase === 'crashed') && (
              <div
                className="absolute transition-all duration-100"
                style={{ left: `${rocketX}%`, top: `${rocketY}%` }}
              >
                <div className={`text-4xl ${gamePhase === 'running' ? 'animate-rocket-fly' : ''}`}
                  style={{ transform: gamePhase === 'crashed' ? 'rotate(90deg)' : 'rotate(-45deg)' }}>
                  {gamePhase === 'crashed' ? '💥' : '🚀'}
                </div>
                {/* Trail */}
                {gamePhase === 'running' && (
                  <div className="absolute top-5 left-4 w-24 h-1 bg-gradient-to-r from-electric-purple/60 to-transparent rounded" style={{ transform: 'rotate(45deg)' }} />
                )}
              </div>
            )}

            {/* Multiplier display */}
            <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center z-10">
              <div className={`text-7xl font-display font-bold transition-colors duration-200 ${multiplierColor} drop-shadow-lg`}>
                {gamePhase === 'crashed'
                  ? `${(crashedAt ?? multiplier).toFixed(2)}x`
                  : `${multiplier.toFixed(2)}x`}
              </div>
              {gamePhase === 'crashed' && (
                <div className="mt-1 text-red-400 text-sm font-semibold uppercase tracking-widest animate-pulse">
                  CRASHED
                </div>
              )}
              {gamePhase === 'running' && inGame && myWin === null && (
                <div className="mt-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-400/30 text-green-300 text-sm">
                  Winning: {(betAmount * multiplier).toFixed(2)} GC
                </div>
              )}
              {myWin && (
                <div className="mt-2 px-4 py-1.5 rounded-full bg-supernova-gold/20 border border-supernova-gold/40 text-supernova-gold font-bold text-sm">
                  ✨ You won {myWin.amount.toFixed(2)} GC at {myWin.mult.toFixed(2)}x!
                </div>
              )}
            </div>

            {/* Provably fair hash */}
            {serverSeedHash && (
              <div className="absolute top-3 right-3 text-xs text-white/30 font-mono truncate max-w-[120px]" title={serverSeedHash}>
                🔒 {serverSeedHash.slice(0, 16)}…
              </div>
            )}
          </div>

          {/* History strip */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {history.map((h) => (
              <div
                key={h.id}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold font-mono ${historyColor(h.crashPoint)} cursor-default`}
                title={`Seed hash: ${h.serverSeedHash}`}
              >
                {h.crashPoint.toFixed(2)}x
              </div>
            ))}
            {history.length === 0 && (
              <div className="text-white/30 text-xs py-1.5">No rounds yet</div>
            )}
          </div>

          {/* Active Players Table */}
          <div className="rounded-xl bg-deep-space border border-nebula-gray/30 overflow-hidden">
            <div className="px-4 py-2 border-b border-nebula-gray/20 text-xs text-white/50 uppercase tracking-wider flex justify-between">
              <span>Players ({activePlayers.length})</span>
              <span>Bet / Win</span>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {activePlayers.length === 0 ? (
                <div className="px-4 py-6 text-center text-white/30 text-sm">Waiting for players…</div>
              ) : (
                activePlayers.map((p) => (
                  <div key={p.userId} className="px-4 py-2 flex items-center justify-between border-b border-nebula-gray/10 last:border-0 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: p.userId === userId ? '#8B5CF6' : '#374151' }} />
                      <span className={p.userId === userId ? 'text-electric-purple font-semibold' : 'text-white/70'}>
                        {p.username}
                      </span>
                    </div>
                    <div className="text-right">
                      {p.cashedOut ? (
                        <span className="text-green-400 font-mono text-xs">
                          +{p.winAmount?.toFixed(2)} GC @ {p.cashoutAt?.toFixed(2)}x
                        </span>
                      ) : (
                        <span className="text-white/50 font-mono text-xs">
                          {p.betAmount.toFixed(2)} GC
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Betting Panel */}
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl bg-deep-space border border-nebula-gray/30 p-5">
            <h2 className="text-lg font-display font-bold text-supernova-gold mb-4">Place Bet</h2>

            {/* Quick bet buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[10, 50, 100, goldCoins].map((v, i) => (
                <button
                  key={i}
                  onClick={() => setBetAmount(Math.floor(Math.min(v, goldCoins)))}
                  disabled={inGame || gamePhase === 'running' || gamePhase === 'crashed'}
                  className="py-1.5 text-xs rounded-lg font-semibold bg-nebula-gray/40 hover:bg-electric-purple/30 hover:text-electric-purple border border-nebula-gray/40 hover:border-electric-purple/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {i === 3 ? 'Max' : v}
                </button>
              ))}
            </div>

            {/* Bet amount input */}
            <div className="mb-3">
              <label className="block text-xs text-white/50 mb-1.5">Bet Amount (GC)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={goldCoins}
                  step={1}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, Math.min(goldCoins, parseFloat(e.target.value) || 1)))}
                  disabled={inGame || gamePhase === 'running'}
                  className="flex-1 bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-electric-purple/60 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
                <button
                  onClick={() => setBetAmount((prev) => Math.min(goldCoins, prev * 2))}
                  disabled={inGame || gamePhase === 'running'}
                  className="px-3 py-2 text-xs rounded-lg bg-nebula-gray/30 hover:bg-nebula-gray/50 border border-nebula-gray/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  2×
                </button>
                <button
                  onClick={() => setBetAmount((prev) => Math.max(1, Math.floor(prev / 2)))}
                  disabled={inGame || gamePhase === 'running'}
                  className="px-3 py-2 text-xs rounded-lg bg-nebula-gray/30 hover:bg-nebula-gray/50 border border-nebula-gray/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ½
                </button>
              </div>
            </div>

            {/* Auto cashout input */}
            <div className="mb-5">
              <label className="block text-xs text-white/50 mb-1.5">Auto Cashout At (optional)</label>
              <input
                type="number"
                min={1.01}
                step={0.01}
                placeholder="e.g. 2.00"
                value={autoCashoutAt}
                onChange={(e) => setAutoCashoutAt(e.target.value)}
                disabled={inGame}
                className="w-full bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-supernova-gold/60 disabled:opacity-50 disabled:cursor-not-allowed font-mono placeholder:text-white/20"
              />
            </div>

            {/* Action button */}
            {!inGame ? (
              <button
                onClick={handleJoin}
                disabled={gamePhase !== 'betting' || betAmount < 1 || betAmount > goldCoins}
                className="w-full py-3.5 rounded-xl font-display font-bold text-void-black bg-gold-gradient hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm tracking-wider uppercase"
              >
                {gamePhase === 'betting' ? `🚀 Bet ${betAmount} GC` : gamePhase === 'running' ? '⏳ In Progress…' : '⌛ Wait for Round'}
              </button>
            ) : (
              <button
                onClick={handleCashout}
                disabled={gamePhase !== 'running'}
                className="w-full py-3.5 rounded-xl font-display font-bold text-white bg-purple-gradient hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm tracking-wider uppercase animate-pulse"
              >
                💰 Cash Out @ {multiplier.toFixed(2)}x<br />
                <span className="text-xs opacity-80">{(betAmount * multiplier).toFixed(2)} GC</span>
              </button>
            )}

            {/* Status message */}
            {statusMsg && (
              <div className={`mt-3 p-2.5 rounded-lg text-xs text-center ${statusMsg.includes('won') || statusMsg.includes('Cashed') ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                {statusMsg}
              </div>
            )}
          </div>

          {/* Provably Fair card */}
          <div className="rounded-2xl bg-deep-space border border-nebula-gray/30 p-4">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">🔒 Provably Fair</h3>
            {serverSeedHash ? (
              <p className="text-xs text-white/40 font-mono break-all leading-5">{serverSeedHash}</p>
            ) : (
              <p className="text-xs text-white/30">No active round</p>
            )}
            <p className="text-xs text-white/30 mt-2">
              The server seed hash is shown before the round starts. After the crash, the actual seed is revealed for verification using HMAC-SHA256.
            </p>
          </div>

          {/* Game Stats */}
          <div className="rounded-2xl bg-deep-space border border-nebula-gray/30 p-4 grid grid-cols-2 gap-3">
            <StatCard label="House Edge" value="1%" />
            <StatCard label="Max Win" value="∞" />
            <StatCard label="Min Bet" value="1 GC" />
            <StatCard label="Tick Rate" value="50ms" />
          </div>
        </section>
      </main>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-white/40 mb-0.5">{label}</div>
      <div className="text-sm font-bold text-supernova-gold font-mono">{value}</div>
    </div>
  )
}

function StarField() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.5 + 0.2,
    delay: Math.random() * 3,
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white animate-pulse-slow"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Helper ─────────────────────────────────────────────────────────────────
function getUserIdFromToken(token: string): string | null {
  if (!token) return null
  try {
    const [, payload] = token.split('.')
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return decoded.sub ?? null
  } catch {
    return null
  }
}