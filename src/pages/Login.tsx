import React, { useState } from 'react'
import { Link } from '../components/Router'

interface LoginProps {
  onLogin: (token: string) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json() as any
        if (!res.ok) {
          setError(data.error ?? 'Login failed')
          return
        }
        localStorage.setItem('nova_token', data.token)
        localStorage.setItem('nova_user', JSON.stringify(data.user))
        onLogin(data.token)
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username, dateOfBirth: dob }),
        })
        const data = await res.json() as any
        if (!res.ok) {
          if (data.error?.fieldErrors) {
            const msgs = Object.entries(data.error.fieldErrors)
              .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
              .join(' | ')
            setError(msgs)
          } else {
            setError(data.error ?? 'Registration failed')
          }
          return
        }
        localStorage.setItem('nova_token', data.token)
        localStorage.setItem('nova_user', JSON.stringify(data.user))
        onLogin(data.token)
      }
    } catch {
      setError('Network error, please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cosmic-gradient flex items-center justify-center px-4">
      {/* Background stars */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              opacity: Math.random() * 0.4 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl font-display font-black tracking-wider mb-1">
            <span className="text-supernova-gold">NOVA</span>
            <span className="text-electric-purple"> CASINO</span>
          </div>
          <p className="text-white/40 text-sm">Your Universe of Luck</p>
        </div>

        <div className="bg-deep-space/90 backdrop-blur border border-nebula-gray/30 rounded-2xl p-8 shadow-2xl shadow-electric-purple/10">
          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden border border-nebula-gray/30 mb-6">
            <button
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all ${mode === 'login' ? 'bg-electric-purple text-white' : 'text-white/50 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError('') }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all ${mode === 'register' ? 'bg-electric-purple text-white' : 'text-white/50 hover:text-white'}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className="w-full bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-electric-purple/70 placeholder:text-white/20"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-white/50 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-electric-purple/70 placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-electric-purple/70 placeholder:text-white/20"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Date of Birth (must be 18+)</label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 3600_000).toISOString().split('T')[0]}
                  className="w-full bg-void-black border border-nebula-gray/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-electric-purple/70"
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-display font-bold text-void-black bg-gold-gradient hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-wider uppercase mt-2"
            >
              {loading ? '⏳ Processing…' : mode === 'login' ? '🚀 Sign In' : '✨ Create Account'}
            </button>
          </form>

          {/* OAuth divider */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-nebula-gray/30" />
            <span className="text-xs text-white/30">or continue with</span>
            <div className="flex-1 h-px bg-nebula-gray/30" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-nebula-gray/40 text-sm text-white/70 hover:text-white hover:border-white/30 transition-all bg-white/5"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </a>
            <a
              href="/api/auth/discord"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-nebula-gray/40 text-sm text-white/70 hover:text-white hover:border-white/30 transition-all bg-white/5"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-indigo-400" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.033.06a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Discord
            </a>
          </div>

          {mode === 'register' && (
            <p className="mt-5 text-xs text-white/30 text-center leading-relaxed">
              By creating an account you agree to our{' '}
              <a href="/tos" className="text-electric-purple hover:underline">Terms of Service</a>.
              This is a <strong className="text-white/50">free-to-play sweepstakes</strong> platform.
              No real money gambling.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}