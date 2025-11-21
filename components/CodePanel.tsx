import React, { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodePanelProps {
  code: string;
  isLoading: boolean;
}

export const CodePanel: React.FC<CodePanelProps> = ({ code, isLoading }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 text-slate-300 font-mono text-xs">
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/50">
        <span className="font-semibold text-slate-400">生成的脚本</span>
        <button 
          onClick={handleCopy}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-4 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-slate-500 animate-pulse">生成中...</span>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-blue-100 leading-relaxed">
            {code.split('\n').map((line, i) => (
              <div key={i} className="table-row">
                 <span className="table-cell text-slate-600 select-none pr-4 text-right w-8">{i + 1}</span>
                 <span className="table-cell">{line}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
};