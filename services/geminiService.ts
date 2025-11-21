import { GoogleGenAI, Type } from "@google/genai";
import { Step, ScriptMode } from "../types";

// Use the environment variable API key
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = "gemini-2.5-flash";

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

  try {
    const prompt = `
      你是一个自动化测试工作台的 AI 代理。
      分析用户的自然语言意图："${intent}"。
      当前上下文: URL 是 "${currentUrl}"。
      HTML 片段: ${pageContextHtml.substring(0, 1000)}... (已截断)。

      请返回一个结构化的 JSON 对象，代表一个测试步骤。
      'action' 必须是以下之一: 'click', 'input', 'extract', 'navigate', 'wait'。
      提供基于最佳实践 (id > data-testid > class) 的精确 CSS 选择器。
      如果可能，提供语义选择器 (aria-label, text content)。
      'description' 字段请使用中文描述该元素。
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
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
                params: { type: Type.OBJECT }
            }
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    throw new Error("No response text");

  } catch (error) {
    console.error("Gemini Intent Parse Error:", error);
    // Fallback
    return {
      intent: intent,
      action: 'wait',
      type: 'custom' as any,
      status: 'pending'
    } as any;
  }
};

export const generateTestScript = async (
  steps: Step[],
  mode: ScriptMode
): Promise<string> => {
  if (!apiKey) return "// API Key 缺失。生成了模拟脚本。\n// 请在环境中配置有效的 API_KEY。\n\nimport { test } from '@playwright/test';\n\ntest('Mock Test', async ({ page }) => {\n  // 这是一个模拟文件\n});";

  const stepsJson = JSON.stringify(steps.map(s => ({
    intent: s.intent,
    action: s.action,
    selector: s.target?.selectors?.precise,
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

  const prompt = `
    根据以下测试步骤生成一个完整、可运行的测试文件 (.spec.ts):
    ${stepsJson}

    请直接输出代码内容，不要包裹在 markdown 代码块中。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction
      }
    });

    return response.text || "// 生成脚本失败，AI 未返回内容";
  } catch (error) {
    console.error("Gemini Script Gen Error:", error);
    return `// 生成脚本出错。\n// 错误信息: ${error}`;
  }
};