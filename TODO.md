# 迭代计划（AI-Powered Test Workbench）

> 本文件用于跟踪与 PRD.md 对齐的迭代任务，采用优先级驱动，所有任务初始状态为【待办】。请在完成后即时更新为【完成】，并记录完成日期与简要说明。

## 执行流程
- 按优先级顺序处理任务（高 → 中 → 低）。
- 完成任一任务后，立刻将状态更新为【完成】，添加完成日期与简要说明。
- 保持格式整洁统一，记录可追溯。

## 质量要求
- 使用 Markdown 标准语法，描述准确无歧义。
- 状态变更记录完整可追溯（含日期与说明）。
- 通过版本控制系统管理本文件并参与代码评审流程。

## 定期检查
- 每周回顾迭代进度，调整未完成任务的优先级。
- 保持本文件状态为最新。

---

## 迭代任务

### 任务 1：安全与端口/环境对齐（里程碑 0）
- 详细需求说明：
  - 将前端开发端口改为 `5173`（避免与本地代理 `3000` 冲突）。
  - 移除将 `process.env` 整体注入到浏览器的逻辑，改用 `import.meta.env` 且仅暴露非敏感配置。
  - 统一环境变量策略：采用 `MODEL_NAME=<provider>/<model>`（如 `openai/gpt-4o`、`gemini/gemini-1.5-flash`），并在 Agent 侧管理 `OPENAI_API_KEY`、`GOOGLE_GENERATIVE_AI_API_KEY`/`GEMINI_API_KEY`。
  - 修复元素数据结构不匹配问题：`BrowserPreview` 返回 `StepTarget` 结构（`description`、`selectors.precise`），与 `ActionMenu`、`App.tsx` 保持一致。
  - UI 缺失密钥提示逻辑修正：依据正确变量显示演示模式提示。
- 预计完成时间：2025-11-23（2 天）
- 优先级标记：高
- 状态：【完成】（完成日期：2025-11-21）
- 简要说明：前端端口改为 5173；移除 Vite 全量注入 `process.env`；`App` 使用 `import.meta.env` 检测密钥；`BrowserPreview` 返回 `StepTarget` 结构；`aiService` 切换至 `import.meta.env` 并规范变量命名。

### 任务 2：实现本地代理与通信协议（里程碑 1）
- 详细需求说明：
  - 新增 Node.js Agent 服务，提供 REST 控制面端点：`/session/start`、`/session/stop`、`/action/act`、`/action/exec`、`/action/observe`、`/config/model`。
  - 实现 SSE 数据面：`/events?sessionId=...`，事件类型包含 `log`、`dom-update`、`screenshot`、`action-complete`、`error`。
  - 心跳与保活：Agent 每 5 秒发送 `ping`；UI 超过 15 秒未收到提示断开。
  - LLM 密钥与模型配置仅在 Agent 管理；支持 `.env` 与 `stagehand.config.js` 插件化。
- 预计完成时间：2025-11-28（5 天）
- 优先级标记：高
- 状态：【完成】（完成日期：2025-11-21）
- 简要说明：新增 `agent/server.js`，实现 REST `/session/start`、`/session/stop`、`/action/act`、`/action/exec`、`/action/observe`、`/config/model`，以及 SSE `/events` 与 5 秒心跳；新增脚本 `pnpm run agent` 完成启动与验证。

### 任务 3：前端联通与实时预览（里程碑 2）
- 详细需求说明：
  - `aiService` 改为调用 Agent（移除浏览器直接调用 LLM）。
  - `BrowserPreview` 渲染来自 SSE 的截图与 DOM 片段；检查模式通过 `/action/observe` 获取元素并生成 `StepTarget`。
  - 步骤级回放：`handleRunStep` 调用 `/action/exec`/`/action/act`，并在 SSE 回填后更新状态、附带截图与 DOM 差异。
- 预计完成时间：2025-12-02（4 天）
- 优先级标记：高
- 状态：【完成】（完成日期：2025-11-21）
- 简要说明：新增 `services/agentClient.ts` 封装 REST/SSE；`App.tsx` 启动会话并订阅事件，替换本地 mock 的步骤执行与元素选择逻辑；`BrowserPreview` 支持显示 SSE 截图并与检查模式协同。

### 任务 4：选择器优化管道（里程碑 3）
- 详细需求说明：
  - 构建选择器清洗：移除随机 ID 与不稳定类名（如 Tailwind）。
  - 语义化重命名：基于上下文将元素命名为可读标识（如 `submitBtn`）。
  - 生成多维定位器：组合 `css + xpath + text`，并定义选择器优先级（id > data-testid > aria-label/text > class）。
  - 在静态模式代码生成前应用优化管道及回退策略。
- 预计完成时间：2025-12-06（4 天）
- 优先级标记：高
- 状态：【完成】（完成日期：2025-11-21）
- 简要说明：新增 `services/selectorRefiner.ts` 完成清洗随机 ID/Tailwind 类名、生成 XPath/text 维度、定义静态模式选择器优先级（id > data-testid > aria-label > text > refined css），并接入 `aiService.generateTestScript` 与 `parseIntentToStep` 的精炼流程。

### 任务 5：交互式录制增强（里程碑 4）
- 详细需求说明：
  - 在 Live View 注入拾取器与操作菜单（点击元素后弹出）。
  - 通过 AI 增强建议：依据元素上下文提供断言/提取建议（如价格进行数值断言）。
  - 支持快捷键与多选录制、自动参数捕获（输入值、目标 URL）。
- 预计完成时间：2025-12-11（5 天）
- 优先级标记：中
- 状态：【完成】（完成日期：2025-11-21）
- 简要说明：在检查模式下点击实时预览直接弹出操作选择菜单，选择后自动记录步骤并执行（代理推送截图与完成事件）；静态模式执行改为使用“最优选择器”策略。

### 任务 6：公共库（组件参数化与引用更新，里程碑 5）
- 详细需求说明：
  - 允许选中步骤提取为组件，并进行参数化（如用户名、密码、搜索关键词）。
  - 当组件更新时，提示或自动同步所有引用的测试用例。
  - 组件持久化与版本化；在 Code View 可展开预览组件内容。
- 预计完成时间：2025-12-17（6 天）
- 优先级标记：中
- 状态：【待办】

### 任务 7：脚本导出与依赖（里程碑 6）
- 详细需求说明：
  - 完成“导出脚本”按钮绑定，支持下载 `.spec.ts` 文件。
  - 依赖与运行：按模式选择安装 `@playwright/test` 或 `@browserbasehq/stagehand`、`vitest`，并提供最小运行脚本与示例。
  - 统一使用 `pnpm` 进行依赖管理与脚本执行。
- 预计完成时间：2025-12-20（3 天）
- 优先级标记：低
- 状态：【待办】

### 任务 8：测试与质量保障（里程碑 7）
- 详细需求说明：
  - 引入单元与集成测试，覆盖：协议端点、SSE 事件流、选择器管道、录制器、公共库。
  - 配置 CI：执行 `pnpm install`、构建与测试；生成代码的基本场景可本地跑通。
  - 静态检查与类型检查流程（lint/typecheck）。
- 预计完成时间：2025-12-25（5 天）
- 优先级标记：低
- 状态：【待办】

---

## 变更记录（示例模板，完成后填写）
- 任务 X：状态由【待办】→【完成】（完成日期：YYYY-MM-DD）
  - 简要说明：
  - 关联 PR/提交：