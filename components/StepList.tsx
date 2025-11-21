
import React, { useState } from 'react';
import { Step, StepType } from '../types';
import { Play, CheckCircle, AlertCircle, MoreHorizontal, Clock, MousePointerClick, GripVertical, Settings } from 'lucide-react';

interface StepListProps {
  steps: Step[];
  activeStepId: string | null;
  onStepClick: (step: Step) => void;
  onDeleteStep: (id: string) => void;
  onRunStep: (step: Step) => void;
  onMoveStep: (dragIndex: number, hoverIndex: number) => void;
  onEditStep: (step: Step) => void;
}

export const StepList: React.FC<StepListProps> = ({ steps, activeStepId, onStepClick, onDeleteStep, onRunStep, onMoveStep, onEditStep }) => {
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

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">测试流程</h2>
        <span className="text-xs text-slate-500">{steps.length} 步</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onStepClick(step)}
            className={`
              group relative flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all border
              ${activeStepId === step.id 
                ? 'bg-slate-800 border-blue-500/50 shadow-lg shadow-blue-900/10' 
                : 'bg-slate-800/40 border-transparent hover:bg-slate-800 hover:border-slate-700'}
              ${draggedIndex === index ? 'opacity-50 border-dashed border-slate-600' : ''}
              ${dragOverIndex === index ? 'border-t-2 border-t-blue-500' : ''}
            `}
          >
            {/* Step Number Line & Drag Handle */}
            <div className="flex flex-col items-center mt-1 gap-2">
               <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                 <GripVertical size={12} />
               </div>
               <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
                 ${step.status === 'success' ? 'bg-green-900/30 text-green-400' : 
                   step.status === 'recording' ? 'bg-yellow-900/30 text-yellow-400 animate-pulse' :
                   'bg-slate-700 text-slate-400'}`}>
                 {index + 1}
               </div>
               {index < steps.length - 1 && <div className="w-px h-full bg-slate-800 mt-2 absolute top-12 left-[1.15rem] -z-10" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`uppercase text-[10px] font-mono px-1.5 py-0.5 rounded border text-opacity-80
                    ${step.action === 'click' ? 'bg-blue-900/20 border-blue-800 text-blue-400' :
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
              <p className="text-sm text-slate-200 truncate font-medium pr-2">{step.intent}</p>
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
            </div>
          </div>
        ))}
        
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
