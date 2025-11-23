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
      <div className="relative z-20 grid grid-cols-2 gap-3 p-2 min-w-[240px] bg-slate-900 rounded-lg border border-slate-800">
        {items.map(it => (
          <button
            key={it.key}
            data-key={it.key}
            onClick={() => { console.log('Tabs click', it.key); onChange(it.key); }}
            className={`text-xs py-2 px-4 min-w-[120px] rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer z-10 ${activeKey === it.key ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'}`}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="relative z-20 flex border-b border-slate-800 bg-slate-900">
      {items.map((it, index) => (
        <button
          key={it.key}
          data-key={it.key}
          onClick={() => { console.log('Tabs click', it.key); onChange(it.key); }}
          className={`relative flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2 cursor-pointer z-10 ${activeKey === it.key ? 'border-blue-500 text-blue-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'} ${index < items.length - 1 ? 'border-r-2 border-slate-700' : ''}`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

