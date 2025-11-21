import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Lock, MonitorPlay, Wifi, MousePointer2 } from 'lucide-react';

interface BrowserPreviewProps {
  url: string;
  onUrlChange: (url: string) => void;
  onElementSelect: (elementData: any) => void;
  isInspecting: boolean;
  screenshotBase64?: string;
}

/**
 * NOTE: This is a placeholder/simulation of a Stagehand-powered browser preview.
 * In a real implementation, this component would host a VNC client (like noVNC)
 * connected to a remote browser managed by Stagehand.
 *
 * All interactions (hover, click) would be sent as commands to Stagehand,
 * which would then return the results. For this simulation, we are faking
 * these interactions and the returned data.
 */
export const BrowserPreview: React.FC<BrowserPreviewProps> = ({ url, onUrlChange, onElementSelect, isInspecting, screenshotBase64 }) => {
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Simulate loading the remote browser session
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200); // Fake connection delay
    return () => clearTimeout(timer);
  }, [url]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUrlChange(inputUrl);
  };
  
  const handleViewportClick = (e: React.MouseEvent) => {
    if (isInspecting && !isLoading) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // In a real implementation, we would send these coordinates to Stagehand.
      // Stagehand would identify the element at these coordinates in the real browser.
      // For now, we simulate this by creating a fake element.
      
      console.log(`[Simulated Stagehand] User clicked at (${x.toFixed(0)}, ${y.toFixed(0)}). Asking Stagehand to identify element.`);

      // Simulate a response from Stagehand after a short delay
      setTimeout(() => {
        const target = {
          description: `元素 @ (${x.toFixed(0)}, ${y.toFixed(0)})`,
          selectors: {
            precise: `div.some-class > #${`el-${Date.now()}`}`
          }
        };
        onElementSelect({ target });
      }, 300);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      {/* Browser Toolbar */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-3 gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2 text-slate-400">
            <ArrowLeft size={16} className="text-slate-600" />
            <ArrowRight size={16} className="text-slate-600" />
            <RefreshCw size={14} className="hover:text-slate-200 cursor-pointer" onClick={() => onUrlChange(url)}/>
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

      {/* Browser Viewport */}
      <div 
        ref={viewportRef}
        className={`flex-1 relative bg-gray-200 overflow-hidden ${isInspecting ? 'cursor-crosshair' : ''}`}
        onClick={handleViewportClick}
      >
        {isLoading ? (
             <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50">
                 <div className="flex flex-col items-center gap-4">
                     <div className="relative">
                        <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <MonitorPlay size={20} className="text-blue-500" />
                        </div>
                     </div>
                     <p className="text-slate-400 text-sm font-mono animate-pulse">连接到 Stagehand 浏览器...</p>
                 </div>
             </div>
        ) : (
            <div className="w-full h-full relative bg-black">
              {isInspecting && (
                <div className="absolute inset-0 bg-blue-500/10 border-4 border-dashed border-blue-500/50 flex items-center justify-center pointer-events-none animate-pulse z-10">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                    <MousePointer2 size={16} />
                    <span className="font-bold">检查模式</span>
                  </div>
                </div>
              )}
              {screenshotBase64 ? (
                <img src={`data:image/png;base64,${screenshotBase64}`} alt="preview" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">无预览</div>
              )}
            </div>
        )}
      </div>

       {/* Status Bar */}
      <div className="h-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${!isLoading ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  {!isLoading ? 'Stagehand 已连接' : '正在连接...'}
              </span>
              {!isLoading && (
                  <span className="flex items-center gap-1 text-slate-600">
                      <Wifi size={10} /> 24ms 延迟
                  </span>
              )}
          </div>
          <span className="text-slate-600">模拟远程浏览器</span>
      </div>
    </div>
  );
};