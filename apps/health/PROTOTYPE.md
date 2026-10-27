# ALOHA Health · UX 体验原型

> 仅供体验和评审。所有启动数据均为虚构示例；新增内容只保存在当前页面内存中，刷新即恢复。不接入 LifeSpace、真实 AI 或任何健康数据接口。

## 体验目标

使用 ALOHA 统一视觉语言，让普通用户以“健康问题、指标、记录、资料和方案”为入口完成一系列具体操作，而不是在首页查看一组静态卡片。

## 从用户旅程推进交互（2026-10-27）

**本轮权威 UX 文档：** [JOURNEYS.md](./JOURNEYS.md)。以用户结果为导向的六条主路径：快速记录、持续健康关注、指标趋势、报告整理、方案管理、时间线回顾。

- 每个页面只提供一个与当前上下文相关的主要新增操作：Body Tab 顶部自动切换；首页/时间线使用相同三类型记录菜单；身体概览改为人体图，其页级操作是添加健康问题。
- 移除时间线「记一件事」与并排「测量／事件／评估」重复按钮，也移除原先通用的「添加记录」；搜索区只负责查询。
- 保存后首先展示新记录详情，返回恢复发起操作的首页、关注事项、指标或列表。嵌套来源/证据链接继续使用同一返回栈。
- 资料流程选择虚构文件名→核对独立模拟提取→确认→资料详情可查看关联观测/事件；报告内容从未被读取或上传。
- 保留 HealthConcern 专题内不同对象的明确快捷动作，因为它们代表不同用户目标，不是复制同一个按钮。
- 手机/桌面统一的 `HealthPageHeader`、ALOHA Token、Lucide、表单抽屉和右侧常驻 Health Agent 均继续沿用。

## 身体概览：人体图而非第二个首页（2026-10-27）

- **明确分工**：应用首页负责今天的重点、最近变化、行动和快速记录；身体·概览负责身体部位的空间导航，不重复首页指标卡、方案任务和最近记录。
- **主界面**：使用参考线稿风格的原创 SVG 无性别正面人体轮廓；只用深色细线、透明填充，不描绘内部器官、肌肉或性别特征。头颈、胸部、腹部、上肢及下肢以小圆形标记表示关联问题数量，未标记不代表健康正常。
- **交互顺序**：点选身体部位 → 右侧卡片列出该部位关联的健康问题 → 用户选择 HealthConcern → 问题详情 → 查看相关测量、资料、事件、评估和方案。如果多个 Concern 位于同一部位，先列出全部供选择。
- **右侧关键卡片**：① 所选部位的 HealthConcern 列表（打开详情）；② 其他有关注事项的部位快捷切换（避免重复统计）；③ 未指定位置的健康问题及人工标记。宽屏可用内容达到约 51rem 时人体图在左、卡片在右；若打开右侧 AI 后内容宽度仍允许，继续双栏；空间不足自动纵向堆叠。手机始终图上卡下，布局由 CSS Container Query 判断可用内容宽度，而不是仅根据 Agent 的开关或浏览器宽度。
- **权威边界**：LifeSpace HealthConcern、HealthObservation 等 canonical records 不添加 `bodyRegion` 属性。新的 `body-map.ts` 只表达 ALOHA 应用侧 BodyMapRegion/BodyMapBinding 的演示投影，初始关联均为虚构例子；不是诊断、严重程度或数据授权依据。
- **本期新增操作**：身体概览页唯一页级新增操作为「添加健康问题」；首页保留“快速记录”，指标/资料/时间线等 Tab 仍按 `JOURNEYS.md` 的唯一主动作策略执行。

## Mobile 顶部、滚动及表单一致性验收（2026-10-27）

