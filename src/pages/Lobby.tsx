import React from 'react'

interface LobbyProps {
  token: string
  onNavigate: (page: string) => void
  onLogout: () => void
}

const GAMES = [
  { id: 'crash', emoji: '🚀', name: 'Crash', desc: 'Multiplier rocket — cash out before it crashes!', color: 'from-electric-purple/20 to-nebula-pink/10', border: 'border-electric-purple/30', badge: 'Live', badgeColor: 'bg-green-500/20 text-green-300' },
  { id: 'slots', emoji: '🎰', name: 'Nova Slots', desc: 'Spin cosmic reels for galactic wins', color: 'from-supernova-gold/10 to-orange-500/10', border: 'border-supernova-gold/20', badge: 'Soon', badgeColor: 'bg-white/10 text-white/40' },
  { id: 'mines', emoji: '💣', name: 'Mines', desc: 'Navigate asteroid fields for multiplied rewards', color: 'from-teal-500/10 to-blue-500/10', border: 'border-teal-500/20', badge: 'Soon', badgeColor: 'bg-white/10 text-white/40' },
  { id: 'plinko', emoji: '⚡', name: 'Plinko', desc: 'Drop through the cosmic grid', color: 'from-nebula-pink/10 to-purple-500/10', border: 'border-nebula-pink/20', badge: 'Soon', badgeColor: 'bg-white/10 text-white/40' },
]

export default function Lobby({ token, onNavigate, onLogout }: LobbyProps) {
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('nova_user') ?? '{}') } catch { return {} }
  })()

  const goldCoins = user.goldCoins ?? 0
  const novaCrystals = user.novaCrystals ?? 0
  const vipTier = user.vipTier ?? 'Stardust'

  return (
    <div className="min-h-screen bg-cosmic-gradient text-star-white">
      {/* Header */}
      <header className="border-b border-nebula-gray/30 px-4 sm:px-6 py-3 flex items-center justify-between bg-void-black/80 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="text-xl sm:text-2xl font-display font-bold text-supernova-gold tracking-wider">NOVA</span>
          <span className="text-xl sm:text-2xl font-display font-bold text-electric-purple tracking-wider">CASINO</span>
        </div>
        <nav className="hidden sm:flex items-center gap-4 text-sm text-white/60">
          <button onClick={() => onNavigate('lobby')} className="hover:text-white transition-colors">Games</button>
          <button onClick={() => onNavigate('profile')} className="hover:text-white transition-colors">Profile</button>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end text-xs">
            <span className="text-supernova-gold font-semibold">{goldCoins.toFixed(0)} GC</span>
            <span className="text-electric-purple">{novaCrystals.toFixed(0)} NC</span>
          </div>
          <button
            onClick={() => onNavigate('profile')}
            className="w-8 h-8 rounded-full bg-electric-purple/20 border border-electric-purple/30 text-xs font-bold text-electric-purple hover:bg-electric-purple/30 transition-all"
          >
            {(user.username ?? 'U').slice(0, 2).toUpperCase()}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <section className="text-center mb-12 relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
            <div className="text-[200px]">🌌</div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-supernova-gold via-electric-purple to-nebula-pink mb-3">
            Welcome Back, {user.username ?? 'Player'}!
          </h1>
          <p className="text-white/50">Your universe of luck awaits</p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-electric-purple/10 border border-electric-purple/20">
            <span className="text-electric-purple text-sm font-semibold">⭐ {vipTier}</span>
          </div>
        </section>

        {/* Games Grid */}
        <section>
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-5">Games</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GAMES.map((game) => (
              <div
                key={game.id}
                onClick={() => game.badge === 'Live' ? onNavigate(game.id) : undefined}
                className={`relative rounded-2xl border bg-gradient-to-br p-5 ${game.color} ${game.border} ${game.badge === 'Live' ? 'cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-electric-purple/10' : 'opacity-60 cursor-not-allowed'} transition-all duration-300`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="text-4xl">{game.emoji}</div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${game.badgeColor}`}>
                    {game.badge}
                  </span>
                </div>
                <h3 className="font-display font-bold text-white mb-1">{game.name}</h3>
                <p className="text-xs text-white/50">{game.desc}</p>
                {game.badge === 'Live' && (
                  <div className="mt-4 text-xs text-electric-purple font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Play Now →
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-deep-space border border-nebula-gray/30 rounded-2xl p-5">
            <div className="text-2xl mb-2">📬</div>
            <h3 className="font-semibold text-sm mb-1">Free Nova Crystals</h3>
            <p className="text-xs text-white/40 mb-3">Submit an AMOE request to receive 100 NC for free — no purchase necessary.</p>
            <button onClick={() => onNavigate('profile')} className="text-xs text-electric-purple hover:underline">Submit request →</button>
          </div>
          <div className="bg-deep-space border border-nebula-gray/30 rounded-2xl p-5">
            <div className="text-2xl mb-2">🛡️</div>
            <h3 className="font-semibold text-sm mb-1">Responsible Gaming</h3>
            <p className="text-xs text-white/40 mb-3">Set session time limits or self-exclude from the platform at any time.</p>
            <button onClick={() => onNavigate('profile')} className="text-xs text-electric-purple hover:underline">Manage limits →</button>
          </div>
          <div className="bg-deep-space border border-nebula-gray/30 rounded-2xl p-5">
            <div className="text-2xl mb-2">⭐</div>
            <h3 className="font-semibold text-sm mb-1">VIP Program</h3>
            <p className="text-xs text-white/40 mb-3">Earn VIP XP by playing. Advance through 7 tiers for exclusive perks.</p>
            <button onClick={() => onNavigate('profile')} className="text-xs text-electric-purple hover:underline">View tiers →</button>
          </div>
        </section>

        {/* Footer disclaimer */}
        <footer className="mt-12 text-center text-xs text-white/20 space-y-1">
          <p>Nova Casino is a <strong className="text-white/30">free-to-play sweepstakes</strong> social casino. No real money gambling.</p>
          <p>
            <button onClick={() => onNavigate('tos')} className="hover:text-white/40 transition-colors underline">Terms of Service</button>
            {' · '}
            <span>Problem Gambling? Call 1-800-522-4700</span>
            {' · '}
            <button onClick={onLogout} className="hover:text-white/40 transition-colors">Sign Out</button>
          </p>
        </footer>
      </main>
    </div>
  )
}
