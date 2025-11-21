# **智能测试工作台 (AI-Powered Test Workbench) 系统设计方案**

## **1\. 系统概述**

本工作台旨在通过 AI 和 Stagehand (SH) 技术，打造一个“低代码、高智能、自愈合”的端到端测试脚本生成与管理平台。核心目标是解决传统自动化测试中“选择器易碎”和“编写成本高”的两大痛点。

## **2\. 系统架构设计**

系统分为三层：**交互层 (Workbench UI)**、**核心引擎层 (Core Engine)**、**执行环境层 (Runtime)**。

### **2.1 交互层 (Workbench UI)**

* **编排画布 (Canvas)**: 可视化展示测试步骤流（Flowchart 或 列表模式）。  
* **实时预览 (Live View)**: 内嵌浏览器或远程桌面流，实时显示目标测试页面。  
* **代码编辑器 (Code View)**: 双向绑定，可视化步骤变更实时映射为 Vitest 代码。  
* **公共库面板 (Library)**: 管理复用组件和自定义指令。

### **2.2 核心引擎层 (Core Engine)**

* **意图解析器 (Intent Parser)**: 将自然语言转译为 Stagehand 指令。  
* **选择器工厂 (Selector Factory)**:  
  * 处理 sh.observe 返回的数据。  
  * 生成策略：ID优先 \> 语义属性(aria-label) \> 相对路径 \> AI 模糊匹配。  
* **脚本生成器 (Script Generator)**: 将中间态数据 (JSON) 编译为 Vitest/TypeScript 可执行文件。

### **2.3 执行环境层 (Runtime)**

* **浏览器实例 (Browser Instance)**: 托管 Stagehand 和 Playwright/Puppeteer。  
* **调试探针 (Debug Probe)**: 用于录制时的事件捕获和回放时的断点控制。

## **3\. 核心功能模块详解 (按操作闭环)**

### **3.1 脚本生产阶段 (Input & Generation)**

#### **A. 意图规划与策略配置 (Intent & Strategy)**

用户输入自然语言（如：“搜索 iPhone”），系统首先调用 sh.observe 获取当前页面状态，但在生成最终脚本时，根据**全局策略 (Global Strategy)** 决定代码形态：

* 全局策略配置 (Script-Level Configuration):  
  用户在创建测试套件或导出时，选择通过以下两种模式之一生成脚本：  
  1. **标准静态模式 (Standard Mode \- Zero Runtime AI)**  
     * **机制**: AI 仅在**设计阶段**介入。工作台利用 sh.observe 找到目标元素，提取出最优的静态选择器（CSS/XPath）。  
     * **生成代码**: 纯 Playwright 代码，例如 await page.locator('\#search-btn').click()。  
     * **场景**: CI/CD 高频运行，追求极致速度和零额外成本，页面结构相对稳定。  
  2. **AI 动态模式 (Stagehand Mode \- Runtime AI)**  
     * **机制**: AI 在**运行阶段**介入。保留用户的自然语言意图，依赖 Stagehand 的运行时解析和缓存。  
     * **生成代码**: Stagehand 代码，例如 await page.act('点击搜索按钮') 或 await page.extract(...)。  
     * **优势**: 利用 SH 缓存机制（对相同 DOM 结构的意图解析进行缓存），速度在可接受范围，具备极强的抗变动能力。

#### **B. 模版引擎 (Template System)**

基于 Stagehand 能力封装的高级原子操作库：

* **参数自动补全机制**:  
  * 当用户选择“表单输入”模版，系统自动分析当前页面 DOM。  
  * **高亮提示**: 在右侧预览窗口高亮所有 Input 框，用户点击即可自动回填 Selector 参数。  
* **模版分类**:  
  * *基础类*: 导航、点击、输入、按键。  
  * *验证类*: sh.extract (提取数据用于断言)、视觉回归对比。  
  * *AI 类*: sh.act (模糊操作)、sh.observe (页面状态检查)。  
  * *环境类*: Cookie 注入、UserAgent 模拟、视口调整。

#### **C. 交互式录制 (Interactive Recording)**

* **DOM 监听器**: 在目标页面注入 JS SDK，监听 click, input, change 事件。  
* **元素拾取器 (Picker)**:  
  * 用户在预览区悬停元素，按热键（如 Cmd+Click）。  
  * 弹出**操作菜单 (Action Menu)**: “点击”、“输入”、“等待出现”、“断言文本内容”、“断言元素存在”。  
  * **AI 增强建议**: 点击一个价格标签，AI 自动建议“提取价格并转为数字”或“验证价格大于 0”。

