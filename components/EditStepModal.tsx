
import React, { useState, useEffect } from 'react';
import { X, Save, Link, Type, MousePointer2, CheckCircle, Hourglass } from 'lucide-react';
import { Step } from '../types';

interface EditStepModalProps {
  isOpen: boolean;
  step: Step | null;
  onClose: () => void;
  onSave: (updatedStep: Step) => void;
}

export const EditStepModal: React.FC<EditStepModalProps> = ({ isOpen, step, onClose, onSave }) => {
  const [intent, setIntent] = useState('');
  const [selector, setSelector] = useState('');
  const [params, setParams] = useState<Record<string, any>>({});

  useEffect(() => {
    if (step) {
      setIntent(step.intent || '');
      setSelector(step.target?.selectors?.precise || '');
      setParams(step.params || {});
    }
  }, [step, isOpen]);

  if (!isOpen || !step) return null;

  const handleSave = () => {
    const updatedStep: Step = {
      ...step,
      intent,
      target: {
        ...step.target,
        description: step.target?.description || 'Element',
        selectors: {
          ...step.target?.selectors,
          precise: selector
        }
      },
      params
    };
    onSave(updatedStep);
    onClose();
  };

  const renderParamInputs = () => {
    switch (step.action) {
      case 'navigate':
        return (
          <div className="space-y-2">
            <label className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2">
              <Link size={12} /> 目标 URL
            </label>
            <input
              type="text"
              value={params.url || ''}
              onChange={(e) => setParams({ ...params, url: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              placeholder="https://..."
            />
          </div>
        );
      case 'input':
        return (
          <div className="space-y-2">
            <label className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2">
              <Type size={12} /> 输入值 (Value)
            </label>
            <input
              type="text"
              value={params.value || ''}
              onChange={(e) => setParams({ ...params, value: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              placeholder="输入文本..."
            />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500">类型</label>
              <select
                value={params.valueType || 'string'}
                onChange={(e) => setParams({ ...params, valueType: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
              </select>
            </div>
          </div>
        );
      case 'wait':
         if (step.intent.includes('文本') || step.intent.includes('text')) {
             return (
              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2">
                  <CheckCircle size={12} /> 期望文本 (Expected Text)
                </label>
                <input
                  type="text"
                  value={params.text || ''}
                  onChange={(e) => setParams({ ...params, text: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                  placeholder="期望显示的文本..."
                />
              </div>
             )
         }
         return null;
      default:
        return null;
    }
  };

  const renderWaitConfig = () => {
    return (
      <div className="space-y-2 pt-2 border-t border-slate-800/50">
        <label className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2">
          <Hourglass size={12} /> 等待策略 (Wait Strategy)
        </label>
        <div className="flex items-center gap-3">
          <select
            value={params.waitMode || 'none'}
            onChange={(e) => setParams({ ...params, waitMode: e.target.value })}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
          >
            <option value="none">不等待</option>
            <option value="explicit">显式等待</option>
            <option value="smart">智能等待</option>
          </select>
          {(params.waitMode === 'explicit') && (
            <input
              type="number"
              value={params.waitMs || 500}
              onChange={(e) => setParams({ ...params, waitMs: Number(e.target.value) })}
              className="w-28 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              placeholder="毫秒"
            />
          )}
          <input
            type="number"
            value={params.timeoutMs || 3000}
            onChange={(e) => setParams({ ...params, timeoutMs: Number(e.target.value) })}
            className="w-28 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
            placeholder="断言超时(ms)"
          />
          {(step.intent.includes('可见')) && (
            <label className="flex items-center gap-1 text-xs text-slate-300">
              <input type="checkbox" checked={!!params.visible} onChange={(e) => setParams({ ...params, visible: e.target.checked })} />
              断言可见
            </label>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <MousePointer2 size={16} className="text-blue-500" />
            编辑步骤
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Intent */}
          <div className="space-y-2">
            <label className="text-xs text-slate-500 uppercase font-bold">自然语言意图 (Intent)</label>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none min-h-[80px] resize-none"
              placeholder="描述这一步要做什么..."
            />
          </div>

          {/* Dynamic Params */}
          {renderParamInputs()}

          {/* Wait Config */}
          {renderWaitConfig()}

          {/* Selector (Advanced) */}
          <div className="space-y-2 pt-2 border-t border-slate-800/50">
             <div className="flex items-center justify-between">
                <label className="text-xs text-slate-500 uppercase font-bold">选择器 (Selector)</label>
                <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 rounded">Advanced</span>
             </div>
            <div className="relative">
                <input
                type="text"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-slate-400 focus:border-blue-500 focus:outline-none focus:text-slate-200"
                placeholder="#id .class"
                />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Save size={14} />
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
};
