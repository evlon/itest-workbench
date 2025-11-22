import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning'
type Size = 'sm' | 'md'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const base = 'inline-flex items-center gap-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
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

export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', size = 'sm', className = '', ...props }) => {
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`
  return <button className={cls} {...props} />
}

