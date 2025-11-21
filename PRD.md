# **智能测试工作台 (AI-Powered Test Workbench) 系统设计方案**

## **1\. 系统概述**

本工作台旨在通过 AI 和 Stagehand (SH) 技术，打造一个“低代码、高智能、自愈合”的端到端测试脚本生成与管理平台。核心目标是解决传统自动化测试中“选择器易碎”和“编写成本高”的两大痛点。

## **2\. 系统架构设计**

系统采用 **B/S (Browser/Server) 分离架构**，但 Server 端运行在用户本地，通过标准协议通讯。

### **2.1 交互层 (Workbench Web UI)**

运行在浏览器中的前端应用：

* **编排画布 (Canvas)**: 可视化展示测试步骤流。  
* **实时预览 (Live View)**: 渲染从本地传回的 DOM 快照或视频流。  
* **代码编辑器 (Code View)**: 生成 Vitest 代码。

### **2.2 核心引擎层 (Local Bridge Agent)**

运行在用户本地终端的 Node.js 服务（如 npx stagehand-bridge）：

* **HTTP Server**: 接收前端指令。  
* **SSE Emitter**: 通过 Server-Sent Events 推送实时状态。  
* **Stagehand Host**: 实际托管 Playwright 浏览器实例。  
* **LLM Client Manager**: 统一管理大模型连接，支持多 Provider 切换与密钥管理。

### **2.3 执行环境层 (Runtime)**

* **Headless/Headed Browser**: 由本地代理控制的 Chrome/Chromium 实例。

## **3\. 核心功能模块详解 (按操作闭环)**

### **3.1 脚本生产阶段 (Input & Generation)**

#### **A. 意图规划与策略配置 (Intent & Strategy)**

用户输入自然语言（如：“搜索 iPhone”），系统首先调用 sh.observe 获取当前页面状态，但在生成最终脚本时，根据**全局策略 (Global Strategy)** 决定代码形态：

* 全局策略配置 (Script-Level Configuration):  
  用户在创建测试套件或导出时，选择通过以下两种模式之一生成脚本：  
  1. **标准静态模式 (Standard Mode \- Zero Runtime AI)**  
     * **机制**: AI 仅在**设计阶段**介入。利用 sh.observe 提取最优静态选择器（CSS/XPath）。  
     * **生成代码**: 纯 Playwright 代码，例如 await page.locator('\#search-btn').click()。  
     * **场景**: CI/CD 高频运行，追求极致速度。  
  2. **AI 动态模式 (Stagehand Mode \- Runtime AI)**  
     * **机制**: AI 在**运行阶段**介入。依赖 Stagehand 的运行时解析和缓存。  
     * **生成代码**: Stagehand 代码，例如 await page.act('点击搜索按钮')。  
     * **优势**: 利用 SH 缓存机制，抗变动能力强。

#### **B. 模版引擎 (Template System)**

* **参数自动补全机制**: 自动分析 DOM，高亮提示 Input 框，点击回填 Selector。  
* **模版分类**: 基础类、验证类、AI 类、环境类。

#### **C. 交互式录制 (Interactive Recording)**

* **DOM 监听器**: 注入 JS SDK，监听用户在预览区的操作。  
* **元素拾取器**: 悬停元素 \-\> 操作菜单 \-\> AI 增强建议。

### **3.2 步骤加工与复用 (Refinement & Reuse)**

#### **D. 智能选择器优化 (Selector Refinement)**

* **清洗管道**: 移除随机 ID 和 Tailwind 类名。  
* **语义化重命名**: 自动将 div\_01 重命名为 submitBtn。  
* **多维定位**: 生成 css \+ xpath \+ text 组合定位器。

#### **E. 公共库 (Shared Library)**

* **提取组件**: 将多个步骤封装为可复用组件。  
* **参数化**: 自动识别动态值并转化为参数。

### **3.3 执行与验证 (Execution & Debugging)**

#### **F. 步骤级回放**

* **单步执行**: IDE 式调试，调用本地代理执行单步。  
* **快照对比**: 每次执行后，通过 SSE 返回截图和 DOM 树。

#### **G. 脚本生成与导出**

* **AI 动态模式**: 注入 import { stagehand }。  
* **标准静态模式**: 生成纯 Playwright 代码。

## **4\. 本地通信协议标准 (Local Bridge Protocol)**

为了解耦 UI 和执行环境，定义以下标准通信协议。前端通过 REST API 发送指令，通过 SSE 接收执行反馈。

### **4.1 连接建立**

* **Agent 启动**: 用户在终端运行 npx stagehand-bridge start。  
* **参数配置**: 支持通过 CLI 参数或环境变量指定模型配置。  
  \# 示例：使用 GPT-4o  
  npx stagehand-bridge start \--port 3000 \--model openai/gpt-4o

  \# 示例：使用 Gemini Flash  
  npx stagehand-bridge start \--model gemini/gemini-1.5-flash

* **UI 连接**: 前端连接 http://localhost:3000。

### **4.2 REST API (控制平面 \- Control Plane)**

用于发送控制指令，均为 POST 请求。

