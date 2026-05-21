import React, { useState, useEffect } from 'react'

interface ProfileProps {
  token: string
}

interface UserProfile {
  id: string
  username: string
  email: string
  goldCoins: number
  novaCrystals: number
  vipTier: string
  vipProgress: number
  totalWagered: number
  totalWon: number
  gamesPlayed: number
  soundEnabled: number
  chatEnabled: number
  selfExclusionUntil: string | null
  sessionLimitMinutes: number | null
  createdAt: string
}

const VIP_TIERS = ['Stardust', 'Comet', 'Asteroid', 'Planet', 'Star', 'Supernova', 'Black Hole Elite']
const VIP_COLORS: Record<string, string> = {
  Stardust: 'text-gray-400',
  Comet: 'text-blue-400',
  Asteroid: 'text-orange-400',
  Planet: 'text-teal-400',
  Star: 'text-yellow-300',
  Supernova: 'text-electric-purple',
  'Black Hole Elite': 'text-nebula-pink',
}

export default function Profile({ token }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [selfExclusionMonths, setSelfExclusionMonths] = useState(6)
  const [sessionMinutes, setSessionMinutes] = useState(120)
  const [amoeForm, setAmoeForm] = useState({ name: '', address: '' })
  const [amoeRequests, setAmoeRequests] = useState<any[]>([])
  const [tab, setTab] = useState<'overview' | 'responsible' | 'amoe'>('overview')

  const loadProfile = async () => {
    try {
      const [profRes, amoeRes] = await Promise.all([
        fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/amoe/status', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (profRes.ok) setProfile(await profRes.json())
      if (amoeRes.ok) setAmoeRequests(await amoeRes.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [token])

  const showMsg = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }

  const updateSettings = async (settings: { soundEnabled?: number; chatEnabled?: number }) => {
    const res = await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    })
    if (res.ok) {
      const updated = await res.json() as UserProfile
      setProfile(updated)
      showMsg('Settings saved')
    }
  }

  const handleSelfExclude = async () => {
    const res = await fetch('/api/user/self-exclusion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ months: selfExclusionMonths }),
    })
    const data = await res.json() as any
    showMsg(data.msg ?? data.error ?? 'Done')
    await loadProfile()
  }

  const handleRemoveSelfExclusion = async () => {
    const res = await fetch('/api/user/self-exclusion', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json() as any
    showMsg(data.msg ?? data.error ?? 'Done')
    await loadProfile()
  }

  const handleSessionLimit = async () => {
    const res = await fetch('/api/user/session-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ minutes: sessionMinutes }),
    })
    const data = await res.json() as any
    showMsg(data.msg ?? data.error)
    await loadProfile()
  }

  const handleAmoeRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/amoe/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(amoeForm),
    })
    const data = await res.json() as any
    showMsg(data.msg ?? data.error ?? 'Done')
    if (res.ok) {
      setAmoeForm({ name: '', address: '' })
      await loadProfile()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cosmic-gradient flex items-center justify-center">
        <div className="text-electric-purple animate-pulse text-2xl">🌌 Loading…</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-cosmic-gradient flex items-center justify-center">
        <div className="text-red-400">Failed to load profile</div>
      </div>
    )
  }

  const tierIdx = VIP_TIERS.indexOf(profile.vipTier)

  return (
    <div className="min-h-screen bg-cosmic-gradient text-star-white">
      <header className="border-b border-nebula-gray/30 px-4 py-3 flex items-center justify-between bg-void-black/80 backdrop-blur">
        <div className="font-display font-bold">
          <span className="text-supernova-gold">NOVA</span>
          <span className="text-electric-purple"> CASINO</span>
        </div>
        <a href="/" className="text-sm text-white/50 hover:text-white transition-colors">← Back to Games</a>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-deep-space border border-nebula-gray/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-purple-gradient flex items-center justify-center text-2xl font-bold text-white">
              {profile.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">{profile.username}</h1>
              <p className="text-white/50 text-sm">{profile.email}</p>
              <p className={`text-sm font-semibold mt-0.5 ${VIP_COLORS[profile.vipTier] ?? 'text-white'}`}>
                ⭐ {profile.vipTier}
              </p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-supernova-gold font-bold text-lg">{(profile.goldCoins ?? 0).toFixed(2)} <span className="text-xs text-gray-400">GC</span></div>
              <div className="text-electric-purple font-semibold text-sm">{(profile.novaCrystals ?? 0).toFixed(2)} <span className="text-xs text-gray-400">NC</span></div>
            </div>
          </div>

          {/* VIP Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/40 mb-1.5">
              <span>{profile.vipTier}</span>
              <span>{tierIdx < VIP_TIERS.length - 1 ? VIP_TIERS[tierIdx + 1] : 'Max Tier'}</span>
            </div>
            <div className="h-2 bg-nebula-gray/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-gradient rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, profile.vipProgress ?? 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(['overview', 'responsible', 'amoe'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-electric-purple text-white' : 'bg-deep-space border border-nebula-gray/30 text-white/50 hover:text-white'}`}
            >
              {t === 'responsible' ? '🛡️ Responsible Gaming' : t === 'amoe' ? '📬 AMOE' : '📊 Overview'}
            </button>
          ))}
        </div>

        {msg && (
          <div className="mb-4 p-3 rounded-lg bg-electric-purple/10 border border-electric-purple/30 text-electric-purple text-sm">
            {msg}
          </div>
        )}

        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Wagered', value: `${(profile.totalWagered ?? 0).toFixed(2)} GC` },
              { label: 'Total Won', value: `${(profile.totalWon ?? 0).toFixed(2)} GC` },
              { label: 'Games Played', value: profile.gamesPlayed ?? 0 },
              { label: 'Member Since', value: new Date(profile.createdAt).toLocaleDateString() },
            ].map((s) => (
              <div key={s.label} className="bg-deep-space border border-nebula-gray/30 rounded-xl p-4 text-center">
                <div className="text-xs text-white/40 mb-1">{s.label}</div>
                <div className="text-base font-bold text-supernova-gold font-mono">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        {tab === 'overview' && (
          <div className="bg-deep-space border border-nebula-gray/30 rounded-2xl p-6">
            <h2 className="text-base font-semibold mb-4">Preferences</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-white/70">Sound Effects</span>
                <button
                  onClick={() => updateSettings({ soundEnabled: profile.soundEnabled ? 0 : 1 })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${profile.soundEnabled ? 'bg-electric-purple' : 'bg-nebula-gray/40'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.soundEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-white/70">Chat</span>
                <button
                  onClick={() => updateSettings({ chatEnabled: profile.chatEnabled ? 0 : 1 })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${profile.chatEnabled ? 'bg-electric-purple' : 'bg-nebula-gray/40'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.chatEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </label>
            </div>
          </div>
        )}

        {/* Responsible Gaming tab */}
        {tab === 'responsible' && (
          <div className="space-y-4">
            <div className="bg-deep-space border border-nebula-gray/30 rounded-2xl p-6">
              <h2 className="text-base font-semibold mb-1">Session Time Limit</h2>
              <p className="text-xs text-white/40 mb-4">Limit how long you can play in a single session (15–480 minutes).</p>
              <div className="flex gap-3">
                <input
                  type="number"
                  min={15}
                  max={480}
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(parseInt(e.target.value))}
                  className="w-32 bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-electric-purple/60 font-mono"
                />
                <span className="text-sm text-white/50 self-center">minutes</span>
                <button onClick={handleSessionLimit} className="px-4 py-2 rounded-lg bg-electric-purple/20 border border-electric-purple/40 text-electric-purple text-sm font-semibold hover:bg-electric-purple/30 transition-all">
                  Set Limit
                </button>
              </div>
              {profile.sessionLimitMinutes && (
                <p className="mt-2 text-xs text-green-400">✅ Current limit: {profile.sessionLimitMinutes} minutes</p>
              )}
            </div>

            <div className="bg-deep-space border border-red-500/20 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-red-400 mb-1">Self-Exclusion</h2>
              {profile.selfExclusionUntil ? (
                <div>
                  <p className="text-sm text-white/70 mb-3">
                    Account self-excluded until <strong className="text-red-300">{new Date(profile.selfExclusionUntil).toLocaleDateString()}</strong>
                  </p>
                  <button onClick={handleRemoveSelfExclusion} className="px-4 py-2 rounded-lg border border-red-500/40 text-red-300 text-sm font-semibold hover:bg-red-500/10 transition-all">
                    Request Removal (24-hour cooling period)
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-white/40 mb-4">Once activated, self-exclusion cannot be immediately reversed. A 24-hour cooling period applies to removal requests.</p>
                  <div className="flex gap-3">
                    <select
                      value={selfExclusionMonths}
                      onChange={(e) => setSelfExclusionMonths(parseInt(e.target.value))}
                      className="bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {[1, 3, 6, 12, 24, 60].map((m) => (
                        <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                    <button onClick={handleSelfExclude} className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 text-sm font-semibold hover:bg-red-600/30 transition-all">
                      Self-Exclude
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AMOE tab */}
        {tab === 'amoe' && (
          <div className="space-y-4">
            <div className="bg-deep-space border border-nebula-gray/30 rounded-2xl p-6">
              <h2 className="text-base font-semibold mb-1">Alternate Method Of Entry</h2>
              <p className="text-xs text-white/40 mb-4 leading-relaxed">
                No purchase necessary. To receive 100 Nova Crystals for free, submit your name and mailing address below (once per 30 days). A written request may also be sent by mail.
              </p>
              <form onSubmit={handleAmoeRequest} className="space-y-3">
                <input
                  type="text"
                  required
                  minLength={2}
                  value={amoeForm.name}
                  onChange={(e) => setAmoeForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Full legal name"
                  className="w-full bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-electric-purple/60 placeholder:text-white/20"
                />
                <textarea
                  required
                  minLength={10}
                  value={amoeForm.address}
                  onChange={(e) => setAmoeForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Full mailing address (street, city, state, ZIP)"
                  rows={3}
                  className="w-full bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-electric-purple/60 placeholder:text-white/20 resize-none"
                />
                <button type="submit" className="px-5 py-2.5 rounded-lg bg-purple-gradient text-white text-sm font-semibold hover:opacity-90 transition-all">
                  📬 Submit AMOE Request
                </button>
              </form>
            </div>

            {amoeRequests.length > 0 && (
              <div className="bg-deep-space border border-nebula-gray/30 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-nebula-gray/20 text-xs text-white/50 uppercase tracking-wider">Your Requests</div>
                {amoeRequests.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between border-b border-nebula-gray/10 last:border-0 text-sm">
                    <div>
                      <div className="text-white/80">{r.name}</div>
                      <div className="text-white/40 text-xs">{new Date(r.requestedAt).toLocaleDateString()}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      r.status === 'fulfilled' ? 'bg-green-500/20 text-green-300' :
                      r.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}