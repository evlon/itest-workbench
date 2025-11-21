import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import { Step, ScriptMode } from "../types";
import { refineStepTarget, getBestStaticSelectorForStep } from './selectorRefiner';

const MODEL_NAME = import.meta.env.VITE_MODEL_NAME || '';
const LLM_TYPE = MODEL_NAME.split('/')[0];
const modelName = MODEL_NAME.split('/')[1];
const isOpenAI = LLM_TYPE === 'openai';

let apiKey = '';
let baseUrl = '';

if (isOpenAI) {
  apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  baseUrl = import.meta.env.VITE_OPENAI_BASE_URL || '';
} else {
  apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || '';
}

let geminiClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;

if (apiKey) {
  if (isOpenAI) {
    openaiClient = new OpenAI({ apiKey, baseURL: baseUrl, dangerouslyAllowBrowser: true });
  } else {
    geminiClient = new GoogleGenAI({ apiKey });
  }
}

// Models
// const GEMINI_MODEL = "gemini-2.5-flash";
// const OPENAI_MODEL = "gpt-4o"; 

export const parseIntentToStep = async (
  intent: string,
  currentUrl: string,
  pageContextHtml: string
): Promise<Partial<Step>> => {
  if (!apiKey) {
    // Fallback for demo without key
    console.warn("API Key missing, using mock response");
    return {
      intent,
      type: 'interaction', 
      action: 'click',
      target: {
        description: '预测元素 (演示模式)',
        selectors: { precise: '.predicted-element' }
      }
    } as any;
  }

  const systemPrompt = `
      你是一个自动化测试工作台的 AI 代理。
      分析用户的自然语言意图。
      'action' 必须是以下之一: 'click', 'input', 'extract', 'navigate', 'wait'。
      提供基于最佳实践 (id > data-testid > class) 的精确 CSS 选择器。
      如果可能，提供语义选择器 (aria-label, text content)。
      'description' 字段请使用中文描述该元素。
  `;

  const userContent = `
      意图: "${intent}"
      当前上下文 URL: "${currentUrl}"
      HTML 片段: ${pageContextHtml.substring(0, 1000)}...
      
      请返回 JSON 格式。
  `;

  try {
    if (isOpenAI && openaiClient) {
      const completion = await openaiClient.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        response_format: { type: "json_object" }
      });
      const content = completion.choices[0].message.content;
      return content ? JSON.parse(content) : {};
    } else if (geminiClient) {
      const response = await geminiClient.models.generateContent({
        model: modelName,
        contents: `${systemPrompt}\n\n${userContent}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              action: { type: Type.STRING },
              target: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  selectors: {
                    type: Type.OBJECT,
                    properties: {
                      precise: { type: Type.STRING },
                      semantic: { type: Type.STRING }
                    }
                  }
                }
              },
              params: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                  value: { type: Type.STRING },
                  url: { type: Type.STRING },
                  text: { type: Type.STRING }
                }
              }
            }
          }
        }
      });
        if (response.text) {
        return JSON.parse(response.text);
      }
    }
    throw new Error("No response from AI provider");
  
  } catch (error) {
    console.error("AI Intent Parse Error:", error);
    return {
      intent: intent,
      action: 'wait',
      type: 'custom' as any,
      status: 'pending'
    } as any;
  }
};

export const parseIntentToStepRefined = async (
  intent: string,
  currentUrl: string,
  pageContextHtml: string
): Promise<Partial<Step>> => {
  const res = await parseIntentToStep(intent, currentUrl, pageContextHtml)
  if (res && (res as any).target) {
    const refined = refineStepTarget((res as any).target)
    ;(res as any).target = refined
  }
  return res
}

export const generateTestScript = async (
  steps: Step[],
  mode: ScriptMode
): Promise<string> => {
  if (!apiKey) return "// API Key 缺失。生成了模拟脚本。\n\nimport { test } from '@playwright/test';\n\ntest('Mock Test', async ({ page }) => {\n});";

  const stepsJson = JSON.stringify(steps.map(s => ({
    intent: s.intent,
    action: s.action,
    selector: mode === ScriptMode.STATIC ? getBestStaticSelectorForStep(s) : s.target?.selectors?.precise,
    params: s.params
  })));

  const systemInstruction = mode === ScriptMode.DYNAMIC
    ? `你是一个 Stagehand 脚本生成器。
       生成一个基于 Vitest 和 Stagehand 的 TypeScript 测试文件。
       严格规则：
       1. 必须包含: import { stagehand } from '@browserbasehq/stagehand';
       2. 必须包含: import { test, expect } from 'vitest';
       3. 使用 'await page.act("自然语言意图")' 进行操作。
       4. 使用 'await page.extract("提取描述")' 获取数据。
       5. 代码注释必须使用中文。
       6. 确保代码是语法正确的 TypeScript。`
    : `你是一个 Playwright 脚本生成器。
       生成一个标准的 Playwright TypeScript 测试文件。
       严格规则：
       1. 必须包含: import { test, expect } from '@playwright/test';
       2. 使用 'await page.locator("selector").click()' 风格。
       3. 优先使用提供的静态精确选择器(precise selector)。
       4. 代码注释必须使用中文。
       5. 确保代码是语法正确的 TypeScript。`;

  const userPrompt = `
    根据以下测试步骤生成一个完整、可运行的测试文件 (.spec.ts):
    ${stepsJson}

    请直接输出代码内容，不要包裹在 markdown 代码块中。
  `;

  try {
    if (isOpenAI && openaiClient) {
        const completion = await openaiClient.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userPrompt }
            ]
        });
        const text = completion.choices[0].message.content || "";
        // Strip markdown code blocks if present (OpenAI loves adding them)
        return text.replace(/^```typescript\n|^```\n|```$/gm, '');
    } else if (geminiClient) {
        const response = await geminiClient.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction: systemInstruction
          }
        });
        return response.text || "// 生成脚本失败，AI 未返回内容";
    }
    return "// Error: Client initialization failed";
  } catch (error) {
    console.error("AI Script Gen Error:", error);
    return `// 生成脚本出错。\n// 错误信息: ${error}`;
  }
};