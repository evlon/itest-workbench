export enum StepType {
  INTERACTION = 'interaction',
  VERIFICATION = 'verification',
  NAVIGATION = 'navigation',
  CUSTOM = 'custom',
  COMPONENT = 'component'
}

export enum ScriptMode {
  STATIC = 'STATIC', // Playwright standard
  DYNAMIC = 'DYNAMIC' // Stagehand AI
}

export interface StepTarget {
  description: string;
  selectors: {
    precise: string; // CSS/XPath
    semantic?: string; // Aria-label, etc.
  };
}

export interface Step {
  id: string;
  type: StepType;
  intent: string; // Natural language intent
  action: 'click' | 'input' | 'extract' | 'navigate' | 'wait' | 'keypress' | 'component';
  target?: StepTarget;
  params?: Record<string, any>;
  status: 'pending' | 'success' | 'failed' | 'recording';
  isAiGenerated?: boolean;
  componentId?: string;
  componentName?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  url: string;
  steps: Step[];
  mode: ScriptMode;
}

export interface CodeGenerationResult {
  code: string;
  mode: ScriptMode;
}