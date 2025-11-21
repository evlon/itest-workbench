
import React, { useState, useEffect } from 'react';
import { StepList } from './components/StepList';
import { ComponentLibrary } from './components/ComponentLibrary';
import { BrowserPreview } from './components/BrowserPreview';
import { CodePanel } from './components/CodePanel';
import { FlowGraph } from './components/FlowGraph';
import { EditStepModal } from './components/EditStepModal';
import { ActionMenu } from './components/ActionMenu';
import { generateTestScript, parseIntentToStepRefined } from './services/aiService';
import { refineStepTarget, getBestStaticSelectorForStep } from './services/selectorRefiner';
import { startSession, subscribeEvents, exec as agentExec, act as agentAct, observe as agentObserve } from './services/agentClient';
import { Step, ScriptMode, StepType, StepTarget } from './types';
import { Play, Square, Download, Sparkles, Zap, Layout, Code, Bot, Settings, AlertTriangle, List, Package, Target } from 'lucide-react';

// Constants
const INITIAL_URL = "https://example-shop.com";

export const App: React.FC = () => {
  // State
  const [url, setUrl] = useState(INITIAL_URL);
  const [steps, setSteps] = useState<Step[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [mode, setMode] = useState<ScriptMode>(ScriptMode.DYNAMIC);
  const [generatedCode, setGeneratedCode] = useState<string>("// 生成的代码将显示在这里...");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [activeMainTab, setActiveMainTab] = useState<'live' | 'flow'>('live');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'steps' | 'library'>('steps');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | undefined>(undefined);
  const [interactiveElements, setInteractiveElements] = useState<any[]>([]);
  const [lastRecordingStepId, setLastRecordingStepId] = useState<string | null>(null);
  
  // Editing State
  const [editingStep, setEditingStep] = useState<Step | null>(null);

  // Action Menu State
  const [selectedElement, setSelectedElement] = useState<StepTarget | null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  // Step Selection State
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);

  // User Components State
  const [userComponents, setUserComponents] = useState<any[]>([]);

  // Check for API Key on mount
  useEffect(() => {
    const hasOpenAI = !!import.meta.env.VITE_OPENAI_API_KEY;
    const hasGemini = !!import.meta.env.VITE_GEMINI_API_KEY || !!import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY;
    setApiKeyMissing(!(hasOpenAI || hasGemini));
  }, []);

  useEffect(() => {
    const init = async () => {
      const res = await startSession(url, false);
      setSessionId(res.sessionId);
    };
    init();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeEvents(sessionId, {
      onScreenshot: (d) => setScreenshotBase64(d.base64),
      onDomUpdate: (d) => setInteractiveElements(d.interactive_elements || []),
      onActionComplete: () => {
        if (lastRecordingStepId) {
          setSteps(prev => prev.map(s => s.id === lastRecordingStepId ? { ...s, status: 'success' } : s));
          setLastRecordingStepId(null);
        }
      }
    });
    return () => { unsub(); };
  }, [sessionId, lastRecordingStepId]);

  // Auto-generate code when steps or mode changes
  useEffect(() => {
    const updateCode = async () => {
      if (steps.length === 0) {
        setGeneratedCode("// 请添加步骤以生成脚本...");
        return;
      }
      setIsLoadingCode(true);
      // Debounce slightly to avoid flickering on fast step adds
      const code = await generateTestScript(steps, mode);
      setGeneratedCode(code);
      setIsLoadingCode(false);
    };

    const timer = setTimeout(updateCode, 500); // Debounce
    return () => clearTimeout(timer);
  }, [steps, mode]);

  // Handlers
  const handleInspectToggle = () => {
    const nextState = !isInspecting;
    setIsInspecting(nextState);
    if (nextState) {
        // If starting inspect, ensure we are on the live preview
        setActiveMainTab('live');
    }
  };

  const handleStepClick = (step: Step) => {
    setActiveStepId(step.id);
  };
  
  const handleToggleStepSelection = (stepId: string) => {
    setSelectedStepIds(prev =>
      prev.includes(stepId)
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const handleExtractComponent = () => {
    const componentName = window.prompt("请输入组件名称:");
    if (!componentName || componentName.trim() === '') return;

    const selectedSteps = steps.filter(step => selectedStepIds.includes(step.id));
    if (selectedSteps.length < 2) return;

    const newComponent = {
      id: `comp-${Date.now()}`,
      name: componentName,
      steps: selectedSteps,
    };

    setUserComponents(prev => [...prev, newComponent]);

    const newComponentStep: Step = {
      id: `step-${Date.now()}`,
      type: StepType.COMPONENT,
      action: 'component',
      intent: `执行组件: ${componentName}`,
      componentId: newComponent.id,
      componentName: newComponent.name,
      status: 'pending',
    };

    const firstSelectedIndex = steps.findIndex(step => step.id === selectedStepIds[0]);
    const stepsWithoutSelected = steps.filter(step => !selectedStepIds.includes(step.id));
    
    stepsWithoutSelected.splice(firstSelectedIndex, 0, newComponentStep);
    
    setSteps(stepsWithoutSelected);
    setSelectedStepIds([]);
  };

  const handleDeleteStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
    if (activeStepId === id) setActiveStepId(null);
  };

  const handleMoveStep = (dragIndex: number, hoverIndex: number) => {
    const newSteps = [...steps];
    const draggedItem = newSteps[dragIndex];
    newSteps.splice(dragIndex, 1);
    newSteps.splice(hoverIndex, 0, draggedItem);
    setSteps(newSteps);
  };

  const handleRunStep = async (step: Step) => {
      if (!sessionId) return;
      setSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'recording' } : s));
      setLastRecordingStepId(step.id);
      if (mode === ScriptMode.STATIC) {
        const sel = getBestStaticSelectorForStep(step);
        await agentExec(sessionId, sel, step.action === 'click' ? 'click' : 'run');
      } else {
        await agentAct(sessionId, step.intent);
      }
  };
  
  const handleEditStep = (step: Step) => {
      setEditingStep(step);
  };
  
  const handleSaveStep = (updatedStep: Step) => {
      setSteps(steps.map(s => s.id === updatedStep.id ? updatedStep : s));
      setEditingStep(null);
  };

  const handleAddTemplate = (template: any) => {
      const newStep: Step = {
          id: Math.random().toString(36).substr(2, 9),
          type: template.stepData.type,
          intent: template.stepData.intent,
          action: template.stepData.action,
          status: 'pending',
          target: {
            description: template.label,
            selectors: { precise: '' } // Will be filled by AI or manual logic later
          },
          params: {}
      };
      setSteps([...steps, newStep]);
      setActiveSidebarTab('steps');
      
      // Auto-trigger intent parsing for templated steps to fill in details
      parseIntentToStepRefined(newStep.intent, url, "").then(parsed => {
           setSteps(prev => prev.map(s => s.id === newStep.id ? { ...s, ...parsed, status: 'success' } : s));
      });
      
      // Optional: Auto-open edit modal for navigation steps or others requiring input immediately
      if (newStep.action === 'navigate' || newStep.action === 'input') {
          setEditingStep(newStep);
      }
  };

  const handleAiCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const tempId = Math.random().toString(36).substr(2, 9);
    const intentCache = aiInput;
    
    const pendingStep: Step = {
      id: tempId,
      type: StepType.INTERACTION,
      intent: intentCache,
      action: 'wait',
      status: 'recording'
    };

    setSteps([...steps, pendingStep]);
    setAiInput("");
    setActiveSidebarTab('steps');

    const parsedStep = await parseIntentToStepRefined(intentCache, url, "<html>Mock Context</html>");
    
    setSteps(prev => prev.map(s => s.id === tempId ? {
      ...s,
      ...parsedStep,
      id: Math.random().toString(36).substr(2, 9),
      status: 'success',
      isAiGenerated: true
    } as Step : s));
  };

  const handleElementSelected = async (payload: { target: StepTarget }) => {
    setIsInspecting(false);
    const refined = refineStepTarget(payload.target);
    setSelectedElement(refined);
    setIsActionMenuOpen(true);
  };

  const handleCloseActionMenu = () => {
    setIsActionMenuOpen(false);
    setSelectedElement(null);
  };

  const handleActionSelected = async (action: 'click' | 'input' | 'assertVisible' | 'assertText') => {
    if (!selectedElement) return;

    let type = StepType.INTERACTION;
    let intent = `${action} on ${selectedElement.description}`;
    let newAction: Step['action'] = 'click';
    
    switch (action) {
      case 'click':
        newAction = 'click';
        intent = `点击 ${selectedElement.description}`;
        break;
      case 'input':
        newAction = 'input';
        intent = `在 ${selectedElement.description} 中输入值`;
        // This might require a subsequent modal to get the value, for now, we'll use a placeholder
        break;
      case 'assertVisible':
        newAction = 'wait'; // 'wait' can be used for assertions
        type = StepType.VERIFICATION;
        intent = `验证 ${selectedElement.description} 可见`;
        break;
      case 'assertText':
        newAction = 'wait'; // 'wait' can be used for assertions
        type = StepType.VERIFICATION;
        intent = `验证 ${selectedElement.description} 的文本`;
        // This might require a subsequent modal to get the value, for now, we'll use a placeholder
        break;
    }

    const newStep: Step = {
      id: Math.random().toString(36).substr(2, 9),
      type: type,
      intent: intent,
      action: newAction,
      target: selectedElement,
      params: {},
      status: 'success'
    };
    setSteps([...steps, newStep]);
    setActiveSidebarTab('steps');
    handleCloseActionMenu();
    if (sessionId) {
      setLastRecordingStepId(newStep.id);
      if (mode === ScriptMode.STATIC) {
        const sel = getBestStaticSelectorForStep(newStep);
        await agentExec(sessionId, sel, newAction === 'click' ? 'click' : 'run');
      } else {
        await agentAct(sessionId, newStep.intent);
      }
    }
  };

  // Handle URL changes from the header input
  const handleUrlChange = (newUrl: string) => {
      setUrl(newUrl);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-blue-500/30">
      
      <ActionMenu
        isOpen={isActionMenuOpen}
        target={selectedElement}
        onClose={handleCloseActionMenu}
        onActionSelect={handleActionSelected}
      />

      <EditStepModal 
        isOpen={!!editingStep}
        step={editingStep}
        onClose={() => setEditingStep(null)}
        onSave={handleSaveStep}
      />
      
      {/* --- Header --- */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm leading-tight">智能测试工作台</h1>
            <p className="text-[10px] text-slate-500 font-mono">AI-POWERED TEST WORKBENCH</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {apiKeyMissing && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/20 border border-yellow-700/50 rounded text-yellow-500 text-xs">
               <AlertTriangle size={14} />
               <span>演示模式 (无 API Key)</span>
             </div>
           )}
           <button 
             onClick={handleInspectToggle}
             className={`
               flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all
               ${isInspecting 
                 ? 'bg-blue-500/10 text-blue-400 border border-blue-500/50 animate-pulse' 
                 : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}
             `}
           >
             <Target size={14} />
             {isInspecting ? '停止选择' : '选择元素'}
           </button>
           <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium shadow-lg shadow-blue-900/20 transition-colors">
             <Download size={14} />
             导出脚本
           </button>
        </div>
      </header>

      {/* --- Main Content Grid --- */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Tabs + Content */}
        <aside className="w-72 shrink-0 flex flex-col z-10 border-r border-slate-800 bg-slate-950">
           {/* Sidebar Tabs */}
           <div className="flex border-b border-slate-800 bg-slate-900">
              <button 
                onClick={() => setActiveSidebarTab('steps')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2 ${activeSidebarTab === 'steps' ? 'border-blue-500 text-blue-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                <List size={14} />
                当前用例
              </button>
              <button 
                onClick={() => setActiveSidebarTab('library')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2 ${activeSidebarTab === 'library' ? 'border-blue-500 text-blue-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                <Package size={14} />
                组件库
              </button>
           </div>

           <div className="flex-1 overflow-hidden relative">
             <div className="p-2 border-b border-slate-800 bg-slate-900/50 h-14 flex items-center">
                <button
                    onClick={handleExtractComponent}
                    disabled={selectedStepIds.length < 2}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    提取为组件
                </button>
             </div>
             {activeSidebarTab === 'steps' ? (
                <StepList 
                  steps={steps} 
                  activeStepId={activeStepId}
                  selectedStepIds={selectedStepIds}
                  onStepClick={handleStepClick}
                  onToggleStepSelection={handleToggleStepSelection}
                  onDeleteStep={handleDeleteStep}
                  onRunStep={handleRunStep}
                  onMoveStep={handleMoveStep}
                  onEditStep={handleEditStep}
                />
             ) : (
                <ComponentLibrary onAddTemplate={handleAddTemplate} userComponents={userComponents} />
             )}
           </div>
        </aside>

        {/* Middle: Preview & Flow */}
        <section className="flex-1 flex flex-col min-w-0 bg-slate-950 relative border-r border-slate-800">
          {/* Toolbar */}
          <div className="h-10 border-b border-slate-800 flex items-center px-4 gap-4 bg-slate-900/30">
            <button 
              onClick={() => setActiveMainTab('live')}
              className={`text-xs font-medium flex items-center gap-2 h-full border-b-2 transition-colors ${activeMainTab === 'live' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Layout size={14} />
              实时预览
            </button>
            <button 
              onClick={() => setActiveMainTab('flow')}
              className={`text-xs font-medium flex items-center gap-2 h-full border-b-2 transition-colors ${activeMainTab === 'flow' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Settings size={14} />
              流程图谱
            </button>
          </div>

          {/* Viewport */}
          <div className="flex-1 relative bg-slate-950 overflow-hidden">
             {activeMainTab === 'live' ? (
               <BrowserPreview 
                 url={url} 
                 onUrlChange={handleUrlChange}
                 onElementSelect={handleElementSelected}
                 isInspecting={isInspecting}
                 screenshotBase64={screenshotBase64}
              />
             ) : (
               <FlowGraph steps={steps} />
             )}
          </div>

          {/* AI Command Input Area */}
          <div className="p-4 border-t border-slate-800 bg-slate-900">
            <form onSubmit={handleAiCommand} className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Bot size={18} className="text-blue-500" />
              </div>
              <input 
                type="text" 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="告诉 AI 下一步做什么 (例如: '验证价格是否大于 0'...)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-12 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
              />
              <button 
                type="submit"
                disabled={!aiInput.trim()}
                className="absolute inset-y-1.5 right-1.5 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white px-3 rounded-md transition-colors disabled:opacity-50 disabled:hover:bg-slate-800 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
              </button>
            </form>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] text-slate-500 shrink-0 pt-0.5">建议指令:</span>
              {['点击搜索按钮', '验证表单是否可见', '输入用户名 admin', '提取商品价格'].map((s) => (
                <button 
                  key={s}
                  onClick={() => setAiInput(s)}
                  className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 border border-slate-700 hover:border-slate-500 transition-colors whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right Sidebar: Code & Config */}
        <aside className="w-96 shrink-0 flex flex-col bg-slate-950">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold text-slate-200 text-sm mb-3 flex items-center gap-2">
              <Code size={16} className="text-blue-500"/>
              生成策略配置
            </h2>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800">
              <button
                onClick={() => setMode(ScriptMode.STATIC)}
                className={`text-xs py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-2 ${mode === ScriptMode.STATIC ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Zap size={12} />
                标准静态模式
              </button>
              <button
                onClick={() => setMode(ScriptMode.DYNAMIC)}
                className={`text-xs py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-2 ${mode === ScriptMode.DYNAMIC ? 'bg-blue-900/50 text-blue-200 shadow border border-blue-800/50' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Sparkles size={12} />
                AI 动态模式
              </button>
            </div>
            <div className="mt-3 text-[10px] text-slate-500 leading-relaxed px-1">
              {mode === ScriptMode.STATIC 
                ? "生成纯 Playwright 代码。依赖固定选择器，执行速度快，但对页面变动敏感。"
                : "生成 Stagehand (AI) 代码。依赖运行时 AI 解析意图，具备极强自愈能力，适合频繁变动的页面。"}
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <CodePanel code={generatedCode} isLoading={isLoadingCode} />
          </div>
        </aside>

      </main>
    </div>
  );
};
