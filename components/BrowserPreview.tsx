import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Lock, MonitorPlay, Wifi, MousePointer2, Type as TypeIcon, Play } from 'lucide-react';

interface BrowserPreviewProps {
  url: string;
  onUrlChange: (url: string) => void;
  onElementSelect: (elementData: any) => void;
  isInspecting: boolean;
  screenshotBase64?: string;
  sessionId?: string;
  isStreaming?: boolean;
  isKeyRecording?: boolean;
  onToggleKeyRecording?: () => void;
  onPlaybackKeys?: () => void;
  onKeyEvent?: (evt: { type: 'down' | 'up'; key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }) => void;
  inspectTrigger?: 'ctrlOrMeta' | 'alt' | 'shift';
  keyCount?: number;
  textCount?: number;
  failureInfo?: { htmlSnippet: string; at: number } | null;
  onClearFailure?: () => void;
  onShowFailure?: () => void;
  failureRect?: { x: number; y: number; w: number; h: number } | null;
}

/**
 * NOTE: This is a placeholder/simulation of a Stagehand-powered browser preview.
 * In a real implementation, this component would host a VNC client (like noVNC)
 * connected to a remote browser managed by Stagehand.
 *
 * All interactions (hover, click) would be sent as commands to Stagehand,
 * which would then return the results. For this simulation, we are faking
 * these interactions and the returned data.
 */
