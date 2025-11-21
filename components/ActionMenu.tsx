import React from 'react';
import { MousePointer2, Type, Eye, CheckCircle, X } from 'lucide-react';
import { StepTarget, StepType } from '../types';

interface ActionMenuProps {
  isOpen: boolean;
  target: StepTarget | null;
  onClose: () => void;
  onActionSelect: (action: 'click' | 'input' | 'assertVisible' | 'assertText') => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ isOpen, target, onClose, onActionSelect }) => {
  if (!isOpen || !target) {
    return null;
  }

  const handleActionClick = (action: 'click' | 'input' | 'assertVisible' | 'assertText') => {
    onActionSelect(action);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-in fade-in-50" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 w-96 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-100">选择操作</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
                <X size={20}/>
            </button>
        </div>
        
        <div className="mb-4">
            <p className="text-sm text-slate-400">元素:</p>
            <div className="bg-slate-800 p-2 rounded text-xs text-blue-300 font-mono break-all">
                {target.description}
                <p className="text-slate-500 text-[10px] mt-1">{target.selectors.precise}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
            <button
                onClick={() => handleActionClick('click')}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded flex items-center gap-3 transition-colors group"
            >
                <MousePointer2 size={16} className="text-slate-500 group-hover:text-blue-400" />
                <span>点击 (Click)</span>
            </button>
            <button
                onClick={() => handleActionClick('input')}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded flex items-center gap-3 transition-colors group"
            >
                <Type size={16} className="text-slate-500 group-hover:text-blue-400" />
                <span>输入 (Input)</span>
            </button>
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
        </div>
      </div>
    </div>
  );
};