### **3.2 步骤加工与复用 (Refinement & Reuse)**

#### **D. 智能选择器优化 (Selector Refinement)**

针对 sh.observe 返回的原始 Selector 可能过长或包含随机 ID 的问题（主要服务于“标准静态模式”）：

* **清洗管道**: 移除 Tailwind 动态类名、随机 Hash ID。  
* **语义化重命名**: 如果 sh.observe 识别出这是 "Submit Button"，变量名自动命名为 btnSubmit 而非 button\_div\_01。  
* **多维定位**: 生成的代码同时包含 css, xpath, 和 text 特征，运行时按优先级匹配。

#### **E. 公共库 (Shared Library)**

* **提取组件**: 允许选中多个步骤（如登录流程），右键“提取为公共组件”。  
* **参数化**: 自动识别组件内的动态值（如用户名、密码），转化为函数参数 login(username, password)。  
* **引用更新**: 公共库修改后，所有引用的测试用例自动获得更新提示。

### **3.3 执行与验证 (Execution & Debugging)**

#### **F. 步骤级回放 (Step-by-Step Replay)**

* **单步执行**: 就像 IDE 调试一样，点击“运行当前步”，工作台调用 SH 执行该操作。  
* **快照对比**: 每一步执行后，自动截取 DOM 快照和屏幕截图，用于失败回溯。

#### **G. 脚本生成与导出 (Export)**

根据全局策略生成不同的 Vitest 结构：

* **若选择 AI 动态模式**:  
  * 自动注入 import { stagehand }。  
  * 测试体使用 await page.act(...), await page.extract(...)。  
  * 配置中包含缓存路径设置，确保 SH 缓存生效。  
* **若选择标准静态模式**:  
  * 生成标准的 Playwright import { test, expect }。  
  * 测试体使用 page.locator(...)。  
  * **不包含**任何 SH 运行时依赖，确保无 Token 消耗。

## **4\. 系统交互流程图 (用户故事)**

1. **初始化**: 用户打开工作台，输入目标 URL，点击“启动会话”。  
2. **探索与编写**:  
   * *场景 A*: 用户在预览区点击“登录”按钮 \-\> 选择“点击” \-\> 步骤栏增加“点击登录”。  
   * *场景 B*: 用户在输入框打字“帮我验证页面上是否有‘库存不足’的提示” \-\> 点击“智能转写” \-\> 系统调用 sh.extract 生成断言代码。  
3. **导出配置**:  
   * 用户点击“生成脚本”。  
   * 系统提示选择策略：**\[ 仅静态 Playwright \]** 或 **\[ Stagehand AI 增强 \]**。  
   * 用户选择“Stagehand AI 增强”以应对频繁变动的 UI。  
4. **生成脚本**: 系统生成包含 act 指令的 .spec.ts 文件。

## **5\. 关键技术挑战与解决方案**

| 挑战点 | 解决方案 |
| :---- | :---- |
| **页面动态变化 (Flakiness)** | **AI 模式兜底**: 在“标准模式”下，如果选择器失效，提供“一键修复”功能（回工作台用 AI 重新 Observe）；在“AI 模式”下，天然抗变动。 |
| **响应速度与成本** | **Stagehand 缓存机制**: 充分利用 SH 的 DOM 缓存。对于已解析过的页面结构，act 指令直接命中缓存，跳过 LLM 推理，实现毫秒级响应。 |
| **复杂断言 (Assertions)** | **数据结构化**: 利用 sh.extract 将非结构化页面内容转为 JSON 对象，然后使用 Chai/Jest 对 JSON 字段进行断言，而非断言 DOM 文本。 |

## **6\. 推荐的数据结构 (JSON Schema for Steps)**

工作台内部维护的步骤数据结构示例（包含双轨数据）：

{  
  "id": "step\_001",  
  "type": "interaction",  
  "intent": "Click the Login button", // AI 模式使用的自然语言  
  "action": "click",  
  "target": {  
    "description": "Login Button",  
    "selectors": {  
      "precise": "\#app \> div \> button.submit-btn", // 标准模式使用的选择器  
      "semantic": "button\[aria-label='Log in'\]"  
    }  
  },  
  "params": {},  
  "config": {  
    "forceAI": false // 可选：允许单个步骤强制覆盖全局策略  
  }  
}

## **7\. 总结**

本工作台通过将 Stagehand 的 AI 观察能力与传统测试录制相结合，提供了灵活的**双模构建策略**。用户既可以选择利用 SH 缓存机制的 AI 动态执行模式，也可以生成传统的静态脚本，从而平衡了稳定性、成本和执行效率。