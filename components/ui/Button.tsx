import React, { useEffect, useMemo, useRef, useState } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning'
type Size = 'sm' | 'md'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: React.ReactElement
  label?: string
  tooltip?: string
  ariaLabel?: string
}

const base = 'inline-flex items-center gap-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const sizes: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2'
}
const variants: Record<Variant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 border border-slate-700',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  warning: 'bg-yellow-700/20 text-yellow-400 border border-yellow-700/50'
}

export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', size = 'sm', className = '', icon, label, tooltip, ariaLabel, children, ...props }) => {
  const btnRef = useRef<HTMLButtonElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const iconEl = useMemo(() => {
    if (!icon) return null
    try {
      return React.cloneElement(icon, { size: 16 })
    } catch {
      return icon
    }
  }, [icon])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const el = btnRef.current
    const lab = labelRef.current
    if (!el || !lab) return
    const calc = () => {
      try {
        const padX = 12 // approximate horizontal padding for sm/md variants
        const gap = 8
        const iconW = iconEl ? 16 : 0
        const need = iconW + (iconEl ? gap : 0) + lab.scrollWidth + padX * 2
        const has = el.clientWidth
        setCollapsed(has < need)
      } catch {}
    }
    const RO = (window as any).ResizeObserver
    const ro = RO ? new RO(() => calc()) : null
    calc()
    if (ro && el) ro.observe(el)
    return () => { try { ro && el && ro.unobserve(el) } catch {} }
  }, [iconEl, label])

  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`
  const aria = ariaLabel || label || (typeof children === 'string' ? children : undefined)

  return (
    <button ref={btnRef} className={cls} aria-label={aria} data-collapsed={collapsed ? 'true' : 'false'} {...props}>
      {iconEl}
      {label && (
        <span ref={labelRef} className="btn-label whitespace-nowrap transition-all duration-300 ease-in-out" style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }} aria-hidden={collapsed}>
          {label}
        </span>
      )}
      {!label && children}
    </button>
  )
}