- **顶部排布：** 统一 `HealthPageHeader.vue` 负责移动端 ALOHA Hub、当前标题、主要操作与 Lucide AI 入口，**始终单行**；手机隐藏冗余副标题，AI 用图标按钮保留可访问名称。标题过长时用省略号，不能挤出第二行按钮。
- **滚动：** Desktop 与 Mobile 的正文正常滚动；唯一紧凑工具栏采用 `position: sticky`。**在页面顶端工具栏背景透明，与内容画布融为一体；滚动超过 8px 后才显示基于 Canvas Token 的轻磨砂背景和细分隔线**，避免在淡色渐变画布上出现突兀的白色矩形。底部主导航和独立 Agent 面板继续保持可操作。
- **抽屉轮廓：** Desktop 右侧表单 Drawer 为直角边缘；Mobile/窄平板底部表单和 AI 停靠栏使用一致的顶部双圆角，带自身滚动区；普通表单仍带遮罩，AI 始终非模态。
- **下拉框：** 所有 Health `select` 使用统一的 Lucide ChevronDown 图形、`appearance:none` 和不小于 2.85rem 的右侧文本空间；在 iOS Safari、Android Chrome、Desktop Chrome 验证箭头不贴边、长文本不覆盖箭头。
- **必填标志：** 必填号包在和字段名同一行的 `field-label` 内，保持正确视觉对齐；这是之前 `label` 纵向 Flex 把子元素 `*` 排成另一行的根因，不允许在新表单中再直接放裸 `<span>*</span>`。
- **回归场景：** 375px、430px、768px、1024px、1440px 五个宽度，检查首页/身体指标/健康问题详情、含下拉框的测量新增抽屉、AI 打开后的空间与滚动。此项需在重新部署 Preview 后人工验收，不能仅凭 CI 宣称视觉已通过。

## 统一页面密度与字体（2026-10-27）

- 所有 Health 页面共享 `apps/health/src/components/HealthPageHeader.vue`。首页、身体页、所有七模型详情，以及饮食/运动一级入口统一使用**同一个标题 / 返回 / 页面操作 / AI 按钮结构**；不再在每页创建自己的 Header。
- 以“身体健康”为例：标题保持约 22px，下面只有简短的一行说明；页内导航紧贴标题区。移除此前冗长的“从记录到理解”大标题段落，减少顶部空白，尽快露出搜索与实际记录。
- 跨应用字体角色在 `packages/design-tokens/tokens.css`，包含辅助说明、控件、正文、模块标题、页面标题与关键数字的固定层级，规范见 `docs/design-system.md`。
- Health 通过 `apps/health/src/tokens.css` 映射上述全局角色及列表高度、卡片间距和页面节奏；`apps/health/src/ui-system.css` 把同一套规则应用于所有列表、卡片、指标、表单和子导航，而不是各个页面私有缩放。
- 现有 `style.css` 仍负责页面布局、抽屉和响应式分栏；UI System 文件作为统一字号/间距表现层。Hub 中的舒适/紧凑只更改密度 Token，不破坏核心字号和触控目标。
- Health 原型的字体/密度体系已经实现，但其他 PWA 是否采用相同页面组件，应由各自实际 UX 验证决定；全局字体 Token 会自动可供所有 Surface 使用。
- 此轮不包含真实生命体征或个人健康记录，仍为可公开的虚构演示数据。

## 统一导航和 ALOHA 公共入口（2026-10-27）

1. **可折叠的左侧导航**：桌面侧栏有完整文字导航与仅图标窄栏两种状态，可即时切换；图标模式提供 tooltip / accessible label，内容区和常驻 Agent 会随侧栏宽度自动调整。窄屏使用底部导航，不强行显示桌面窄栏。
2. **标题与操作合并**：移除在桌面内容区上方另起一层的固定 Health Header。每个页面的唯一标题区同时包含当前页面名称、页面相关的新增/修改/删除操作，以及始终可用的“问问 Health”入口；在详情页也不引入重复品牌标题。Agent 会话仍独立于页面路由。
3. **唯一 ALOHA 公共入口**：只有左侧顶部 ALOHA（移动端放在当前页标题中）打开统一的应用 / 账号 / 设置菜单，内容区不再复制同一个应用切换按钮。
4. **公共入口的初始内容**：应用切换（Assistant / Health / Finance / Things）、账号与安全（个人资料、登录方式及设备）、隐私与授权（应用及人员数据授权）、通用设置（外观和语言、通知与提醒、实际可交互的“舒适 / 紧凑”页面密度）、帮助与反馈（帮助、关于）。除当前 Health 和页面密度外，原型对尚未接入的功能明确标记，不创建假链接或假登录态。
5. **可复用性策略**：公共菜单实现为可通过 `currentApp`、`apps`、`density`、`preview` 配置的 AlohaHub Vue 组件，目前先由 Health 使用，放在 `apps/health/src/components/AlohaHub.vue`。按仓库 `packages/ui/AGENTS.md`，只有第二个真实应用消费且交互契约稳定后，才将其提升到 `@aloha/ui` 共享包；不为了展示“共享”去污染其它应用空骨架。
6. **当前状态**：只是本地无身份的 UX 原型，公共账号/授权/通知不会执行真实操作。真实项目应复用 LifeSpace Identity、Space/Grant 和 ALOHA 公共配置，不在 Health 内自建独立账户系统。

