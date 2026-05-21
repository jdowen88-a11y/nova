import React, { useState, useEffect } from 'react'
import Login from './pages/Login'
import Lobby from './pages/Lobby'
import Crash from './pages/Crash'
import Profile from './pages/Profile'
import TOS from './pages/TOS'

type Page = 'lobby' | 'crash' | 'profile' | 'tos' | 'login'

function getInitialPage(token: string | null): Page {
  if (!token) return 'login'
  const path = window.location.pathname
  if (path === '/crash') return 'crash'
  if (path === '/profile') return 'profile'
  if (path === '/tos') return 'tos'
  return 'lobby'
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    // Check URL token (from OAuth redirect)
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      localStorage.setItem('nova_token', urlToken)
      window.history.replaceState(null, '', window.location.pathname)
      return urlToken
    }
    return localStorage.getItem('nova_token')
  })

  const [page, setPage] = useState<Page>(() => getInitialPage(token))
  const [tosAccepted, setTosAccepted] = useState<boolean>(false)

  // Check TOS status when token changes
  useEffect(() => {
    if (!token) return
    const user = (() => { try { return JSON.parse(localStorage.getItem('nova_user') ?? '{}') } catch { return {} } })()
    if (user.tosAcceptedAt) setTosAccepted(true)
    else {
      // Fetch fresh user data
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((u: any) => {
          if (u) {
            localStorage.setItem('nova_user', JSON.stringify(u))
            setTosAccepted(!!u.tosAcceptedAt)
          }
        })
        .catch(() => {})
    }
  }, [token])

  // Listen for popstate (browser back/forward)
  useEffect(() => {
    const handler = () => {
      const path = window.location.pathname
      if (path === '/crash') setPage('crash')
      else if (path === '/profile') setPage('profile')
      else if (path === '/tos') setPage('tos')
      else setPage(token ? 'lobby' : 'login')
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [token])

  const navigate = (p: string) => {
    const pageMap: Record<string, Page> = {
      lobby: 'lobby',
      crash: 'crash',
      profile: 'profile',
      tos: 'tos',
    }
    const target = (pageMap[p] ?? 'lobby') as Page
    setPage(target)
    const pathMap: Record<Page, string> = {
      lobby: '/',
      crash: '/crash',
      profile: '/profile',
      tos: '/tos',
      login: '/',
    }
    window.history.pushState(null, '', pathMap[target])
  }

  const handleLogin = (t: string) => {
    setToken(t)
    const user = (() => { try { return JSON.parse(localStorage.getItem('nova_user') ?? '{}') } catch { return {} } })()
    if (!user.tosAcceptedAt) {
      setPage('tos')
    } else {
      setTosAccepted(true)
      setPage('lobby')
    }
  }

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      } catch {}
    }
    localStorage.removeItem('nova_token')
    localStorage.removeItem('nova_user')
    setToken(null)
    setTosAccepted(false)
    setPage('login')
    window.history.pushState(null, '', '/')
  }

  const handleTosAccepted = () => {
    setTosAccepted(true)
    const user = (() => { try { return JSON.parse(localStorage.getItem('nova_user') ?? '{}') } catch { return {} } })()
    if (user) {
      user.tosAcceptedAt = new Date().toISOString()
      localStorage.setItem('nova_user', JSON.stringify(user))
    }
    setPage('lobby')
    window.history.pushState(null, '', '/')
  }

  if (!token) return <Login onLogin={handleLogin} />
  if (!tosAccepted && page !== 'tos') {
    return <TOS token={token} onAccepted={handleTosAccepted} />
  }
  if (page === 'tos') return <TOS token={token} onAccepted={handleTosAccepted} />
  if (page === 'crash') return <Crash />
  if (page === 'profile') return <Profile token={token} />

  return <Lobby token={token} onNavigate={navigate} onLogout={handleLogout} />
}