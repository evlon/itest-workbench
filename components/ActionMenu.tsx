import React from 'react';
import { MousePointer2, Type, Eye, CheckCircle, X as CloseIcon, Sparkles } from 'lucide-react';
import { Button } from './ui/Button'
import { Tooltip } from './ui/Tooltip'
import { StepTarget, StepType } from '../types';

interface ActionMenuProps {
  isOpen: boolean;
  target: StepTarget | null;
  onClose: () => void;
  onActionSelect: (action: 'click' | 'input' | 'assertVisible' | 'assertText' | 'custom') => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ isOpen, target, onClose, onActionSelect }) => {
  if (!isOpen || !target) {
    return null;
  }

  const handleActionClick = (action: 'click' | 'input' | 'assertVisible' | 'assertText' | 'custom') => {
    onActionSelect(action);
    onClose();
  };

  const guessType = () => {
    const s = target.selectors?.precise || ''
    if (/input|textarea|field/i.test(s)) return 'input'
    if (/button/i.test(s)) return 'button'
    if (/a\b|link/i.test(s)) return 'link'
    return 'element'
  }
  const etype = guessType()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-in fade-in-50" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 w-96 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-100">选择操作</h2>
            <Tooltip content="关闭">
              <Button ariaLabel="关闭" icon={<CloseIcon />} onClick={onClose} />
            </Tooltip>
        </div>
        
        <div className="mb-4">
            <p className="text-sm text-slate-400">元素:</p>
            <div className="bg-slate-800 p-2 rounded text-xs text-blue-300 font-mono break-all">
                {target.description}
                <p className="text-slate-500 text-[10px] mt-1">{target.selectors.precise}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
            {['button','link','element'].includes(etype) && (
              <button
                  onClick={() => handleActionClick('click')}
                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded flex items-center gap-3 transition-colors group"
              >
                  <MousePointer2 size={16} className="text-slate-500 group-hover:text-blue-400" />
                  <span>点击 (Click)</span>
              </button>
            )}
            {etype === 'input' && (
              <button
                  onClick={() => handleActionClick('input')}
                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded flex items-center gap-3 transition-colors group"
              >
                  <Type size={16} className="text-slate-500 group-hover:text-blue-400" />
                  <span>输入 (Input)</span>
              </button>
            )}
            <button
                onClick={() => handleActionClick('assertVisible')}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded flex items-center gap-3 transition-colors group"
            >
                <Eye size={16} className="text-slate-500 group-hover:text-blue-400" />
                <span>断言可见 (Assert Visible)</span>
            </button>
            <button
                onClick={() => handleActionClick('assertText')}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded flex items-center gap-3 transition-colors group"
            >
                <CheckCircle size={16} className="text-slate-500 group-hover:text-blue-400" />
                <span>断言文本 (Assert Text)</span>
            </button>
            <button
                onClick={() => handleActionClick('custom')}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded flex items-center gap-3 transition-colors group"
            >
                <Sparkles size={16} className="text-slate-500 group-hover:text-blue-400" />
                <span>自定义操作</span>
            </button>
        </div>
      </div>
    </div>
  );
};
