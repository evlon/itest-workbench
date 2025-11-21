
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Lock, MousePointer2, AlertCircle, Search, ShoppingCart, User, MoreHorizontal, Sparkles, CheckCircle, Type, Eye, Wifi, Zap, MonitorPlay, Check, X } from 'lucide-react';

interface BrowserPreviewProps {
  url: string;
  onUrlChange: (url: string) => void;
  onElementClick: (actionData: any) => void;
  isRecording: boolean;
}

// Mock AI Suggestion Logic
const getAiSuggestions = (element: any) => {
    const suggestions = [];
    const text = element.text || '';
    const id = element.id || '';
    
    if (text.includes('$') || text.match(/\d+\.\d{2}/)) {
        suggestions.push({ label: '验证价格 > 0', action: 'wait', intent: `验证 ${element.label} 的价格大于 0`, type: 'verification' });
        suggestions.push({ label: '提取价格数值', action: 'extract', intent: `提取 ${element.label} 的数值`, type: 'interaction' });
    }
    
    if (id.includes('input') || id.includes('username') || id.includes('password')) {
        suggestions.push({ label: '输入值...', action: 'input', intent: `在 ${element.label} 输入`, type: 'interaction', requiresParam: true });
    }

    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('fail')) {
        suggestions.push({ label: '验证错误提示', action: 'wait', intent: `验证显示错误信息 "${text}"`, type: 'verification' });
    }

    return suggestions;
};