export const BrowserPreview: React.FC<BrowserPreviewProps> = ({ url, onUrlChange, onElementSelect, isInspecting, screenshotBase64, sessionId, isStreaming, isKeyRecording, onToggleKeyRecording, onPlaybackKeys, onKeyEvent, inspectTrigger = 'ctrlOrMeta', keyCount = 0, textCount = 0, failureInfo, onClearFailure, onShowFailure, failureRect }) => {
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [overlay, setOverlay] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [frameSize, setFrameSize] = useState<{ w: number, h: number } | null>(null);
  const [failOverlay, setFailOverlay] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  // Simulate loading the remote browser session
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200); // Fake connection delay
    return () => clearTimeout(timer);
  }, [url]);

  // WS + Canvas rendering for low-latency frames
  useEffect(() => {
    const agentUrl = (import.meta as any).env?.VITE_AGENT_URL || 'http://localhost:3000'
    const wsScheme = agentUrl.startsWith('https') ? 'wss' : 'ws'
    const wsUrl = `${wsScheme}://${agentUrl.replace(/^https?:\/\//, '')}/ws?sessionId=${sessionId}`
    const metaUrl = `${agentUrl}/session/meta?sessionId=${sessionId}`

    const canvas = canvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return

    const resize = () => {
      const w = viewport.clientWidth
      const h = viewport.clientHeight
      if (w > 0 && h > 0) {
        canvas.width = w
        canvas.height = h
      }
    }
    resize()
    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(viewport)

    if (sessionId && isStreaming) {
      fetch(metaUrl).then(r => r.json()).then(m => {
        // optional: could use m.devicePixelRatio/m.viewport for extra mapping logic later
      }).catch(() => {})
      try {
        const ws = new WebSocket(wsUrl)
        ws.binaryType = 'arraybuffer'
        wsRef.current = ws
        ws.onopen = () => {}
        ws.onmessage = async (ev) => {
          const data = ev.data as ArrayBuffer
          if (!data) return
          const blob = new Blob([data], { type: 'image/jpeg' })
          try {
            const bmp = await createImageBitmap(blob)
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
              setFrameSize({ w: bmp.width, h: bmp.height })
              setIsLoading(false)
            }
          } catch {}
        }
        ws.onclose = () => {}
        ws.onerror = () => {}
      } catch {}
    }

    return () => {
      resizeObserver.disconnect()
      if (wsRef.current) {
        try { wsRef.current.close() } catch {}
        wsRef.current = null
      }
    }
  }, [sessionId, isStreaming])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (!sessionId || !isKeyRecording) return
      const payload = { type: 'down' as const, key: e.key, ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey }
      onKeyEvent?.(payload)
      fetch(`${(import.meta as any).env?.VITE_AGENT_URL || 'http://localhost:3000'}/action/keypress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, type: 'press', key: e.key, ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey })
      }).catch(() => {})
    }
    const onUp = (e: KeyboardEvent) => {
      if (!sessionId || !isKeyRecording) return
      const payload = { type: 'up' as const, key: e.key, ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey }
      onKeyEvent?.(payload)
    }
    if (isKeyRecording) {
      window.addEventListener('keydown', onDown)
      window.addEventListener('keyup', onUp)
    }
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [isKeyRecording, sessionId])

  useEffect(() => {
    const canvas = canvasRef.current
    const fs = frameSize
    if (!canvas || !fs || !failureRect) { setFailOverlay(null); return }
    setFailOverlay({
      x: failureRect.x * (canvas.width / fs.w),
      y: failureRect.y * (canvas.height / fs.h),
      width: failureRect.w * (canvas.width / fs.w),
      height: failureRect.h * (canvas.height / fs.h)
    })
  }, [failureRect, frameSize])

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUrlChange(inputUrl);
  };
  
  const handleViewportClick = (e: React.MouseEvent) => {
    if (!isLoading && sessionId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const canvas = canvasRef.current
      const fs = frameSize
      if (!canvas || !fs) return
      const scaleX = fs.w / canvas.width
      const scaleY = fs.h / canvas.height
      const px = Math.round(cx * scaleX)
      const py = Math.round(cy * scaleY)
      fetch(`${(import.meta as any).env?.VITE_AGENT_URL || 'http://localhost:3000'}/action/hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, x: px, y: py, mode: 'click' })
      }).then(r => r.json()).then(data => {
        const hit = data.hit
        if (hit && hit.selectors) {
          setOverlay(hit.rect ? {
            x: hit.rect.x * (canvas.width / fs.w),
            y: hit.rect.y * (canvas.height / fs.h),
            width: hit.rect.width * (canvas.width / fs.w),
            height: hit.rect.height * (canvas.height / fs.h)
          } : null)
          console.log('overlay-set', hit.rect)
          const triggerHit = inspectTrigger === 'ctrlOrMeta' ? (e.ctrlKey || (e as any).metaKey) : inspectTrigger === 'alt' ? !!e.altKey : !!e.shiftKey
          if (isInspecting && triggerHit) {
            onElementSelect({ target: { description: hit.description, selectors: hit.selectors }, ctrl: true })
          } else if (isInspecting && !triggerHit) {
            onElementSelect({ target: { description: hit.description, selectors: hit.selectors } })
          } else {
            const precise = hit.selectors?.precise || ''
            if (precise) {
              fetch(`${(import.meta as any).env?.VITE_AGENT_URL || 'http://localhost:3000'}/action/exec`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, selector: precise, method: 'click' })
              }).catch(() => {})
            }
          }
        }
      }).catch(() => {})
    }
  };

  const handleViewportMove = (e: React.MouseEvent) => {
    if (isInspecting && !isLoading && sessionId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const canvas = canvasRef.current
      const fs = frameSize
      if (!canvas || !fs) return
      const scaleX = fs.w / canvas.width
      const scaleY = fs.h / canvas.height
      const px = Math.round(cx * scaleX)
      const py = Math.round(cy * scaleY)
      setOverlay({ x: cx - 8, y: cy - 8, width: 16, height: 16 })
      fetch(`${(import.meta as any).env?.VITE_AGENT_URL || 'http://localhost:3000'}/action/hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, x: px, y: py, mode: 'hover' })
      }).then(r => r.json()).then(data => {
        const hit = data.hit
        if (hit && hit.rect) {
          setOverlay({
            x: hit.rect.x * (canvas.width / fs.w),
            y: hit.rect.y * (canvas.height / fs.h),
            width: hit.rect.width * (canvas.width / fs.w),
            height: hit.rect.height * (canvas.height / fs.h)
          })
          console.log('overlay-hover', hit.rect)
        }
      }).catch(() => {})
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Browser Toolbar */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-3 gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2 text-slate-400">
            <ArrowLeft size={16} className="text-slate-600" />
            <ArrowRight size={16} className="text-slate-600" />
            <RefreshCw size={14} className="hover:text-slate-200 cursor-pointer" onClick={() => onUrlChange(url)}/>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleKeyRecording} className={`text-xs px-2 py-1 rounded border ${isKeyRecording ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
            <span className="inline-flex items-center gap-1"><TypeIcon size={12} />{isKeyRecording ? '键盘录制中' : '开始键盘录制'}</span>
          </button>
          <button onClick={onPlaybackKeys} className="text-xs px-2 py-1 rounded border bg-slate-800 text-slate-300 border-slate-700">
            <span className="inline-flex items-center gap-1"><Play size={12} />播放录制</span>
          </button>
        </div>
        
        <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-full px-3 py-1.5 text-xs shadow-sm focus-within:border-blue-500 transition-colors">
             <Lock size={10} className="text-green-500 mr-2" />
             <input 
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder-slate-600 font-mono"
             />
        </form>
      </div>

      {/* Browser Viewport */}
      <div 
        ref={viewportRef}
        className={`flex-1 relative bg-gray-200 overflow-hidden ${isInspecting ? 'cursor-crosshair' : ''}`}
        onClick={handleViewportClick}
        onMouseMove={handleViewportMove}
      >
        {isLoading ? (
             <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50">
                 <div className="flex flex-col items-center gap-4">
                     <div className="relative">
                        <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <MonitorPlay size={20} className="text-blue-500" />
                        </div>
                     </div>
                     <p className="text-slate-400 text-sm font-mono animate-pulse">连接到 Stagehand 浏览器...</p>
                 </div>
             </div>
        ) : (
            <div className="w-full h-full relative bg-black">
              {isInspecting && (
                <div className="absolute inset-0 bg-blue-500/10 border-4 border-dashed border-blue-500/50 flex items-center justify-center pointer-events-none animate-pulse z-10">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                    <MousePointer2 size={16} />
                    <span className="font-bold">检查模式</span>
                  </div>
                </div>
              )}
              {isStreaming ? (
                <>
                  <canvas ref={canvasRef} className="w-full h-full" />
                </>
              ) : screenshotBase64 ? (
                <img src={`data:image/png;base64,${screenshotBase64}`} alt="preview" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">无预览</div>
              )}
              {overlay && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-30"
                  style={{ left: `${overlay.x}px`, top: `${overlay.y}px`, width: `${overlay.width}px`, height: `${overlay.height}px` }}
                />
              )}
              {failOverlay && (
                <div
                  className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none z-30"
                  style={{ left: `${failOverlay.x}px`, top: `${failOverlay.y}px`, width: `${failOverlay.width}px`, height: `${failOverlay.height}px` }}
                />
              )}
            </div>
        )}
      </div>

       {/* Status Bar */}
      <div className="h-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${!isLoading ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  {!isLoading ? 'Stagehand 已连接' : '正在连接...'}
              </span>
              {!isLoading && (
                  <span className="flex items-center gap-1 text-slate-600">
                      <Wifi size={10} /> 24ms 延迟
                  </span>
              )}
              {isKeyRecording && (
                <span className="flex items-center gap-1 text-green-500">录制中 · 按键 {keyCount} · 文本 {textCount}</span>
              )}
              {failureInfo && (
                <button onClick={onShowFailure} className="ml-2 text-red-400 hover:text-red-300">断言失败 · 查看详情</button>
              )}
          </div>
          <span className="text-slate-600">模拟远程浏览器</span>
      </div>
    </div>
  );
};