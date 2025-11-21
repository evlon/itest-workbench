import React, { useEffect, useState } from 'react';
import { Plus, Key, Search, Eye, FileText, MousePointerClick, Navigation, AlertCircle } from 'lucide-react';
import { StepType } from '../types';
import { load } from 'js-yaml';

// --- Icon Mapping ---
const ICON_MAP: Record<string, React.ElementType> = {
  Navigation,
  Key,
  Search,
  Eye,
  FileText,
  MousePointerClick,
  AlertCircle
};

interface TemplateConfig {
  id: string;
  label: string;
  icon: string; // String name from YAML
  iconColor?: string;
  description: string;
  stepData: {
    intent: string;
    action: 'click' | 'input' | 'extract' | 'navigate' | 'wait' | 'keypress';
    type: StepType;
  };
}

interface ComponentLibraryProps {
  onAddTemplate: (template: any) => void;
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ onAddTemplate }) => {
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        // Fetch the raw YAML file from the public root
        const response = await fetch('templates.yaml');
        if (!response.ok) {
          throw new Error(`Failed to load templates: ${response.statusText}`);
        }
        const text = await response.text();
        
        // Parse YAML
        const data = load(text) as TemplateConfig[];
        setTemplates(data);
      } catch (err) {
        console.error("Failed to load templates:", err);
        setError(err instanceof Error ? err.message : 'Unknown error loading library');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleTemplateClick = (tpl: TemplateConfig) => {
    // Transform the config format back to what the App expects if needed,
    // or pass it directly if App is flexible. 
    // Here we ensure the icon isn't passed as string to App if App expects Node, 
    // but App currently uses `template.label` and `stepData`.
    // We just pass the config object which matches the structure App needs for logic.
    onAddTemplate(tpl);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 border-r border-slate-800">
        <div className="flex flex-col items-center gap-2 text-slate-500">
           <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
           <span className="text-xs">加载组件库...</span>
        </div>
      </div>
    );
  }

  if (error) {
     return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-900 border-r border-slate-800 p-4 text-center">
         <AlertCircle className="text-red-500 mb-2" size={20} />
         <p className="text-xs text-slate-300">无法加载配置文件</p>
         <p className="text-[10px] text-slate-500 mt-1 break-all">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800">
        <h2 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">组件库</h2>
        <p className="text-[10px] text-slate-500 mt-1">拖拽或点击添加到流程</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {templates.map((tpl) => {
          const IconComponent = ICON_MAP[tpl.icon] || AlertCircle;
          
          return (
            <button
              key={tpl.id}
              onClick={() => handleTemplateClick(tpl)}
              className="w-full group flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all bg-slate-800/40 border border-transparent hover:bg-slate-800 hover:border-slate-700 text-left"
            >
              <div className="mt-0.5 bg-slate-900 p-1.5 rounded border border-slate-800 group-hover:border-slate-600 transition-colors">
                <IconComponent size={16} className={tpl.iconColor || "text-slate-400"} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{tpl.label}</span>
                  <Plus size={14} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{tpl.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