export const BrowserPreview: React.FC<BrowserPreviewProps> = ({ url, onUrlChange, onElementClick, isRecording }) => {
  const [inputUrl, setInputUrl] = useState(url);
  const [isConnected, setIsConnected] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<{ x: number, y: number, width: number, height: number, label: string, id?: string, text?: string } | null>(null);
  
  // Context Menu State
  const [menuPosition, setMenuPosition] = useState<{x: number, y: number} | null>(null);
  const [menuTarget, setMenuTarget] = useState<any | null>(null);
  
  // Parameter Configuration State
  const [pendingAction, setPendingAction] = useState<any | null>(null);
  const [paramValue, setParamValue] = useState("");
  
  // Ref to the viewport to calculate relative coordinates
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputUrl(url);
    setIsConnected(false);
    const timer = setTimeout(() => setIsConnected(true), 800);
    return () => clearTimeout(timer);
  }, [url]);

  // Close menu when clicking elsewhere
  useEffect(() => {
      const closeMenu = () => {
          setMenuPosition(null);
          setPendingAction(null);
          setParamValue("");
      };
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleUrlSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onUrlChange(inputUrl);
  };

  // Coordinate-based Probe Logic (Stagehand Simulation)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isRecording || !isConnected || menuPosition || !viewportRef.current) return;

    // Get the element under the cursor
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) {
        setHoveredElement(null);
        return;
    }

    // Find the closest interactive element defined by our mock data attributes
    const interactiveEl = target.closest('[data-sh-interactive="true"]');
    
    if (interactiveEl) {
        const rect = interactiveEl.getBoundingClientRect();
        const viewportRect = viewportRef.current.getBoundingClientRect();
        
        setHoveredElement({
            x: rect.left - viewportRect.left,
            y: rect.top - viewportRect.top,
            width: rect.width,
            height: rect.height,
            label: interactiveEl.getAttribute('data-sh-label') || 'Unknown Element',
            id: interactiveEl.getAttribute('data-sh-id') || undefined,
            text: interactiveEl.textContent || undefined
        });
    } else {
        setHoveredElement(null);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
      if (!isRecording || !hoveredElement) return;
      e.stopPropagation();

      // Check for Picker Hotkey (Cmd/Ctrl + Click)
      if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setMenuTarget(hoveredElement);
          
          // Calculate menu position relative to the viewport container
          if (viewportRef.current) {
              const rect = viewportRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const safeX = Math.min(Math.max(0, x), rect.width - 230);
              const safeY = Math.min(Math.max(0, y), rect.height - 300);
              
              setMenuPosition({ x: safeX, y: safeY });
          }
      } else {
          // Default Action: Click
          onElementClick({ 
              action: 'click', 
              intent: `点击 ${hoveredElement.label}`, 
              type: 'interaction',
              target: hoveredElement 
          });
      }
  };

  const handleMenuAction = (actionDef: any) => {
      if (!menuTarget) return;
      
      if (actionDef.requiresParam) {
          setPendingAction(actionDef);
          setParamValue("");
          return;
      }

      submitAction(actionDef);
  };

  const submitAction = (actionDef: any, params?: any) => {
      let finalIntent = actionDef.intent || `${actionDef.action} ${menuTarget.label}`;
      
      if (params && params.value) {
          finalIntent = `${finalIntent} "${params.value}"`;
      } else if (actionDef.requiresParam && !params?.value) {
          // Fallback if param was required but empty (though UI shouldn't allow this ideally, or maybe empty string is valid)
           finalIntent = `${finalIntent} ""`;
      }

      onElementClick({
          action: actionDef.action,
          intent: finalIntent,
          type: actionDef.type,
          target: menuTarget,
          params: params
      });
      
      setMenuPosition(null);
      setMenuTarget(null);
      setPendingAction(null);
      setParamValue("");
  };

  // --- Mock Pages Rendering (Pure HTML with Data Attributes) ---
  const renderContent = () => {
    const currentUrl = inputUrl.toLowerCase();

    if (currentUrl.includes('login')) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 bg-white">
                <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-slate-200 space-y-4">
                    <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">Welcome Back</h2>
                    <div 
                        className="space-y-1 p-1"
                        data-sh-interactive="true"
                        data-sh-label="用户名输入框"
                        data-sh-id="username"
                    >
                        <label className="text-xs font-semibold text-slate-500 uppercase">Username</label>
                        <div className="h-10 w-full bg-slate-100 rounded border border-slate-300"></div>
                    </div>
                    <div 
                        className="space-y-1 p-1"
                        data-sh-interactive="true"
                        data-sh-label="密码输入框"
                        data-sh-id="password"
                    >
                        <label className="text-xs font-semibold text-slate-500 uppercase">Password</label>
                        <div className="h-10 w-full bg-slate-100 rounded border border-slate-300"></div>
                    </div>
                    <button 
                        className="w-full h-10 bg-blue-600 text-white font-bold rounded mt-4"
                        data-sh-interactive="true"
                        data-sh-label="登录按钮"
                        data-sh-id="btn-login"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    // Default Shop View
    return (
        <div className="p-10 max-w-5xl mx-auto bg-slate-50 min-h-full">
            <div className="flex justify-between items-center mb-10">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingCart className="text-blue-600"/> Example Shop
                </h1>
                <div className="flex gap-3">
                    <div 
                        className="flex items-center bg-white border border-slate-300 rounded-full px-4 py-2 w-64 shadow-sm"
                        data-sh-interactive="true"
                        data-sh-label="顶部搜索框"
                        data-sh-id="search-input"
                    >
                        <Search size={14} className="text-slate-400 mr-2"/>
                        <span className="text-slate-400 text-sm">Search products...</span>
                    </div>
                    <button 
                        className="bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
                        data-sh-interactive="true"
                        data-sh-label="登录链接"
                        data-sh-id="nav-login"
                        onClick={() => !isRecording && onUrlChange("https://example-shop.com/login")}
                    >
                        <User size={14}/> Login
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
                 {[1, 2, 3].map((i) => (
                     <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="h-40 bg-slate-100 relative">
                            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                Product Image {i}
                            </div>
                        </div>
                        <div className="p-4">
                            <div 
                                className="h-6 bg-slate-800/5 w-3/4 rounded mb-2"
                                data-sh-interactive="true"
                                data-sh-label={`商品标题 ${i}`}
                                data-sh-id={`product-title-${i}`}
                            ></div>
                            <div className="h-4 bg-slate-800/5 w-1/2 rounded mb-4"></div>
                            <div className="flex justify-between items-center mt-4">
                                <span 
                                    className="font-bold text-slate-800 p-1"
                                    data-sh-interactive="true"
                                    data-sh-label={`商品价格 ${i}`}
                                    data-sh-id={`price-${i}`}
                                >
                                    $99.00
                                </span>
                                <button 
                                    className="bg-blue-100 text-blue-600 px-3 py-1 rounded text-xs font-bold"
                                    data-sh-interactive="true"
                                    data-sh-label={`添加到购物车 ${i}`}
                                    data-sh-id={`btn-add-${i}`}
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                     </div>
                 ))}
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Browser Toolbar - Dark Mode */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-3 gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2 text-slate-400">
            <ArrowLeft size={16} className="hover:text-slate-200 cursor-pointer" />
            <ArrowRight size={16} className="hover:text-slate-200 cursor-pointer" />
            <RefreshCw size={14} className={`hover:text-slate-200 cursor-pointer ${!isConnected ? 'animate-spin text-blue-500' : ''}`} onClick={() => setIsConnected(false)}/>
        </div>
        
        <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-full px-3 py-1.5 text-xs shadow-sm focus-within:border-blue-500 transition-colors">
             <Lock size={10} className="text-green-500 mr-2" />
             <input 
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder-slate-600 font-mono"
             />
        </form>
      </div>

      {/* Browser Viewport - Stagehand Stream Simulation */}
      <div 
        ref={viewportRef}
        className="flex-1 relative bg-slate-50 overflow-hidden select-none cursor-crosshair"
        onMouseLeave={() => setHoveredElement(null)}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
         {!isConnected ? (
             <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50">
                 <div className="flex flex-col items-center gap-4">
                     <div className="relative">
                        <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <MonitorPlay size={20} className="text-blue-500" />
                        </div>
                     </div>
                     <p className="text-slate-400 text-sm font-mono animate-pulse">Connecting to Stagehand Browser...</p>
                 </div>
             </div>
         ) : (
             <div className="h-full w-full relative">
                 {/* Mock Stream Content */}
                 {renderContent()}

                 {/* Recording Overlay UI */}
                 {isRecording && (
                     <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-blue-600/90 backdrop-blur text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-3 animate-in slide-in-from-top-2 border border-blue-400/30">
                         <div className="flex items-center gap-1.5">
                             <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                             <span>Recording Active</span>
                         </div>
                         <div className="w-px h-3 bg-white/20"></div>
                         <div className="flex items-center gap-2 text-blue-100">
                             <span className="font-mono bg-white/20 px-1 rounded text-[10px]">Cmd</span> + Click for Menu
                         </div>
                     </div>
                 )}

                 {/* Hover Highlighter (Probe Visualizer) */}
                 {isRecording && hoveredElement && !menuPosition && (
                     <div 
                       className="absolute border-2 border-blue-500 bg-blue-500/10 z-40 pointer-events-none transition-all duration-75 rounded-sm shadow-[0_0_0_1000px_rgba(0,0,0,0.1)]"
                       style={{
                         left: hoveredElement.x,
                         top: hoveredElement.y,
                         width: hoveredElement.width,
                         height: hoveredElement.height
                       }}
                     >
                        <div className="absolute -top-7 left-0 bg-blue-600 text-white text-[10px] px-2 py-1 rounded shadow flex items-center gap-1 whitespace-nowrap z-50">
                            <MousePointer2 size={10} />
                            <span className="font-mono max-w-[200px] truncate">{hoveredElement.label}</span>
                            <span className="bg-blue-700 px-1 rounded text-[9px] opacity-80">{hoveredElement.id ? `#${hoveredElement.id}` : 'Text Node'}</span>
                        </div>
                     </div>
                 )}
                 
                 {/* Context Menu */}
                 {menuPosition && menuTarget && (
                    <div 
                        className="absolute z-50 w-60 bg-slate-900/95 backdrop-blur rounded-lg shadow-2xl border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left text-slate-100"
                        style={{ left: menuPosition.x, top: menuPosition.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-900 flex items-center justify-between">
                            <span className="text-xs font-semibold truncate max-w-[140px] text-blue-400">{menuTarget.label}</span>
                            <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                                {menuTarget.id ? `#${menuTarget.id}` : 'DOM'}
                            </span>
                        </div>
                        
                        {pendingAction ? (
                            <div className="p-3 space-y-3 animate-in slide-in-from-right-2 duration-200">
                                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                    {pendingAction.icon || (pendingAction.action === 'input' ? <Type size={14}/> : <Eye size={14}/>)}
                                    <span>{pendingAction.label}</span>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">参数值 (Value)</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={paramValue}
                                        onChange={(e) => setParamValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') submitAction(pendingAction, { value: paramValue });
                                            if (e.key === 'Escape') setPendingAction(null);
                                        }}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none shadow-inner"
                                        placeholder="输入参数..."
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button 
                                        onClick={() => setPendingAction(null)}
                                        className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded flex items-center gap-1 transition-colors"
                                    >
                                        <X size={10} /> 取消
                                    </button>
                                    <button 
                                        onClick={() => submitAction(pendingAction, { value: paramValue })}
                                        className="px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-500 rounded flex items-center gap-1 transition-colors shadow-sm"
                                    >
                                        <Check size={10} /> 确认
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* AI Suggestions */}
                                <div className="p-1.5">
                                    <div className="px-2 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                        <Sparkles size={10} className="text-purple-400" /> AI Actions
                                    </div>
                                    {getAiSuggestions(menuTarget).length > 0 ? (
                                        getAiSuggestions(menuTarget).map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleMenuAction(s)}
                                                className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-purple-900/30 hover:text-purple-300 rounded flex items-center gap-2 transition-colors group"
                                            >
                                                {s.action === 'wait' ? <CheckCircle size={12} className="group-hover:text-purple-400"/> : <MoreHorizontal size={12} className="group-hover:text-purple-400"/>}
                                                {s.label}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-2 py-1 text-[10px] text-slate-600 italic">No smart actions available</div>
                                    )}
                                </div>

                                <div className="h-px bg-slate-700/50 mx-2 my-0.5"></div>

                                {/* Standard Actions */}
                                <div className="p-1.5">
                                    <div className="px-2 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Manual</div>
                                    {[
                                        { label: '点击 (Click)', icon: <MousePointer2 size={12}/>, action: 'click', type: 'interaction' },
                                        { label: '输入 (Input)', icon: <Type size={12}/>, action: 'input', type: 'interaction', intent: `在 ${menuTarget.label} 输入`, requiresParam: true },
                                        { label: '等待出现 (Assert Visible)', icon: <Eye size={12}/>, action: 'wait', type: 'verification', intent: `验证 ${menuTarget.label} 可见` },
                                        { label: '断言文本 (Assert Text)', icon: <CheckCircle size={12}/>, action: 'wait', type: 'verification', intent: `验证 ${menuTarget.label} 包含文本`, requiresParam: true },
                                    ].map((opt, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => handleMenuAction(opt)}
                                            className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded flex items-center gap-2 transition-colors group"
                                        >
                                            <span className="text-slate-500 group-hover:text-slate-200 transition-colors">{opt.icon}</span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                 )}
             </div>
         )}
      </div>

      {/* Connection Status Bar */}
      <div className="h-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 text-[10px] font-mono text-slate-500 select-none">
          <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  {isConnected ? 'Stagehand Connected' : 'Disconnected'}
              </span>
              {isConnected && (
                  <span className="flex items-center gap-1 text-slate-600">
                      <Wifi size={10} /> 24ms latency
                  </span>
              )}
          </div>
          <div className="flex items-center gap-2">
              <span className="text-slate-600">Resolution: 1280x800</span>
              <div className="w-px h-3 bg-slate-800"></div>
              <span className="text-slate-600">Playwright Engine</span>
          </div>
      </div>
    </div>
  );
};
