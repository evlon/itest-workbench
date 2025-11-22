
import React, { useState } from 'react';
import { Step, StepType } from '../types';
import { Play, CheckCircle, AlertCircle, MoreHorizontal, Clock, MousePointerClick, GripVertical, Settings, Package, ChevronDown, ChevronRight, Split } from 'lucide-react';

interface StepListProps {
  steps: Step[];
  activeStepId: string | null;
  selectedStepIds: string[];
  selectionEnabled?: boolean;
  selectionCount?: number;
  userComponents?: any[];
  expandedMap?: Record<string, boolean>;
  onToggleExpand?: (id: string) => void;
  onStepClick: (step: Step) => void;
  onToggleStepSelection: (stepId: string) => void;
  onSelectAll?: () => void;
  onInvertSelection?: () => void;
  onDeleteStep: (id: string) => void;
  onRunStep: (step: Step) => void;
  onMoveStep: (dragIndex: number, hoverIndex: number) => void;
  onEditStep: (step: Step) => void;
  onUpdateStep?: (s: Step) => void;
  onUngroupComponent?: (s: Step) => void;
}

export const StepList: React.FC<StepListProps> = ({ steps, activeStepId, selectedStepIds, selectionEnabled = false, selectionCount = 0, userComponents = [], expandedMap = {}, onToggleExpand, onStepClick, onToggleStepSelection, onSelectAll, onInvertSelection, onDeleteStep, onRunStep, onMoveStep, onEditStep, onUpdateStep, onUngroupComponent }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData('text/plain');
    const dragIndex = parseInt(dragIndexStr, 10);

    if (dragIndex !== dropIndex && !isNaN(dragIndex)) {
      onMoveStep(dragIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleStepClick = (e: React.MouseEvent, step: Step) => {
    if (e.metaKey || e.ctrlKey) {
      onToggleStepSelection(step.id);
    } else {
      onStepClick(step);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">测试流程</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{steps.length} 步</span>
          {selectionEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400">已选 {selectionCount} 步</span>
              <button onClick={onSelectAll} className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">全选</button>
              <button onClick={onInvertSelection} className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">反选</button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {steps.map((step, index) => {
          const isSelected = selectedStepIds.includes(step.id);
          const isComponent = step.type === StepType.COMPONENT;

          return (
            <div 
              key={step.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={(e) => handleStepClick(e, step)}
              className={`
                group relative flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all border
                ${activeStepId === step.id 
                  ? 'bg-slate-800 border-blue-500/50 shadow-lg shadow-blue-900/10' 
                  : isSelected 
                    ? 'bg-blue-900/30 border-blue-800'
                    : 'bg-slate-800/40 border-transparent hover:bg-slate-800 hover:border-slate-700'}
                ${draggedIndex === index ? 'opacity-50 border-dashed border-slate-600' : ''}
                ${dragOverIndex === index ? 'border-t-2 border-t-blue-500' : ''}
                ${isComponent ? 'border-dashed border-green-700/50' : ''}
              `}
            >
              {selectionEnabled && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleStepSelection(step.id)}
                  className="mt-1.5 h-4 w-4 rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {/* Step Number Line & Drag Handle */}
              <div className="flex flex-col items-center mt-1 gap-2">
                 <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                   <GripVertical size={12} />
                 </div>
                 <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
                   ${step.status === 'success' ? 'bg-green-900/30 text-green-400' : 
                     step.status === 'recording' ? 'bg-yellow-900/30 text-yellow-400 animate-pulse' :
                     isComponent ? 'bg-green-900/40 text-green-300' :
                     'bg-slate-700 text-slate-400'}`}>
                   {isComponent ? <Package size={10} /> : index + 1}
                 </div>
                 {index < steps.length - 1 && <div className="w-px h-full bg-slate-800 mt-2 absolute top-12 left-[2.65rem] -z-10" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`uppercase text-[10px] font-mono px-1.5 py-0.5 rounded border text-opacity-80
                      ${isComponent ? 'bg-green-900/20 border-green-800 text-green-400' :
                        step.action === 'click' ? 'bg-blue-900/20 border-blue-800 text-blue-400' :
                        step.action === 'input' ? 'bg-purple-900/20 border-purple-800 text-purple-400' :
                        step.action === 'extract' ? 'bg-orange-900/20 border-orange-800 text-orange-400' :
                        step.action === 'navigate' ? 'bg-cyan-900/20 border-cyan-800 text-cyan-400' :
                        'bg-slate-950 border-slate-800 text-slate-400'
                      }`}>
                      {step.action}
                    </span>
                    {step.status === 'success' && <CheckCircle size={12} className="text-green-500" />}
                    {step.status === 'failed' && <AlertCircle size={12} className="text-red-500" />}
                    {step.status === 'recording' && <Clock size={12} className="text-yellow-500 animate-pulse" />}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                      onClick={(e) => { e.stopPropagation(); onEditStep(step); }}
                      className="p-1 hover:bg-slate-700 text-slate-500 hover:text-slate-300 rounded transition-colors"
                      title="编辑参数"
                    >
                      <Settings size={12} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRunStep(step); }}
                      className="p-1 hover:bg-green-900/50 hover:text-green-400 text-slate-500 rounded transition-colors"
                      title="执行此步骤"
                    >
                      <Play size={12} fill="currentColor"/>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteStep(step.id); }}
                      className="p-1 hover:bg-red-900/50 hover:text-red-400 text-slate-500 rounded transition-colors"
                      title="删除步骤"
                    >
                      <MoreHorizontal size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isComponent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleExpand?.(step.id); }}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400"
                    >
                      {expandedMap[step.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                  <p className="text-sm text-slate-200 truncate font-medium pr-2">{step.intent}</p>
                </div>
                {step.target && (
                  <p className="text-xs text-slate-500 truncate font-mono mt-1 flex items-center gap-1" title={step.target.selectors?.precise}>
                    <MousePointerClick size={10} className="opacity-50"/>
                    {step.target.selectors?.precise || "等待 AI 解析..."}
                  </p>
                )}
                {step.params && (step.params.url || step.params.value) && (
                    <p className="text-[10px] text-slate-400 font-mono mt-1 truncate bg-slate-950/50 px-1.5 py-0.5 rounded inline-block max-w-full">
                       {step.params.url || step.params.value}
                    </p>
                )}
                {isComponent && expandedMap[step.id] && (
                  <div className="mt-2 p-2 border border-slate-700 rounded bg-slate-800/40">
                    <div className="text-xs font-semibold text-slate-300 mb-2">组件配置</div>
                    {(() => {
                      const comp = userComponents.find(c => c.id === step.componentId);
                      if (!comp) return <div className="text-xs text-red-400">未找到组件</div>;
                      const schema = Array.isArray(comp.paramsSchema) ? comp.paramsSchema : [];
                      const handleChange = (key: string, value: any) => {
                        const next: Step = { ...step, params: { ...(step.params || {}), [key]: value } };
                        onUpdateStep?.(next);
                      };
                      const findOccurrences = (key: string) => {
                        const paths: string[] = [];
                        const walk = (obj: any, path: string[]) => {
                          if (obj == null) return;
                          if (typeof obj === 'string') {
                            if (obj.includes(`{{${key}}}`)) paths.push(path.join('.'));
                            return;
                          }
                          if (Array.isArray(obj)) {
                            obj.forEach((v, i) => walk(v, path.concat([String(i)])));
                            return;
                          }
                          if (typeof obj === 'object') {
                            Object.keys(obj).forEach(k => walk(obj[k], path.concat([k])));
                          }
                        };
                        comp.steps.forEach((s: any, idx: number) => walk(s, [String(idx)]));
                        return paths;
                      };
                      const inner = (
                        <div className="mb-3">
                          <div className="text-[10px] text-slate-400 mb-1">内部元素</div>
                          <div className="space-y-1">
                            {comp.steps.map((cs: any, i: number) => (
                              <div key={i} className="text-[10px] text-slate-300 bg-slate-900/40 border border-slate-700 rounded px-2 py-1 flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{cs.action}</span>
                                <span className="truncate flex-1">{cs.intent}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                      const paramsBlock = schema.length === 0 ? (
                        <div className="text-xs text-slate-400">此组件无参数</div>
                      ) : (
                        <div className="space-y-2">
                          {schema.map((p: any, i: number) => {
                            const t = p.type || 'string';
                            const v = (step.params || {})[p.key] ?? p.defaultValue ?? '';
                            const occ = findOccurrences(p.key);
                            return (
                              <div key={i} className="flex items-start gap-2">
                                <div className="w-32 text-[10px] text-slate-400">{p.label || p.key}</div>
                                {t === 'boolean' ? (
                                  <input type="checkbox" checked={!!v} onChange={(e) => handleChange(p.key, e.target.checked)} />
                                ) : (
                                  <input
                                    value={String(v)}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      let parsed: any = raw;
                                      if (t === 'number') parsed = Number(raw);
                                      handleChange(p.key, parsed);
                                    }}
                                    placeholder={String(p.defaultValue ?? '')}
                                    className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200"
                                  />
                                )}
                                <select
                                  value={t}
                                  onChange={(e) => { const nt = e.target.value; const nv = nt === 'number' ? Number(v || 0) : nt === 'boolean' ? !!v : String(v ?? ''); handleChange(p.key, nv); comp.paramsSchema[i].type = nt; }}
                                  className="w-28 px-2 py-1 text-[10px] bg-slate-800 border border-slate-700 rounded text-slate-200"
                                >
                                  <option value="string">string</option>
                                  <option value="number">number</option>
                                  <option value="boolean">boolean</option>
                                </select>
                                <div className="text-[10px] text-slate-500">依赖: {occ.length} 处</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                      return (
                        <div className="space-y-3">
                          {inner}
                          {paramsBlock}
                          <div className="pt-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); onUngroupComponent?.(step); }}
                              className="text-[10px] px-2 py-1 bg-red-900/40 border border-red-700 rounded text-red-300 flex items-center gap-1"
                            >
                              <Split size={12} />
                              拆解组件
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600">
            <p className="text-sm">暂无步骤</p>
            <p className="text-xs mt-1">从组件库添加或开始录制</p>
          </div>
        )}
      </div>
    </div>
  );
};
