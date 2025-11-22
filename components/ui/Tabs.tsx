import React from 'react'

export interface TabItem {
  key: string
  label: React.ReactNode
  icon?: React.ReactNode
}

export interface TabsProps {
  items: TabItem[]
  activeKey: string
  onChange: (key: string) => void
  variant?: 'segmented' | 'underline'
}

export const Tabs: React.FC<TabsProps> = ({ items, activeKey, onChange, variant = 'underline' }) => {
  if (variant === 'segmented') {
    return (
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800">
        {items.map(it => (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={`text-xs py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-2 ${activeKey === it.key ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="flex border-b border-slate-800 bg-slate-900">
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2 ${activeKey === it.key ? 'border-blue-500 text-blue-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

