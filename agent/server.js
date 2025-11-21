import http from 'http'
import url from 'url'
import { chromium } from 'playwright'
import { WebSocketServer } from 'ws'
import { createHash } from 'crypto'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000

const sessions = new Map()

async function captureAndBroadcast(session) {
  try {
    const buf = await session.page.screenshot({ type: 'jpeg', quality: 60 })
    const hash = createHash('md5').update(buf).digest('hex')
    if (hash !== session.lastHash) {
      session.lastHash = hash
      const base64 = buf.toString('base64')
      session.lastScreenshot = base64
      for (const client of session.clients) {
        writeEvent(client, 'screenshot', { base64, timestamp: Date.now() })
      }
      for (const ws of session.wsClients) {
        if (ws.readyState === 1) {
          try { ws.send(buf) } catch {}
        }
      }
    }
  } catch {}
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sendJson(res, status, obj) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = status
  res.end(JSON.stringify(obj))
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function writeEvent(res, type, payload) {
  res.write(`event: ${type}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function genId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true)
  const pathname = parsed.pathname || ''

  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
    res.statusCode = 204
    return res.end()
  }

  if (req.method === 'GET' && pathname === '/events') {
    const sessionId = parsed.query.sessionId
    if (!sessionId || !sessions.has(sessionId)) {
      return sendJson(res, 400, { error: 'invalid_session' })
    }
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const session = sessions.get(sessionId)
    session.clients.add(res)
    writeEvent(res, 'log', { level: 'info', message: 'connected', timestamp: Date.now() })
    if (session.lastScreenshot) writeEvent(res, 'screenshot', { base64: session.lastScreenshot, timestamp: Date.now() })
    writeEvent(res, 'dom-update', { html_snippet: '<div>preview</div>', interactive_elements: [] })
    if (session.streamEnabled && !session.streamTimer) {
      session.streamTimer = setInterval(() => captureAndBroadcast(session), session.streamIntervalMs || 1000)
    }
    if (!session.pingInterval) {
      session.pingInterval = setInterval(() => {
        for (const client of session.clients) {
          writeEvent(client, 'ping', { timestamp: Date.now() })
        }
      }, 5000)
    }
    req.on('close', () => {
      session.clients.delete(res)
      if (session.clients.size === 0) {
        if (session.pingInterval) {
          clearInterval(session.pingInterval)
          session.pingInterval = null
        }
        if (session.streamTimer) {
          clearInterval(session.streamTimer)
          session.streamTimer = null
        }
      }
    })
    return
  }

  if (req.method === 'POST' && pathname === '/session/start') {
    const body = await parseBody(req)
    const sessionId = genId()
    const urlToOpen = body.url || ''
    const headless = true
    const browser = await chromium.launch({ headless })
    const context = await browser.newContext()
    const page = await context.newPage()
    if (urlToOpen) {
      try { await page.goto(urlToOpen, { waitUntil: 'load', timeout: 15000 }) } catch {}
    }
    let shot = ''
    try { shot = (await page.screenshot({ fullPage: true }))?.toString('base64') || '' } catch {}
    sessions.set(sessionId, {
      id: sessionId,
      url: urlToOpen,
      headless,
      clients: new Set(),
      pingInterval: null,
      browser,
      context,
      page,
      lastScreenshot: shot,
      lastHash: '',
      streamTimer: null,
      streamIntervalMs: 1000,
      streamEnabled: false,
      wsClients: new Set(),
    })
    return sendJson(res, 200, { sessionId })
  }

  if (req.method === 'POST' && pathname === '/session/stop') {
    const body = await parseBody(req)
    const sessionId = body.sessionId
    const session = sessions.get(sessionId)
    if (session) {
      for (const client of session.clients) client.end()
      if (session.pingInterval) clearInterval(session.pingInterval)
      if (session.streamTimer) { clearInterval(session.streamTimer); session.streamTimer = null }
      try { await session.page?.close() } catch {}
      try { await session.context?.close() } catch {}
      try { await session.browser?.close() } catch {}
      sessions.delete(sessionId)
    }
    return sendJson(res, 200, { status: 'ok' })
  }

  if (req.method === 'POST' && pathname === '/action/act') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    for (const client of session.clients) writeEvent(client, 'log', { level: 'info', message: `act: ${body.action}`, timestamp: Date.now() })
    setTimeout(() => {
      for (const client of session.clients) writeEvent(client, 'screenshot', { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', timestamp: Date.now() })
      for (const client of session.clients) writeEvent(client, 'dom-update', { html_snippet: '<div>mock</div>', interactive_elements: [] })
      for (const client of session.clients) writeEvent(client, 'action-complete', { status: 'success', result: {} })
    }, 300)
    return sendJson(res, 200, { status: 'processing' })
  }

  if (req.method === 'POST' && pathname === '/action/exec') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    const page = session.page
    for (const client of session.clients) writeEvent(client, 'log', { level: 'info', message: `exec: ${body.method} ${body.selector}`, timestamp: Date.now() })
    try {
      if (body.method === 'navigate' && body.selector) {
        await page.goto(body.selector, { waitUntil: 'load', timeout: 15000 })
      } else if (body.method === 'click' && body.selector) {
        await page.locator(body.selector).first().click({ timeout: 3000 })
      }
    } catch {}
    let shot = ''
    try {
      const buf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 })
      const hash = createHash('md5').update(buf).digest('hex')
      if (hash !== session.lastHash) {
        session.lastHash = hash
        shot = buf.toString('base64')
        session.lastScreenshot = shot
        for (const client of session.clients) writeEvent(client, 'screenshot', { base64: shot, timestamp: Date.now() })
        for (const ws of session.wsClients) {
          if (ws.readyState === 1) {
            try { ws.send(buf) } catch {}
          }
        }
      }
    } catch {}
    for (const client of session.clients) writeEvent(client, 'dom-update', { html_snippet: '<div>mock</div>', interactive_elements: [] })
    for (const client of session.clients) writeEvent(client, 'action-complete', { status: 'success', result: {} })
    return sendJson(res, 200, { status: 'processing' })
  }

  if (req.method === 'POST' && pathname === '/stream/start') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    session.streamEnabled = true
    if (typeof body.intervalMs === 'number' && body.intervalMs >= 250) {
      session.streamIntervalMs = body.intervalMs
    }
    if (!session.streamTimer) {
      session.streamTimer = setInterval(() => captureAndBroadcast(session), session.streamIntervalMs || 1000)
    }
    return sendJson(res, 200, { status: 'ok', intervalMs: session.streamIntervalMs })
  }

  if (req.method === 'POST' && pathname === '/stream/stop') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    session.streamEnabled = false
    if (session.streamTimer) {
      clearInterval(session.streamTimer)
      session.streamTimer = null
    }
    return sendJson(res, 200, { status: 'ok' })
  }

  if (req.method === 'POST' && pathname === '/action/observe') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    const elements = [
      { description: '输入框', selectors: { precise: 'input[name="q"]' } },
      { description: '提交按钮', selectors: { precise: '#submit' } },
    ]
    for (const client of session.clients) writeEvent(client, 'dom-update', { html_snippet: '<input/><button/>', interactive_elements: elements })
    return sendJson(res, 200, { elements })
  }

  if (req.method === 'POST' && pathname === '/config/model') {
    const modelName = process.env.MODEL_NAME || ''
    const provider = modelName.split('/')[0] || ''
    const model = modelName.split('/')[1] || ''
    return sendJson(res, 200, { provider, model })
  }

  if (req.method === 'GET' && pathname === '/test.html') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'text/html')
    res.statusCode = 200
    return res.end(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>测试页面</title><style>body{font-family:system-ui,Arial;padding:20px}section{margin-bottom:24px}label{display:block;margin-bottom:8px}</style></head><body><h1>工作台测试页面</h1><section><label>搜索：<input name="q" placeholder="输入关键词" /></label><button id="submit">提交</button></section><section><label for="category">类别：</label><select id="category"><option>手机</option><option>电脑</option><option>家电</option></select></section><section><label><input type="checkbox" id="agree"/> 我已阅读并同意</label></section><section><a href="#" aria-label="帮助">帮助链接</a></section></body></html>`)
  }

  sendJson(res, 404, { error: 'not_found' })
})

// WebSocket upgrade handling
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url, true)
  if ((parsed.pathname || '') !== '/ws') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const sessionId = parsed.query.sessionId
    if (!sessionId || !sessions.has(sessionId)) {
      try { ws.close(1008, 'invalid_session') } catch {}
      return
    }
    const session = sessions.get(sessionId)
    session.wsClients.add(ws)
    ws.on('close', () => {
      session.wsClients.delete(ws)
    })
  })
})

server.listen(PORT)