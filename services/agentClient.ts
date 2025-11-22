const BASE_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:3000'

export const startSession = async (url: string, headless = false) => {
  const res = await fetch(`${BASE_URL}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, headless })
  })
  return res.json()
}

export const stopSession = async (sessionId: string) => {
  const res = await fetch(`${BASE_URL}/session/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  })
  return res.json()
}

export const act = async (sessionId: string, action: string) => {
  const res = await fetch(`${BASE_URL}/action/act`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, action, strategy: 'ai' })
  })
  return res.json()
}

export const exec = async (sessionId: string, selector: string, method: string) => {
  const res = await fetch(`${BASE_URL}/action/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, selector, method })
  })
  return res.json()
}

export const observe = async (sessionId: string, instruction: string) => {
  const res = await fetch(`${BASE_URL}/action/observe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, instruction })
  })
  return res.json()
}

export const keypress = async (sessionId: string, payload: { key?: string, text?: string, type: 'press' | 'type', ctrl?: boolean, alt?: boolean, shift?: boolean, meta?: boolean }) => {
  const res = await fetch(`${BASE_URL}/action/keypress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, ...payload })
  })
  return res.json()
}

export const focused = async (sessionId: string) => {
  const res = await fetch(`${BASE_URL}/action/focused?sessionId=${encodeURIComponent(sessionId)}`)
  return res.json()
}

export const startStream = async (sessionId: string, intervalMs?: number) => {
  const res = await fetch(`${BASE_URL}/stream/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, intervalMs })
  })
  return res.json()
}

export const stopStream = async (sessionId: string) => {
  const res = await fetch(`${BASE_URL}/stream/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  })
  return res.json()
}

export const hitTest = async (sessionId: string, x: number, y: number, mode: 'hover' | 'click' = 'hover') => {
  const res = await fetch(`${BASE_URL}/action/hit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, x, y, mode })
  })
  return res.json()
}

export const subscribeEvents = (sessionId: string, handlers: {
  onLog?: (data: any) => void,
  onDomUpdate?: (data: any) => void,
  onScreenshot?: (data: any) => void,
  onActionComplete?: (data: any) => void,
  onError?: (data: any) => void,
  onPing?: (data: any) => void,
}) => {
  const es = new EventSource(`${BASE_URL}/events?sessionId=${encodeURIComponent(sessionId)}`)
  es.addEventListener('log', (e: MessageEvent) => handlers.onLog?.(JSON.parse((e as any).data)))
  es.addEventListener('dom-update', (e: MessageEvent) => handlers.onDomUpdate?.(JSON.parse((e as any).data)))
  es.addEventListener('screenshot', (e: MessageEvent) => handlers.onScreenshot?.(JSON.parse((e as any).data)))
  es.addEventListener('action-complete', (e: MessageEvent) => handlers.onActionComplete?.(JSON.parse((e as any).data)))
  es.addEventListener('error', (e: MessageEvent) => handlers.onError?.(JSON.parse((e as any).data)))
  es.addEventListener('ping', (e: MessageEvent) => handlers.onPing?.(JSON.parse((e as any).data)))
  return () => es.close()
}