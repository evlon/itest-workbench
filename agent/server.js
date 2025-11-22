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
    const urlToOpen = body.url || ''
    const headlessReq = typeof body.headless === 'boolean' ? body.headless : true

    if (!headlessReq) {
      const existing = Array.from(sessions.values()).find(s => s && s.headless === false)
      if (existing) {
        try {
          if (urlToOpen) {
            await existing.page.goto(urlToOpen, { waitUntil: 'load', timeout: 15000 })
            let shot = ''
            try { shot = (await existing.page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 }))?.toString('base64') || '' } catch {}
            existing.lastScreenshot = shot
            for (const client of existing.clients) writeEvent(client, 'screenshot', { base64: shot, timestamp: Date.now() })
          }
        } catch {}
        return sendJson(res, 200, { sessionId: existing.id, reused: true })
      }
    }

    const sessionId = genId()
    const browser = await chromium.launch({ headless: headlessReq })
    const context = await browser.newContext()
    const page = await context.newPage()
    if (urlToOpen) {
      try { await page.goto(urlToOpen, { waitUntil: 'load', timeout: 15000 }) } catch {}
    }
    let shot = ''
    try { shot = (await page.screenshot({ fullPage: true }))?.toString('base64') || '' } catch {}
    const dpr = await page.evaluate(() => window.devicePixelRatio || 1)
    const vp = page.viewportSize() || { width: 1280, height: 720 }
    sessions.set(sessionId, {
      id: sessionId,
      url: urlToOpen,
      headless: headlessReq,
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
      devicePixelRatio: dpr,
      viewport: vp,
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

  if (req.method === 'POST' && pathname === '/action/assert') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    const page = session.page
    const selector = String(body.selector || '')
    const type = String(body.type || 'visible')
    const expectedText = typeof body.text === 'string' ? body.text : ''
    const timeoutMs = typeof body.timeoutMs === 'number' ? body.timeoutMs : 3000
    let ok = false
    try {
      if (type === 'visible') {
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: timeoutMs })
        ok = await page.locator(selector).first().isVisible()
      } else if (type === 'text') {
        await page.locator(selector).first().waitFor({ state: 'attached', timeout: timeoutMs })
        const txt = await page.locator(selector).first().innerText()
        ok = typeof txt === 'string' && txt.includes(expectedText)
      }
    } catch {}
    let shot = ''
    let html = ''
    try {
      const buf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 })
      const hash = createHash('md5').update(buf).digest('hex')
      if (hash !== session.lastHash) {
        session.lastHash = hash
        shot = buf.toString('base64')
        session.lastScreenshot = shot
        for (const client of session.clients) writeEvent(client, 'screenshot', { base64: shot, timestamp: Date.now() })
        for (const ws of session.wsClients) { if (ws.readyState === 1) { try { ws.send(buf) } catch {} } }
      }
    } catch {}
    try {
      html = await page.evaluate((sel) => {
        const el = sel ? document.querySelector(sel) : document.body
        if (!el) return ''
        const wrap = document.createElement('div')
        wrap.appendChild(el.cloneNode(true))
        return wrap.innerHTML.slice(0, 5000)
      }, selector)
    } catch {}
    for (const client of session.clients) writeEvent(client, 'action-complete', { status: ok ? 'success' : 'failed', result: { type, selector, expectedText, snapshot: shot ? shot.slice(0, 120) : '', html_snippet: html } })
    return sendJson(res, 200, { ok, html })
  }

  if (req.method === 'POST' && pathname === '/action/wait') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    const ms = typeof body.ms === 'number' ? Math.max(0, body.ms) : 500
    await new Promise(r => setTimeout(r, ms))
    let shot = ''
    try {
      const buf = await session.page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 })
      shot = buf.toString('base64')
      session.lastScreenshot = shot
      for (const client of session.clients) writeEvent(client, 'screenshot', { base64: shot, timestamp: Date.now() })
    } catch {}
    for (const client of session.clients) writeEvent(client, 'action-complete', { status: 'success', result: { waitedMs: ms } })
    return sendJson(res, 200, { status: 'ok' })
  }

  if (req.method === 'POST' && pathname === '/action/smartwait') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    const page = session.page
    const selector = typeof body.selector === 'string' ? body.selector : ''
    const timeoutMs = typeof body.timeoutMs === 'number' ? body.timeoutMs : 3000
    const wantNetwork = body.networkIdle !== false
    const wantStable = body.stability !== false
    let ok = true
    try {
      if (wantNetwork) {
        try { await page.waitForLoadState('networkidle', { timeout: timeoutMs }) } catch {}
      }
      if (wantStable && selector) {
        const stable = await (async () => {
          const samples = []
          for (let i = 0; i < 3; i++) {
            const rect = await page.evaluate((sel) => {
              const el = document.querySelector(sel)
              if (!el) return null
              const r = el.getBoundingClientRect()
              return { x: r.left, y: r.top, w: r.width, h: r.height }
            }, selector)
            samples.push(rect)
            await new Promise(r => setTimeout(r, 200))
          }
          if (!samples[0] || !samples[1] || !samples[2]) return false
          const diff = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h)
          return diff(samples[0], samples[1]) < 2 && diff(samples[1], samples[2]) < 2
        })()
        ok = ok && stable
      }
    } catch {}
    let shot = ''
    try {
      const buf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 })
      shot = buf.toString('base64')
      session.lastScreenshot = shot
      for (const client of session.clients) writeEvent(client, 'screenshot', { base64: shot, timestamp: Date.now() })
    } catch {}
    for (const client of session.clients) writeEvent(client, 'action-complete', { status: ok ? 'success' : 'failed', result: { selector, timeoutMs } })
    return sendJson(res, 200, { ok })
  }

  if (req.method === 'POST' && pathname === '/action/keypress') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    const page = session.page
    for (const client of session.clients) writeEvent(client, 'log', { level: 'info', message: `keypress: ${body.type} ${body.key || body.text || ''}`, timestamp: Date.now() })
    try {
      if (body.type === 'type' && typeof body.text === 'string') {
        await page.keyboard.type(body.text)
      } else if (body.type === 'press' && typeof body.key === 'string') {
        await page.keyboard.press(body.key, { modifiers: [body.ctrl ? 'Control' : null, body.alt ? 'Alt' : null, body.shift ? 'Shift' : null, body.meta ? 'Meta' : null].filter(Boolean) })
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

  if (req.method === 'GET' && pathname === '/action/focused') {
    const sessionId = parsed.query.sessionId
    const session = sessions.get(sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    const page = session.page
    let result = null
    try {
      result = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return null
        const buildSelector = (node) => {
          if (!node) return ''
          const tag = node.tagName ? node.tagName.toLowerCase() : ''
          const id = node.id ? `#${CSS.escape(node.id)}` : ''
          const testid = node.getAttribute('data-testid')
          const name = node.getAttribute('name')
          const aria = node.getAttribute('aria-label')
          if (id) return id
          if (testid) return `[data-testid="${CSS.escape(testid)}"]`
          if (aria) return `[aria-label="${CSS.escape(aria)}"]`
          if (name) return `${tag}[name="${CSS.escape(name)}"]`
          const classes = Array.from(node.classList || [])
          const stable = classes.filter(c => c && c.length <= 24 && !/\d{4,}/.test(c)).slice(0, 2)
          if (stable.length) return `${tag}.${stable.map(c => CSS.escape(c)).join('.')}`
          let path = tag
          let cur = node
          while (cur && cur.parentElement) {
            const parent = cur.parentElement
            const children = Array.from(parent.children)
            const idx = children.indexOf(cur) + 1
            path = `${parent.tagName.toLowerCase()} > ${path}:nth-child(${idx})`
            cur = parent
            if (path.length > 120) break
          }
          return path
        }
        const rect = el.getBoundingClientRect()
        const text = (el.textContent || '').trim().slice(0, 80)
        const selector = buildSelector(el)
        return {
          description: `${el.tagName.toLowerCase()}${text ? `: ${text}` : ''}`,
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          selectors: { precise: selector, text }
        }
      })
    } catch {}
    if (!result) return sendJson(res, 200, { focused: null })
    return sendJson(res, 200, { focused: result })
  }

  if (req.method === 'GET' && pathname === '/session/meta') {
    const sessionId = parsed.query.sessionId
    const session = sessions.get(sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    return sendJson(res, 200, { devicePixelRatio: session.devicePixelRatio || 1, viewport: session.viewport || { width: 0, height: 0 } })
  }

  if (req.method === 'POST' && pathname === '/action/hit') {
    const body = await parseBody(req)
    const session = sessions.get(body.sessionId)
    if (!session) return sendJson(res, 400, { error: 'invalid_session' })
    const x = Number(body.x)
    const y = Number(body.y)
    const mode = body.mode === 'click' ? 'click' : 'hover'
    const page = session.page
    let result = null
    try {
      result = await page.evaluate(({ x, y, dpr, vp }) => {
        const cssX = Math.max(0, Math.min(Math.round(x / (dpr || 1)), (vp?.width || window.innerWidth) - 1))
        const cssY = Math.max(0, Math.min(Math.round(y / (dpr || 1)), (vp?.height || window.innerHeight) - 1))
        const el = document.elementFromPoint(cssX, cssY)
        if (!el) return null

        const buildSelector = (node) => {
          if (!node) return ''
          const tag = node.tagName ? node.tagName.toLowerCase() : ''
          const id = node.id ? `#${CSS.escape(node.id)}` : ''
          const testid = node.getAttribute('data-testid')
          const name = node.getAttribute('name')
          const aria = node.getAttribute('aria-label')
          if (id) return id
          if (testid) return `[data-testid="${CSS.escape(testid)}"]`
          if (aria) return `[aria-label="${CSS.escape(aria)}"]`
          if (name) return `${tag}[name="${CSS.escape(name)}"]`
          const classes = Array.from(node.classList || [])
          const stable = classes.filter(c => c && c.length <= 24 && !/\d{4,}/.test(c)).slice(0, 2)
          if (stable.length) return `${tag}.${stable.map(c => CSS.escape(c)).join('.')}`
          // fallback path
          let path = tag
          let cur = node
          while (cur && cur.parentElement) {
            const parent = cur.parentElement
            const children = Array.from(parent.children)
            const idx = children.indexOf(cur) + 1
            path = `${parent.tagName.toLowerCase()} > ${path}:nth-child(${idx})`
            cur = parent
            if (path.length > 120) break
          }
          return path
        }

        const rect = el.getBoundingClientRect()
        const text = (el.textContent || '').trim().slice(0, 80)
        const selector = buildSelector(el)
        return {
          description: `${el.tagName.toLowerCase()}${text ? `: ${text}` : ''}`,
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          selectors: { precise: selector, text }
        }
      }, { x, y, dpr: session.devicePixelRatio, vp: session.viewport })
    } catch {}
    if (!result) {
      try { console.log('[hit] miss', { x, y, mode }) } catch {}
      return sendJson(res, 200, { hit: null })
    }
    try { console.log('[hit] element', { x, y, mode, selector: result.selectors?.precise }) } catch {}
    for (const client of session.clients) {
      writeEvent(client, 'hit', { mode, element: result, timestamp: Date.now() })
    }
    return sendJson(res, 200, { hit: result })
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