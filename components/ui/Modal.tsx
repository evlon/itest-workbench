import React from 'react'

export interface ModalProps {
  open: boolean
  title?: string
  onClose?: () => void
  children?: React.ReactNode
  footer?: React.ReactNode
  width?: number
}

export const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, footer, width = 560 }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className={`bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden`} style={{ width }}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">{title}</div>
          <button onClick={onClose} className="text-slate-400 text-xs">关闭</button>
        </div>
        <div className="p-4">{children}</div>
        {footer && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  )
}

