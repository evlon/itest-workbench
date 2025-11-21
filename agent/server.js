import http from 'http'
import url from 'url'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000

const sessions = new Map()

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
    writeEvent(res, 'screenshot', { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', timestamp: Date.now() })
    writeEvent(res, 'dom-update', { html_snippet: '<div>preview</div>', interactive_elements: [] })
    if (!session.pingInterval) {
      session.pingInterval = setInterval(() => {
        for (const client of session.clients) {
          writeEvent(client, 'ping', { timestamp: Date.now() })
        }
      }, 5000)
    }
    req.on('close', () => {
      session.clients.delete(res)
      if (session.clients.size === 0 && session.pingInterval) {
        clearInterval(session.pingInterval)
        session.pingInterval = null
      }
    })
    return
  }

  if (req.method === 'POST' && pathname === '/session/start') {
    const body = await parseBody(req)
    const sessionId = genId()
    sessions.set(sessionId, {
      id: sessionId,
      url: body.url || '',
      headless: !!body.headless,
      clients: new Set(),
      pingInterval: null,
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
    for (const client of session.clients) writeEvent(client, 'log', { level: 'info', message: `exec: ${body.method} ${body.selector}`, timestamp: Date.now() })
    setTimeout(() => {
      for (const client of session.clients) writeEvent(client, 'screenshot', { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', timestamp: Date.now() })
      for (const client of session.clients) writeEvent(client, 'dom-update', { html_snippet: '<div>mock</div>', interactive_elements: [] })
      for (const client of session.clients) writeEvent(client, 'action-complete', { status: 'success', result: {} })
    }, 300)
    return sendJson(res, 200, { status: 'processing' })
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

  sendJson(res, 404, { error: 'not_found' })
})

server.listen(PORT)