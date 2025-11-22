
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
import { startSession, stopSession, subscribeEvents, exec as agentExec, act as agentAct, observe as agentObserve, startStream as agentStartStream, stopStream as agentStopStream, keypress as agentKeypress, focused as agentFocused, assertRemote, waitRemote, smartWait, getPages, activatePage } from './services/agentClient';
import { Step, ScriptMode, StepType, StepTarget } from './types';
import { Play, Square, Download, Sparkles, Zap, Layout, Code, Bot, Settings, AlertTriangle, List, Package, Target } from 'lucide-react';

// Constants
const INITIAL_URL = "http://localhost:3000/test.html";

export const App: React.FC = () => {
  // State
  const [url, setUrl] = useState(INITIAL_URL);
  const [steps, setSteps] = useState<Step[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [mode, setMode] = useState<ScriptMode>(ScriptMode.DYNAMIC);
  const [generatedCode, setGeneratedCode] = useState<string>("// 生成的代码将显示在这里...");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isKeyRecording, setIsKeyRecording] = useState(false);
  const [keyLog, setKeyLog] = useState<{ type: 'down'|'up'; key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; t: number }[]>([]);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [activeMainTab, setActiveMainTab] = useState<'live' | 'flow'>('live');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'steps' | 'library'>('steps');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | undefined>(undefined);
  const [interactiveElements, setInteractiveElements] = useState<any[]>([]);
  const [lastRecordingStepId, setLastRecordingStepId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isHeadless, setIsHeadless] = useState(true);
  const [inspectTrigger, setInspectTrigger] = useState<'ctrlOrMeta' | 'alt' | 'shift'>('ctrlOrMeta');
  const [inputBuffer, setInputBuffer] = useState('');
  const [sessionPages, setSessionPages] = useState<{ id: string, url: string, title?: string }[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [newPageNotification, setNewPageNotification] = useState<{ pageId: string, title?: string } | null>(null);
  
  // Editing State
  const [editingStep, setEditingStep] = useState<Step | null>(null);

  // Action Menu State
  const [selectedElement, setSelectedElement] = useState<StepTarget | null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  // Step Selection State
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [isExtractMode, setIsExtractMode] = useState(false);
  const [expandedComponentIds, setExpandedComponentIds] = useState<Record<string, boolean>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  // User Components State
  const [userComponents, setUserComponents] = useState<any[]>([]);
  const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);
  const [failureInfo, setFailureInfo] = useState<{ htmlSnippet: string; at: number } | null>(null);
  const [failureRect, setFailureRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isFailureModalOpen, setIsFailureModalOpen] = useState(false);
  const [componentDraft, setComponentDraft] = useState<{ name: string; steps: Step[] } | null>(null);
  const [paramSchema, setParamSchema] = useState<{ key: string; label?: string; defaultValue?: string }[]>([]);
  const [fieldBindings, setFieldBindings] = useState<{ stepIndex: number; path: string; paramKey: string }[]>([]);

  // Check for API Key on mount
  useEffect(() => {
    const hasOpenAI = !!import.meta.env.VITE_OPENAI_API_KEY;
    const hasGemini = !!import.meta.env.VITE_GEMINI_API_KEY || !!import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY;
    setApiKeyMissing(!(hasOpenAI || hasGemini));
  }, []);

  useEffect(() => {
    // Start a session once on mount or when headless mode changes.
    // Do NOT recreate/stop the session when `url` changes — navigation is handled by `handleUrlChange`.
    let createdSession: string | null = null;
    const init = async () => {
      const res = await startSession(url, isHeadless);
      createdSession = res.sessionId;
      setSessionId(res.sessionId);
      setIsStreaming(false);
      try {
        const pages = await getPages(res.sessionId)
        setSessionPages(pages.pages || [])
        setActivePageId(pages.activePageId || null)
      } catch {}
    };
    init();
    return () => {
      if (createdSession) {
        try { stopSession(createdSession); } catch {}
        createdSession = null;
      }
    };
  }, [isHeadless]);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeEvents(sessionId, {
      onScreenshot: (d) => {
        const pid = d.pageId || activePageId
        if (!activePageId || (pid && pid === activePageId)) setScreenshotBase64(d.base64)
      },
      onDomUpdate: (d) => setInteractiveElements(d.interactive_elements || []),
      onActionComplete: (d) => {
        const status = d?.status;
        if (status === 'failed') {
          const snippet = d?.result?.html_snippet || '';
          setFailureInfo({ htmlSnippet: String(snippet).slice(0, 5000), at: Date.now() });
          const r = d?.result?.rect;
          if (r && typeof r.x === 'number') setFailureRect({ x: r.x, y: r.y, w: r.w, h: r.h });
          setIsFailureModalOpen(true);
        }
        if (lastRecordingStepId) {
          setSteps(prev => prev.map(s => s.id === lastRecordingStepId ? { ...s, status: status === 'failed' ? 'failed' : 'success' } : s));
          setLastRecordingStepId(null);
        }
      },
      onPageOpened: (d) => {
        setSessionPages(prev => prev.concat([{ id: d.pageId, url: d.url, title: d.title }]))
        setNewPageNotification({ pageId: d.pageId, title: d.title })
      },
      onPageClosed: (d) => {
        setSessionPages(prev => prev.filter(p => p.id !== d.pageId))
        if (activePageId === d.pageId) setActivePageId(null)
      },
      onPageActivated: (d) => {
        setActivePageId(d.pageId)
        setNewPageNotification(null)
      }
    });
    return () => { unsub(); };
  }, [sessionId, lastRecordingStepId, activePageId]);

  // Auto-generate code when steps or mode changes
  useEffect(() => {
    const updateCode = async () => {
      if (steps.length === 0) {
        setGeneratedCode("// 请添加步骤以生成脚本...");
        return;
      }
      const applyParams = (obj: any, params: Record<string, any>) => {
        if (!obj) return obj
        if (typeof obj === 'string') {
          let out = obj
          for (const k of Object.keys(params || {})) {
            out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k]))
          }
          return out
        }
        if (Array.isArray(obj)) return obj.map(v => applyParams(v, params))
        if (typeof obj === 'object') {
          const next: any = {}
          for (const k of Object.keys(obj)) next[k] = applyParams(obj[k], params)
          return next
        }
        return obj
      }
      const expand = (list: Step[]): Step[] => {
        const out: Step[] = []
        for (const s of list) {
          if (s.type === StepType.COMPONENT && s.componentId) {
            const comp = userComponents.find(c => c.id === s.componentId)
            if (comp) {
              for (const sub of comp.steps) {
                const applied = applyParams(sub, s.params || {}) as Step
                out.push(applied)
              }
            }
          } else {
            out.push(s)
          }
        }
        return out
      }
      const effective = expand(steps)
      setIsLoadingCode(true);
      const code = await generateTestScript(effective, mode);
      setGeneratedCode(code);
      setIsLoadingCode(false);
    };
    const timer = setTimeout(updateCode, 500);
    return () => clearTimeout(timer);
  }, [steps, mode, userComponents]);

  // Handlers
  const handleInspectToggle = async () => {
    const nextState = !isInspecting;
    setIsInspecting(nextState);
    if (nextState) {
        setActiveMainTab('live');
        if (sessionId && !isStreaming) {
          try { await agentStartStream(sessionId, 1000); setIsStreaming(true); } catch {}
        }
    }
  };

  const handleToggleKeyRecording = () => {
    setIsKeyRecording(v => {
      const next = !v;
      if (!next && inputBuffer && sessionId) {
        flushInputBuffer();
      }
      return next;
    });
  };

  const handlePlaybackKeys = async () => {
    if (!sessionId) return;
    for (const evt of keyLog) {
      if (evt.type === 'down') {
        await agentKeypress(sessionId, { type: 'press', key: evt.key, ctrl: evt.ctrl, alt: evt.alt, shift: evt.shift, meta: evt.meta });
      }
    }
    if (inputBuffer) {
      await agentKeypress(sessionId, { type: 'type', text: inputBuffer });
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
    const selectedSteps = steps.filter(step => selectedStepIds.includes(step.id));
    if (selectedSteps.length < 2) return;
    if (isExtractMode) {
      setCreateName('');
      setCreateDesc('');
      setIsCreateModalOpen(true);
      return;
    }
    const componentName = window.prompt("请输入组件名称:");
    if (!componentName || componentName.trim() === '') return;
    setComponentDraft({ name: componentName, steps: selectedSteps });
    const detected: { stepIndex: number; path: string; value: string }[] = [];
    selectedSteps.forEach((s, idx) => {
      if (typeof s.intent === 'string' && s.intent) detected.push({ stepIndex: idx, path: 'intent', value: s.intent });
      const sel = s.target?.selectors?.precise;
      if (typeof sel === 'string' && sel) detected.push({ stepIndex: idx, path: 'target.selectors.precise', value: sel });
      const sem = s.target?.selectors?.semantic;
      if (typeof sem === 'string' && sem) detected.push({ stepIndex: idx, path: 'target.selectors.semantic', value: sem });
      const txt = s.target?.selectors?.text;
      if (typeof txt === 'string' && txt) detected.push({ stepIndex: idx, path: 'target.selectors.text', value: txt });
      const desc = s.target?.description;
      if (typeof desc === 'string' && desc) detected.push({ stepIndex: idx, path: 'target.description', value: desc });
      const val = s.params && typeof s.params['value'] === 'string' ? String(s.params['value']) : '';
      if (val) detected.push({ stepIndex: idx, path: 'params.value', value: val });
    });
    const suggestKey = (path: string) => {
      if (path === 'intent') return 'intent';
      if (path === 'target.selectors.precise') return 'selector';
      if (path === 'target.selectors.semantic') return 'semantic';
      if (path === 'target.selectors.text') return 'text';
      if (path === 'target.description') return 'description';
      if (path === 'params.value') return 'value';
      const parts = path.split('.');
      return parts[parts.length - 1] || 'param';
    };
    const suggestions: { key: string; label?: string; defaultValue?: string }[] = [];
    detected.forEach((d) => {
      let base = suggestKey(d.path);
      base = base.replace(/\s+/g, '_');
      let key = base;
      let n = 2;
      while (suggestions.some(s => s.key === key)) { key = `${base}${n}`; n++; }
      suggestions.push({ key, label: base, defaultValue: d.value });
    });
    setParamSchema(suggestions);
    setFieldBindings(detected.map((d, i) => ({ stepIndex: d.stepIndex, path: d.path, paramKey: suggestions[i]?.key || '' })));
    setIsParamsModalOpen(true);
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
      const applyParams = (obj: any, params: Record<string, any>) => {
        if (!obj) return obj
        if (typeof obj === 'string') {
          let out = obj
          for (const k of Object.keys(params || {})) {
            out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k]))
          }
          return out
        }
        if (Array.isArray(obj)) return obj.map(v => applyParams(v, params))
        if (typeof obj === 'object') {
          const next: any = {}
          for (const k of Object.keys(obj)) next[k] = applyParams(obj[k], params)
          return next
        }
        return obj
      }
      const runOne = async (s: Step) => {
        if (sessionId && s.params && typeof s.params['waitMs'] === 'number' && s.params['waitMs'] > 0) {
          await waitRemote(sessionId, Number(s.params['waitMs']))
        }
        if (s.action === 'input') {
          const text = (s.params && typeof s.params['value'] === 'string') ? String(s.params['value']) : ''
          if (text) {
            await agentKeypress(sessionId, { type: 'type', text })
          }
          if (s.params && s.params['waitMode'] === 'smart') {
            const sel = getBestStaticSelectorForStep(s)
            await smartWait(sessionId, {
              selector: sel,
              timeoutMs: Number(s.params?.timeoutMs || 3000),
              domContentLoaded: !!s.params?.smartDomContentLoaded,
              load: !!s.params?.smartLoad,
              networkIdle: (s.params?.smartNetworkIdle ?? true) as boolean,
              stability: (s.params?.smartStability ?? true) as boolean,
              visible: !!s.params?.smartVisible
            })
          }
          return
        }
        if (s.type === StepType.VERIFICATION) {
          const sel = getBestStaticSelectorForStep(s)
          if (s.intent.includes('可见') || s.params?.visible === true) {
            await assertRemote(sessionId, sel, 'visible', undefined, Number(s.params?.timeoutMs || 3000))
            return
          }
          if (s.intent.includes('文本') || typeof s.params?.text === 'string') {
            await assertRemote(sessionId, sel, 'text', String(s.params?.text || ''), Number(s.params?.timeoutMs || 3000))
            return
          }
        }
        if (mode === ScriptMode.STATIC) {
          const sel = getBestStaticSelectorForStep(s)
          await agentExec(sessionId, sel, s.action === 'click' ? 'click' : 'run')
        } else {
          await agentAct(sessionId, s.intent)
        }
        if (s.params && s.params['waitMode'] === 'smart') {
          const sel = getBestStaticSelectorForStep(s)
          await smartWait(sessionId, {
            selector: sel,
            timeoutMs: Number(s.params?.timeoutMs || 3000),
            domContentLoaded: !!s.params?.smartDomContentLoaded,
            load: !!s.params?.smartLoad,
            networkIdle: (s.params?.smartNetworkIdle ?? true) as boolean,
            stability: (s.params?.smartStability ?? true) as boolean,
            visible: !!s.params?.smartVisible
          })
        }
      }
      if (step.type === StepType.COMPONENT && step.componentId) {
        const comp = userComponents.find(c => c.id === step.componentId)
        if (comp) {
          for (const sub of comp.steps) {
            const applied = applyParams(sub, step.params || {})
            await runOne(applied as Step)
          }
        }
      } else {
        await runOne(step)
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
            selectors: { precise: '' }
          },
          params: template.stepData.action === 'component' ? (template.stepData.params || {}) : {}
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

  const handleElementSelected = async (payload: { target: StepTarget, ctrl?: boolean }) => {
    const refined = refineStepTarget(payload.target);
    setSelectedElement(refined);
    if (payload.ctrl) {
      setIsActionMenuOpen(true);
      return;
    }
    const newStep: Step = {
      id: Math.random().toString(36).substr(2, 9),
      type: StepType.INTERACTION,
      intent: `点击 ${refined.description}`,
      action: 'click',
      target: refined,
      params: {},
      status: 'success'
    };
    setSteps([...steps, newStep]);
    setActiveSidebarTab('steps');
    setActiveStepId(newStep.id);
    if (sessionId) {
      setLastRecordingStepId(newStep.id);
      if (mode === ScriptMode.STATIC) {
        const sel = getBestStaticSelectorForStep(newStep);
        await agentExec(sessionId, sel, 'click');
      } else {
        await agentAct(sessionId, newStep.intent);
      }
    }
  };

  const handleKeyEvent = (evt: { type: 'down' | 'up'; key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }) => {
    setKeyLog(prev => prev.concat([{ ...evt, t: Date.now() }]));
    const printable = evt.key && evt.key.length === 1 && !evt.ctrl && !evt.alt && !evt.meta;
    if (evt.type === 'down' && printable) {
      setInputBuffer(buf => buf + evt.key);
      return;
    }
    if (evt.type === 'down' && evt.key === 'Enter' && inputBuffer) {
      flushInputBuffer();
      return;
    }
    if (evt.type === 'down') {
      const newStep: Step = {
        id: Math.random().toString(36).substr(2, 9),
        type: StepType.INTERACTION,
        intent: `按键 ${evt.key}`,
        action: 'keypress',
        status: 'success',
        params: { key: evt.key, ctrl: evt.ctrl, alt: evt.alt, shift: evt.shift, meta: evt.meta },
      } as Step;
      setSteps([...steps, newStep]);
      setActiveSidebarTab('steps');
      setActiveStepId(newStep.id);
    }
  };

  useEffect(() => {
    if (!isKeyRecording || !inputBuffer) return;
    const timer = setTimeout(() => { flushInputBuffer(); }, 600);
    return () => clearTimeout(timer);
  }, [inputBuffer, isKeyRecording]);

  const flushInputBuffer = async () => {
    if (!sessionId || !inputBuffer) return;
    const meta = await agentFocused(sessionId);
    const focusedEl = meta?.focused;
    const target: StepTarget | undefined = focusedEl ? { description: focusedEl.description, selectors: focusedEl.selectors } as any : undefined;
    const newStep: Step = {
      id: Math.random().toString(36).substr(2, 9),
      type: StepType.INTERACTION,
      intent: target ? `在 ${target.description} 中输入值` : `输入文本`,
      action: 'input',
      target,
      params: { value: inputBuffer },
      status: 'success'
    } as Step;
    setSteps([...steps, newStep]);
    setActiveSidebarTab('steps');
    setActiveStepId(newStep.id);
    await agentKeypress(sessionId, { type: 'type', text: inputBuffer });
    setInputBuffer('');
  };

  const handleCloseActionMenu = () => {
    setIsActionMenuOpen(false);
    setSelectedElement(null);
  };

  const handleActionSelected = async (action: 'click' | 'input' | 'assertVisible' | 'assertText' | 'custom') => {
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
      case 'custom':
        newAction = 'wait';
        type = StepType.CUSTOM;
        intent = `自定义操作: ${selectedElement.description}`;
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
    if (newAction === 'wait' && type === StepType.CUSTOM) {
      setEditingStep(newStep);
    }
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
      if (sessionId) {
        agentExec(sessionId, newUrl, 'navigate');
      }
  };

  const handleActivatePage = async (pageId: string) => {
    if (!sessionId) return
    await activatePage(sessionId, pageId)
    setActivePageId(pageId)
    setNewPageNotification(null)
    try {
      const pages = await getPages(sessionId)
      setSessionPages(pages.pages || [])
    } catch {}
  }

  const handleToggleStreaming = async () => {
    if (!sessionId) return;
    if (isStreaming) {
      await agentStopStream(sessionId);
      setIsStreaming(false);
    } else {
      await agentStartStream(sessionId, 1000);
      setIsStreaming(true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-blue-500/30">
      {isCreateModalOpen && activeSidebarTab === 'steps' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[560px] bg-slate-900 border border-slate-800 rounded-lg shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">创建组件</div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 text-xs">关闭</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">组件名称（必填）</div>
                <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="请输入组件名称" className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200" />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">组件描述（可选）</div>
                <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="用于说明此组件用途" className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 min-h-[80px]" />
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2">
              <button onClick={() => setIsCreateModalOpen(false)} className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300">取消</button>
              <button onClick={() => {
                const name = createName.trim();
                if (!name) return;
                const selectedSteps = steps.filter(step => selectedStepIds.includes(step.id));
                if (selectedSteps.length < 2) return;
                const slug = name.toLowerCase().replace(/\s+/g, '-');
                const createdAt = Date.now();
                const newComponent = { id: `comp-${createdAt}`, name, slug, description: createDesc.trim(), createdAt, steps: selectedSteps.map(s => ({...s})), paramsSchema: [] };
                setUserComponents(prev => [...prev, newComponent]);
                const newComponentStep: Step = { id: `step-${Date.now()}`, type: StepType.COMPONENT, action: 'component', intent: `执行组件: ${newComponent.name}`, componentId: newComponent.id, componentName: newComponent.name, status: 'pending', params: {} };
                const firstSelectedIndex = steps.findIndex(step => step.id === selectedStepIds[0]);
                const stepsWithoutSelected = steps.filter(step => !selectedStepIds.includes(step.id));
                stepsWithoutSelected.splice(firstSelectedIndex, 0, newComponentStep);
                setSteps(stepsWithoutSelected);
                setSelectedStepIds([]);
                setIsCreateModalOpen(false);
                setIsExtractMode(false);
              }} className={`text-xs px-3 py-1 ${!createName.trim() ? 'bg-slate-700 text-slate-400 border border-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'} rounded`}>确认创建</button>
            </div>
          </div>
        </div>
      )}
      {isParamsModalOpen && componentDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[720px] bg-slate-900 border border-slate-800 rounded-lg shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">组件参数模板</div>
              <button onClick={() => { setIsParamsModalOpen(false); setComponentDraft(null); }} className="text-slate-400 text-xs">关闭</button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">参数列表</div>
                <div className="space-y-2">
                  {paramSchema.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={p.key} onChange={(e) => {
                        const v = e.target.value; const next = [...paramSchema]; next[i] = { ...next[i], key: v }; setParamSchema(next);
                      }} placeholder="key" className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 w-28" />
                      <input value={p.label || ''} onChange={(e) => {
                        const v = e.target.value; const next = [...paramSchema]; next[i] = { ...next[i], label: v }; setParamSchema(next);
                      }} placeholder="label" className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 flex-1" />
                      <input value={p.defaultValue || ''} onChange={(e) => {
                        const v = e.target.value; const next = [...paramSchema]; next[i] = { ...next[i], defaultValue: v }; setParamSchema(next);
                      }} placeholder="default" className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 w-32" />
                      <button onClick={() => { const next = [...paramSchema]; next.splice(i,1); setParamSchema(next); }} className="text-[10px] text-red-400 px-2 py-1">移除</button>
                    </div>
                  ))}
                  <button onClick={() => setParamSchema(prev => [...prev, { key: '', label: '', defaultValue: '' }])} className="mt-2 text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300">新增参数</button>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">字段绑定</div>
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {fieldBindings.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-36">步骤 {b.stepIndex+1} · {b.path}</span>
                      <select value={b.paramKey} onChange={(e) => {
                        const v = e.target.value; const next = [...fieldBindings]; next[i] = { ...next[i], paramKey: v }; setFieldBindings(next);
                      }} className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 flex-1">
                        <option value="">不绑定</option>
                        {paramSchema.map(p => (<option key={p.key} value={p.key}>{p.key}</option>))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2">
              <button onClick={() => { setIsParamsModalOpen(false); setComponentDraft(null); }} className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300">取消</button>
              <button onClick={() => {
                if (!componentDraft) return;
                const trimmedKeys = paramSchema.map(p => (p.key || '').trim());
                const hasEmpty = trimmedKeys.some(k => !k);
                const uniq = new Set(trimmedKeys.filter(k => k));
                const hasDup = uniq.size !== trimmedKeys.filter(k => k).length;
                if (hasEmpty || hasDup) {
                  alert('参数 key 不可为空且需唯一');
                  return;
                }
                const paramsObject: Record<string, any> = {};
                paramSchema.forEach(p => { if (p.key) paramsObject[p.key.trim()] = p.defaultValue || '' });
                const applyBinding = (s: Step, binding: { path: string; key: string }): Step => {
                  const clone = JSON.parse(JSON.stringify(s));
                  const parts = binding.path.split('.');
                  let ref: any = clone;
                  for (let j=0;j<parts.length-1;j++){ const k=parts[j]; ref[k] = ref[k] ?? {}; ref = ref[k]; }
                  const leaf = parts[parts.length-1];
                  ref[leaf] = `{{${binding.key}}}`;
                  return clone as Step;
                }
                let newSteps = componentDraft.steps.map(s => ({...s}));
                fieldBindings.filter(b => b.paramKey).forEach(b => {
                  newSteps[b.stepIndex] = applyBinding(newSteps[b.stepIndex], { path: b.path, key: b.paramKey.trim() });
                });
                const newComponent = { id: `comp-${Date.now()}`, name: componentDraft.name, steps: newSteps, paramsSchema: paramSchema };
                setUserComponents(prev => [...prev, newComponent]);
                const newComponentStep: Step = { id: `step-${Date.now()}`, type: StepType.COMPONENT, action: 'component', intent: `执行组件: ${componentDraft.name}`, componentId: newComponent.id, componentName: newComponent.name, status: 'pending', params: paramsObject };
                const firstSelectedIndex = steps.findIndex(step => step.id === selectedStepIds[0]);
                const stepsWithoutSelected = steps.filter(step => !selectedStepIds.includes(step.id));
                stepsWithoutSelected.splice(firstSelectedIndex, 0, newComponentStep);
                setSteps(stepsWithoutSelected);
                setSelectedStepIds([]);
                setIsParamsModalOpen(false);
                setComponentDraft(null);
              }} className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded">保存并插入</button>
            </div>
          </div>
        </div>
      )}
      
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
             onClick={() => setIsHeadless(h => !h)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${isHeadless ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' : 'bg-green-600/20 text-green-400 border border-green-600/50'}`}
           >
             {isHeadless ? '无头：开' : '无头：关'}
           </button>
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
             {activeSidebarTab === 'steps' && (
               <div className="p-2 border-b border-slate-800 bg-slate-900/50 h-14 flex items-center">
                 <button
                     onClick={() => setIsExtractMode(m => !m)}
                     className={`mr-2 flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${isExtractMode ? 'bg-blue-900/40 text-blue-300 border border-blue-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
                 >
                     提取模式
                 </button>
                 <button
                     onClick={handleExtractComponent}
                     disabled={selectedStepIds.length < 2}
                     className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                     提取为组件
                 </button>
                 {isExtractMode && (
                   <span className="ml-2 text-[10px] px-2 py-0.5 rounded border border-blue-700 bg-blue-900/30 text-blue-300">提取模式：开</span>
                 )}
               </div>
             )}
             {activeSidebarTab === 'steps' ? (
                <StepList 
                  steps={steps} 
                  activeStepId={activeStepId}
                  selectedStepIds={selectedStepIds}
                  selectionEnabled={isExtractMode}
                  selectionCount={selectedStepIds.length}
                  expandedMap={expandedComponentIds}
                  onToggleExpand={(id) => setExpandedComponentIds(prev => ({ ...prev, [id]: !prev[id] }))}
                  onStepClick={handleStepClick}
                  onToggleStepSelection={handleToggleStepSelection}
                  onSelectAll={() => setSelectedStepIds(steps.map(s => s.id))}
                  onInvertSelection={() => setSelectedStepIds(prev => steps.map(s => s.id).filter(id => !prev.includes(id)))}
                  onDeleteStep={handleDeleteStep}
                  onRunStep={handleRunStep}
                  onMoveStep={handleMoveStep}
                  onEditStep={handleEditStep}
                  userComponents={userComponents}
                  onUpdateStep={(s) => setSteps(prev => prev.map(x => x.id === s.id ? s : x))}
                  onUngroupComponent={(s) => {
                    const idx = steps.findIndex(x => x.id === s.id);
                    if (idx < 0) return;
                    const comp = userComponents.find(c => c.id === s.componentId);
                    if (!comp) return;
                    const clones: Step[] = comp.steps.map((cs: Step) => ({ ...cs, id: Math.random().toString(36).slice(2) }));
                    const next = [...steps];
                    next.splice(idx, 1, ...clones);
                    setSteps(next);
                  }}
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
            <div className="ml-auto flex items-center gap-2">
              <button 
                onClick={handleToggleStreaming}
                className={`text-xs font-medium px-2 py-1 rounded border ${isStreaming ? 'border-green-600 text-green-400 bg-green-500/10' : 'border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700'}`}
              >
                {isStreaming ? '流式预览：开' : '流式预览：关'}
              </button>
              <select
                value={inspectTrigger}
                onChange={(e) => setInspectTrigger(e.target.value as any)}
                className="text-xs px-2 py-1 rounded border bg-slate-800 text-slate-300 border-slate-700"
              >
                <option value="ctrlOrMeta">菜单触发键：Ctrl/⌘</option>
                <option value="alt">菜单触发键：Alt</option>
                <option value="shift">菜单触发键：Shift</option>
              </select>
            </div>
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
                sessionId={sessionId || undefined}
                isStreaming={isStreaming}
                isKeyRecording={isKeyRecording}
                onToggleKeyRecording={handleToggleKeyRecording}
                onPlaybackKeys={handlePlaybackKeys}
                onKeyEvent={handleKeyEvent}
                inspectTrigger={inspectTrigger}
                keyCount={keyLog.filter(k => k.type==='down').length}
                textCount={inputBuffer.length}
                failureInfo={failureInfo}
                onClearFailure={() => setFailureInfo(null)}
                onShowFailure={() => setIsFailureModalOpen(true)}
                failureRect={failureRect}
                sessionPages={sessionPages}
                activePageId={activePageId || undefined}
                onActivatePage={handleActivatePage}
                newPageNotification={newPageNotification}
                onDismissNotification={() => setNewPageNotification(null)}
                onClosePage={async (pid) => { if (!sessionId) return; const { closePage } = await import('./services/agentClient'); await closePage(sessionId, pid); const pages = await getPages(sessionId); setSessionPages(pages.pages || []); if (activePageId === pid) setActivePageId(pages.activePageId || null); setNewPageNotification(null); }}
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
      {isFailureModalOpen && failureInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[720px] bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="text-sm font-semibold text-red-400">断言失败快照</div>
              <button onClick={() => setIsFailureModalOpen(false)} className="text-slate-400 text-xs">关闭</button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400 mb-2">截图</div>
                <div className="border border-slate-700 rounded bg-black overflow-hidden">
                  {screenshotBase64 ? (
                    <img src={`data:image/jpeg;base64,${screenshotBase64}`} className="w-full h-auto" />
                  ) : (
                    <div className="text-[10px] text-slate-500 p-3">暂无截图</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-2">DOM 片段</div>
                <pre className="text-[11px] leading-relaxed bg-slate-950 border border-slate-700 rounded p-3 text-slate-300 overflow-auto max-h-[360px] whitespace-pre-wrap">{failureInfo.htmlSnippet}</pre>
              </div>
            </div>
            <div className="p-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button onClick={() => { setFailureInfo(null); setIsFailureModalOpen(false) }} className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300">清除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
