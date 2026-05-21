/**
 * WebSocket singleton client for Nova Casino crash game.
 * Connects to the Durable Object WebSocket endpoint.
 * Auto-reconnects with exponential backoff (max 5 attempts).
 */

type EventHandler = (data: any) => void

interface SocketMessage {
  event: string
  data: any
}

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1000

class CrashSocketClient {
  private ws: WebSocket | null = null
  private token: string | null = null
  private listeners: Map<string, Set<EventHandler>> = new Map()
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false
  private connected = false

  /** Connect to the crash game websocket. Pass JWT token for auth. */
  connect(token: string): void {
    this.token = token
    this.intentionalClose = false
    this.reconnectAttempts = 0
    this._connect()
  }

  private _connect(): void {
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onmessage = null
      this.ws.onerror = null
      try { this.ws.close() } catch { /* ignore */ }
      this.ws = null
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = location.host
    const url = `${protocol}//${host}/api/ws/crash${this.token ? `?token=${encodeURIComponent(this.token)}` : ''}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.connected = true
      this.reconnectAttempts = 0
      this._emit('__connected', {})
    }

    this.ws.onclose = (event) => {
      this.connected = false
      this._emit('__disconnected', { code: event.code, reason: event.reason })
      if (!this.intentionalClose) {
        this._scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      this._emit('__error', { msg: 'WebSocket error' })
    }

    this.ws.onmessage = (event) => {
      let msg: SocketMessage
      try { msg = JSON.parse(event.data as string) } catch { return }
      if (msg.event === 'pong') return // heartbeat response
      this._emit(msg.event, msg.data)
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this._emit('__max_reconnects', {})
      return
    }
    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this._emit('__reconnecting', { attempt: this.reconnectAttempts })
      this._connect()
    }, delay)
  }

  /** Gracefully disconnect. Will not auto-reconnect. */
  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try { this.ws.close(1000, 'Client disconnecting') } catch { /* ignore */ }
      this.ws = null
    }
    this.connected = false
  }

  /** Register an event listener */
  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  /** Remove an event listener */
  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler)
  }

  /** Send a message to the server */
  send(event: string, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Socket] Cannot send: socket not open')
      return
    }
    this.ws.send(JSON.stringify({ event, data }))
  }

  /** Send a ping to keep connection alive */
  ping(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send('ping')
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  private _emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach((handler) => {
      try { handler(data) } catch (e) { console.error('[Socket] Handler error:', e) }
    })
  }
}

// Export singleton
const socket = new CrashSocketClient()
export default socket
export { CrashSocketClient }