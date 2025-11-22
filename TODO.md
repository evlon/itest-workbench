## v0.3.0 2025-11-22
- [x] 键盘录制功能 (#101)
  - 任务拆分：
    - 设计键盘事件监听（keydown/keyup）与修饰键采集
    - 将事件流保存为录制日志（含时间戳）
    - 在“实时预览”工具栏添加录制开关与“播放录制”按钮
    - 代理服务新增 `/action/keypress` 接口支持 `press/type`
  - 技术规格：
    - 监听范围：`window`，事件结构 `{type,key,ctrl,alt,shift,meta,t}`
    - 存储：`App` 层 `keyLog: Array<KeyEvent>`；步骤生成 `action: 'keypress'`
    - 回放：顺序读取 `keyLog` 的 `down` 事件，逐一调用代理 `keypress(type:'press')`
    - UI：`BrowserPreview` 顶部按钮，状态栏提示“键盘录制已开启”
    - 兼容性：使用标准键值与修饰键，支持 Windows/macOS/Linux
  - 验收标准：
    - 开启录制后，连续按键会实时生成步骤，含修饰键信息
    - 点击“播放录制”可在远程页面复现键入行为
    - 录制状态清晰可见，关闭后不再记录事件
  - 测试方案：
    - 手动：在测试页 `input[name="q"]` 中录制并回放输入；验证最终值
    - 自动：对 `/action/keypress` 发起模拟请求，断言日志与截图事件发送

- [x] CTRL/⌘+单击唤起上下文菜单扩展 (#102)
  - 任务拆分：
    - 按钮/链接/输入框类型识别与菜单项动态呈现
    - 新增“自定义操作”项并生成可编辑步骤
  - 技术规格：
    - 类型识别基于 `selectors.precise` 的语义猜测
    - 菜单项：点击、输入、断言可见、断言文本、自定义操作
  - 验收标准：
    - 不同元素类型显示对应操作；选择后生成正确步骤
  - 测试方案：
    - 在测试页分别选择按钮/输入/链接，验证菜单与步骤生成

## v0.4.0 2025-11-26
- [ ] 步骤参数化与编辑增强 (#110)
  - 状态：进行中
  - 任务拆分：在编辑面板中配置输入值、断言文本等参数
  - 技术规格：`Step.params` 支持字符串、数字、布尔类型；UI 绑定
  - 验收标准：参数变更影响脚本生成与回放结果
  - 测试方案：编辑后运行步骤，断言页面状态与日志

- [ ] 等待策略与可回放性验证 (#111)
  - 状态：进行中
  - 任务拆分：显式等待与智能等待配置（可在步骤级别开关）
  - 技术规格：断言类步骤使用等待封装；扩展到网络空闲/元素稳定（smart）与失败快照
  - 验收标准：对慢速元素的断言稳定通过
  - 测试方案：构造延迟元素用例，验证成功率

- [x] 智能等待增强 (#112)
  - 任务拆分：实现 `/action/smartwait` 支持 `networkIdle` 与元素稳定；在点击/输入后应用
  - 技术规格：客户端 `smartWait(opts)`；在回放中当 `waitMode='smart'` 时调用，支持 `selector`、`timeoutMs`、`domContentLoaded`、`load`、`visible`、`stability`
  - 验收标准：快速变化页面下回放稳定；无固定延迟与过早执行问题
  - 测试方案：构造连续网络请求与动画变动场景，验证稳定性

- [x] 断言失败快照 (#113)
  - 任务拆分：断言失败返回截图与 DOM 片段；事件中包含简短快照头
  - 技术规格：`/action/assert` 返回 `{ ok, html, rect }` 并广播 `action-complete` 携带 `html_snippet` 与 `rect`；UI 显示高亮框
  - 验收标准：失败场景有可用快照用于分析
  - 测试方案：在错误文本断言场景下查看返回片段

- [x] 参数类型约束与转换 (#114)
  - 任务拆分：编辑面板为输入值添加类型选择与保存时转换
  - 技术规格：`valueType` 支持 string/number/boolean，保存时转换到 `params.value`
  - 验收标准：不同类型在回放时正确生效
  - 测试方案：分别录入三种类型并回放验证

- [x] 统一选择器策略 (#115)
  - 任务拆分：断言、点击与智能等待统一使用同一解析函数
  - 技术规格：统一使用 `getBestStaticSelectorForStep` 作为解析基础
  - 验收标准：相同元素的选择器一致，误判减少
  - 测试方案：在复杂嵌套结构下重复验证

## v0.5.0 2025-12-02
- [x] 快捷键自定义与跨平台映射 (#120)
  - 任务拆分：设置页添加快捷键映射；macOS 与 Windows 差异处理
  - 技术规格：统一内部修饰键模型，持久化到配置
  - 验收标准：不同平台下触发行为一致
  - 测试方案：在 macOS/Windows 下分别验证触发逻辑

- [x] smart 等待子项配置 UI (#116)
  - 任务拆分：在编辑面板中为 smart 等待增加 DOM 完成、资源稳定、XHR 静默、元素可见、元素稳定的可选子项
  - 技术规格：绑定到 `Step.params` 中的 `smartDomContentLoaded/smartLoad/smartNetworkIdle/smartVisible/smartStability`，并在回放调用 `smartWait(opts)` 时生效
  - 验收标准：用户勾选的子项在回放中被执行；默认勾选 XHR 静默与元素稳定，其他子项可按需启用
  - 测试方案：在含网络与动画的页面中切换子项组合，验证回放稳定性

## v0.5.1 2025-12-03（方案B：捕获 popup／新 Page 与切换展示 MVP）
- [ ] 后端：session.pages 数据结构与注册 (#201)
  - 任务拆分：扩展 session 保存 pages Map；实现 registerPage/unregisterPage；首帧截图并广播
  - 技术规格：`session.pages: Map<pageId, { page, id, lastScreenshot, lastHash, meta }>`；事件 `page-opened/page-closed`
  - 验收标准：捕获 `window.open` 或 `_blank` 打开新页并广播 `page-opened`
  - 测试方案：点击 `_blank` 链接与脚本 `window.open`，查看事件与首帧

- [ ] 后端：SSE/WS 事件与分页流 (#202)
  - 任务拆分：SSE 事件携带 `pageId`；WS 支持 `ws?sessionId=&pageId=` 订阅指定页；截图区分页
  - 技术规格：`screenshot(dom-update, log)` 载荷包含 `pageId`；未指定则推送 `activePageId`
  - 验收标准：能接收指定 `pageId` 的画面与 DOM 更新
  - 测试方案：同时打开 2 个 page，订阅不同页的流并验证

- [ ] 后端：popup 检测与快捷注册 (#203)
  - 任务拆分：在 `/action/exec click` 后并发等待 popup/context page 事件并注册
  - 技术规格：`context.waitForEvent('page',{timeout})` 或 `page.waitForEvent('popup')`
  - 验收标准：点击可能打开新页的链接能被捕获并注册
  - 测试方案：对含 `_blank` 的链接点击后验证 `page-opened`

- [ ] 后端：分页 API (#204)
  - 任务拆分：`GET /session/pages` 与 `POST /session/activate { pageId }`
  - 技术规格：返回 pages 元数据（id/url/title/createdAt）；设置 `activePageId` 并广播 `page-activated`
  - 验收标准：切换 active page 成功并开始推送该页画面
  - 测试方案：先打开多个页，再调用 activate 验证切换

- [ ] 前端：Tabs 与通知条 (#205)
  - 任务拆分：在 BrowserPreview 添加 pages Tabs；收到 `page-opened` 显示通知与插入 Tab
  - 技术规格：Tabs 项显示 `title/url` 与活跃标记；通知包含“同页打开/新页打开并切换/新页打开但不切换/取消”
  - 验收标准：新页出现时 UI 有 Tab 与通知；可选择切换
  - 测试方案：点击 `_blank` 链接，验证 Tab 与交互

- [ ] 前端：点击流程与选择策略 (#206)
  - 任务拆分：命中检测返回含 `href/target` 时弹确认；默认不自动切换
  - 技术规格：选“同页打开”调用 `navigate`；选“新页打开并切换/不切换”执行原点击并监听后端事件
  - 验收标准：三种选择生效且会话一致
  - 测试方案：对含 `_blank` 链接逐项选择并验证页面流

- [ ] 权限与操作者标识（初版） (#207)
  - 任务拆分：SSE/WS 连接传 `clientId`；事件载荷标注 `initiatorClientId`
  - 技术规格：后端校验控制请求权限（activate/click/navigate/type），未授权返回 403
  - 验收标准：只有有权客户端可切换 active page 与执行控制操作
  - 测试方案：模拟两个客户端，分别验证权限拦截与允许路径
- [ ] 首次使用引导与录制提示优化 (#121)
  - 任务拆分：选择模式与键盘录制的可视化引导与提示文案
  - 验收标准：首次进入时出现指引，后续可关闭
  - 测试方案：模拟首次启动状态，验证提示呈现与关闭持久化

## v0.6.0 2025-12-10
- [ ] 失败快照与重试机制 (#130)
  - 任务拆分：步骤失败时保存截图与 DOM 片段；提供重试次数与退避
  - 技术规格：在代理端统一产出失败事件与快照；UI 显示附件
  - 验收标准：失败步骤具备快照与可配置重试，成功率可提升
  - 测试方案：构造不稳定点击与断言场景，验证重试效果

## 里程碑与跟踪
- 里程碑：v0.3.0 键盘录制闭环；v0.4.0 参数化与等待；v0.5.0 快捷键配置与引导；v0.6.0 失败处理
- 任务状态：待办/进行中/已完成，通过复选框体现
- 代码审查与验证：每次迭代结束进行代码 Review 与流式预览回归
- 时间节点：预留 20% 回归与测试时间；记录实际完成时间与预估偏差
- [x] smart 等待子项配置 UI (#116)
  - 任务拆分：在编辑面板中为 smart 等待增加 DOM 完成、资源稳定、XHR 静默、元素可见、元素稳定的可选子项
  - 技术规格：绑定到 `Step.params` 中的 `smartDomContentLoaded/smartLoad/smartNetworkIdle/smartVisible/smartStability`，并在回放调用 `smartWait(opts)` 时生效
  - 验收标准：用户勾选的子项在回放中被执行；默认勾选 XHR 静默与元素稳定，其他子项可按需启用
  - 测试方案：在含网络与动画的页面中切换子项组合，验证回放稳定性