| Endpoint | 用途 | Payload 示例 | Response |
| :---- | :---- | :---- | :---- |
| /session/start | 启动浏览器会话 | { "url": "https://google.com", "headless": false } | { "sessionId": "uuid" } |
| /session/stop | 关闭会话 | { "sessionId": "uuid" } | { "status": "ok" } |
| /action/act | 执行 AI 操作 | { "action": "click login", "strategy": "ai" } | { "status": "processing" } |
| /action/exec | 执行静态操作 | { "selector": "\#btn", "method": "click" } | { "status": "processing" } |
| /action/observe | 获取页面元素 | { "instruction": "find inputs" } | { "elements": \[...\] } |
| /config/model | 获取当前模型配置 | {} | { "provider": "openai", "model": "gpt-4o" } |

### **4.3 EventSource 流 (数据平面 \- Data Plane)**

前端监听 /events?sessionId={uuid}，实现实时反馈。

**事件格式:**

event: \<EventType\>  
data: \<JSON Payload\>

**定义事件类型 (EventType):**

1. **log (日志)**:  
   * 用于控制台输出流。  
   * data: { "level": "info", "message": "Navigating to URL...", "timestamp": 123456 }  
2. **dom-update (结构更新)**:  
   * 当页面加载或 DOM 变化时触发，用于更新 Picker。  
   * data: { "html\_snippet": "...", "interactive\_elements": \[...\] }  
3. **screenshot (视觉反馈)**:  
   * 每步操作后触发，或流式传输（如果带宽允许）。  
   * data: { "base64": "iVBORw0KGgo...", "timestamp": 123456 }  
4. **action-complete (操作完成)**:  
   * 异步操作结束信号。  
   * data: { "status": "success", "result": { "extracted\_data": {...} } }  
5. **error (错误)**:  
   * 执行异常。  
   * data: { "code": "ELEMENT\_NOT\_FOUND", "message": "...", "suggestion": "Try using AI act mode" }

### **4.4 心跳与保活**

* Agent 每 5 秒发送一次 ping 事件。  
* UI 若 15 秒未收到，提示用户“本地代理断开”。

### **4.5 模型配置与扩展 (LLM Configuration & Extension)**

本地代理全权管理 LLM 的连接与凭证，确保 API Key 不会泄露到前端。

#### **A. 配置格式**

遵循 \<provider\>/\<modelname\> 的命名规范：

* **OpenAI**: openai/gpt-4o, openai/gpt-3.5-turbo  
* **Google**: gemini/gemini-1.5-flash, gemini/gemini-pro  
* **Anthropic**: anthropic/claude-3-opus  
* **Local/Custom**: custom/llama3-local

#### **B. 凭证管理**

支持通过 .env 文件或系统环境变量加载 API Keys。

\# .env file  
OPENAI\_API\_KEY=sk-...  
ANTHROPIC\_API\_KEY=sk-ant-...  
GOOGLE\_GENERATIVE\_AI\_API\_KEY=...

#### **C. 用户扩展机制**

为了支持私有部署或新模型，Server 端应设计为插件化架构：

1. **Model Adapter Interface**: 定义标准的 generate 和 embed 接口。  
2. **Custom Config**: 允许用户在 stagehand.config.js 中注册新的 Provider。

// stagehand.config.js  
module.exports \= {  
  customProviders: {  
    'my-local-llm': {  
      endpoint: 'http://localhost:11434/v1',  
      adapter: 'openai-compatible' // 复用现有的 adapter 逻辑  
    }  
  }  
}  
// 使用方式: npx stagehand-bridge start \--model my-local-llm/llama3

## **5\. 系统交互流程图 (通信视角)**

1. **启动**: 用户终端运行 Agent \-\> Agent 读取 .env 和 CLI 参数配置 LLM。  
2. **连接**: 浏览器 UI 建立 new EventSource('/events') 连接。  
3. **指令下发**:  
   * 用户点击“打开百度”。  
   * UI 发送 POST /session/act { "action": "navigate to baidu.com" }。  
4. **执行与反馈**:  
   * Agent 收到请求，调用 Stagehand API (使用启动时配置的模型)。  
   * Agent 推送 SSE 事件 log: "正在跳转..."。  
   * Stagehand 完成跳转。  
   * Agent 推送 SSE 事件 screenshot: (Base64 图片)。  
   * Agent 推送 SSE 事件 dom-update: (当前页面元素列表)。  
   * Agent 推送 SSE 事件 action-complete: "跳转成功"。  
5. **渲染**: UI 根据 SSE 数据更新画布和预览区。

## **6\. 关键技术挑战与解决方案**

| 挑战点 | 解决方案 |
| :---- | :---- |
| **DOM 数据量过大** | **按需传输**: observe 接口不返回完整 HTML，只返回精简后的 AOM (Accessibility Object Model) 或压缩后的 JSON Tree。 |
| **截图延迟** | **差异更新**: 仅在操作结束后发送高清截图，操作过程中可发送低质量 JPEG 或仅发送 Logs。 |
| **本地环境差异** | **Docker封装**: 提供标准化的 Docker 镜像 stagehand-bridge:latest，屏蔽 OS 差异。 |

## **7\. 总结**

引入 **本地通信协议标准 (Section 4\)** 后，工作台实现了 UI（轻量级、Web化）与执行核心（高性能、本地化）的完美解耦。EventSource 机制确保了用户能获得如同本地 IDE 般的实时反馈体验，同时支持 Stagehand 在 Node.js 环境中的完整能力。