## Health Agent 的双栏协作体验（2026-10-27）

- 桌面端打开「问问 Health」后，从右侧展开**非模态**对话工作区。左侧原有导航、页面内容和数据操作继续可见、可点击；聊天面板独立滚动，不覆盖主页面，也没有全屏灰色遮罩。
- 用户浏览首页、身体、指标或某条健康问题时，聊天记录、输入中的草稿和打开状态保持不变。提问时会将当时的页面名称记录为演示上下文；后续换页只更新「当前页面」，不会重写之前的消息。
- 收起再打开，当前标签页中的演示会话仍在；刷新浏览器后恢复初始空会话。没有后台对话持久化，也没有连接真实 AI。
- 平板/窄屏使用下方非模态停靠区域，让页面和对话同时可见；移动端底部四 Tab 保持可操作。后续可根据实际 Preview 体验调整比例。
- 普通记录编辑、报告导入仍为临时模态抽屉；**桌面右侧抽屉使用直角边缘，移动端底部抽屉恢复顶部双圆角**，方便区分前后层。应用、账号与设置统一由 ALOHA Hub 菜单进入。
- 对话回车发送兼容中文输入法候选词确认；Shift+Enter 可换行。所有图标继续使用 Lucide。

## 七个模型与页面映射

| LifeSpace 模型 | 用户可见的名称 | 主要入口 |
| --- | --- | --- |
| HealthConcern | 健康问题 | 首页 / 身体 · 健康问题 / 专题详情 |
| HealthMetric | 健康指标 | 身体 · 指标 / 添加指标 |
| HealthObservation | 测量记录 | 指标详情 / 时间线 / 关注事项 / 资料提取 |
| HealthEvent | 健康事件 | 身体 · 时间线 / 关注事项 |
| HealthDocument | 健康资料 | 身体 · 资料 / 上传演示 / 证据详情 |
| HealthAssessment | 健康评估 | 身体 · 时间线 / 关注事项 / 支持依据 |
| HealthRegimen | 健康方案 | 身体 · 干预 / 关注事项 / 首页执行区 |

原型中的 concernIds、basisIds 只表达 LifeSpace Semantic Relation 的交互意图，并非正式 Model Definition 字段。原始文档使用平台 File 身份；原型文件名不是有效的 fil_*。

## Token 体系

样式按三层组织，**没有复制一套独立的 ALOHA 主题**：

1. **跨 PWA 全局基础：** packages/design-tokens/tokens.css。全局颜色、字体、间距、圆角、阴影、控件及各领域 Accent 是唯一共享来源。
2. **Health 应用语义：** apps/health/src/tokens.css。以 --health-* 对应画布、卡片、文字、边线、强调色和控件角色；全部派生自 --aloha-*，不在页面重复写静态配色。
3. **界面实现：** apps/health/src/style.css 消费语义 Token，根据 Mobile / Tablet / Desktop 调整布局。图标统一使用 lucide-vue-next，不使用字符图标、Emoji 或自行画的替代图标。

共享 Token 新增要证明至少两个应用会复用；Health 特有语义留在本应用。

## 运行验证

在仓库根目录依次执行：

- npm install --legacy-peer-deps
- npm run dev:health
- npm run typecheck -w @aloha/health
- npm run test -w @aloha/health
- npm run build:health
- npm run check

独立 Preview 工作流为 Deploy Health PWA Preview，运行时选 feat/health-interactive-prototype 分支。不会为正式产品绑定 /health/* Production 路由。

## 本轮明确不实现

- 真实 LifeSpace 模型读写、Data Grant 与服务端授权，或真实文件上传与 File 生命周期。
- 真实 Health Agent / AI / Operation Confirmation，仅模拟带当前页面语境的固定回复。
- 从图片/PDF 提取医学数据、自动诊断或计算没有医学依据的总评分。
- 长时自动提醒，以及饮食/运动第二批领域模型。

产品设计来源：ALOHA Health Notion 的第一批七模型业务方案；原型不能代替 LifeSpace Domain Contract。
