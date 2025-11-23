import React, { useEffect, useId, useRef, useState } from 'react'

export interface TooltipProps {
  content: string
  delay?: number
  children: React.ReactElement
}

export const Tooltip: React.FC<TooltipProps> = ({ content, delay = 200, children }) => {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number, left: number, placement: 'top' | 'bottom' } | null>(null)
  const tidRef = useRef<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipId = useId()

  const show = () => {
    if (tidRef.current) window.clearTimeout(tidRef.current)
    tidRef.current = window.setTimeout(() => {
      setVisible(true)
      calcPosition()
    }, delay)
  }
  const hide = () => {
    if (tidRef.current) window.clearTimeout(tidRef.current)
    tidRef.current = null
    setVisible(false)
  }
  const tap = () => {
    setVisible(true)
    calcPosition()
    window.setTimeout(() => setVisible(false), 1200)
  }

  const calcPosition = () => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const width = 240
    const height = 32
    const margin = 8
    const canTop = rect.top - height - margin > 0
    const placement = canTop ? 'top' : 'bottom'
    const top = placement === 'top' ? rect.top - height - margin : rect.bottom + margin
    let left = rect.left + rect.width / 2 - width / 2
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    if (left < margin) left = margin
    if (left + width > vw - margin) left = vw - margin - width
    setPos({ top, left, placement })
  }

  useEffect(() => () => { if (tidRef.current) window.clearTimeout(tidRef.current) }, [])

  const child = React.cloneElement(children, {
    'aria-describedby': visible ? tipId : undefined,
    onMouseEnter: (e: any) => { children.props.onMouseEnter?.(e); show() },
    onMouseLeave: (e: any) => { children.props.onMouseLeave?.(e); hide() },
    onFocus: (e: any) => { children.props.onFocus?.(e); show() },
    onBlur: (e: any) => { children.props.onBlur?.(e); hide() },
    onTouchStart: (e: any) => { children.props.onTouchStart?.(e); tap() },
  })

  return (
    <div ref={wrapRef} className="relative inline-block">
      {child}
      {visible && pos && (
        <div role="tooltip" id={tipId} className="fixed z-50" style={{ top: pos.top, left: pos.left }}>
          <div className="px-2.5 py-1 rounded bg-[rgba(0,0,0,0.75)] text-white text-[12px] leading-none shadow-lg transition-opacity duration-300 ease-in-out">
            {content}
            <div className={`absolute ${pos.placement === 'top' ? 'bottom-[-6px]' : 'top-[-6px]'} left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent ${pos.placement === 'top' ? 'border-t-[6px] border-t-[rgba(0,0,0,0.75)]' : 'border-b-[6px] border-b-[rgba(0,0,0,0.75)]'}`}></div>
          </div>
        </div>
      )}
    </div>
  )
}

