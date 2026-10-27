# ALOHA Health · UX 体验原型

> 仅供体验和评审。所有启动数据均为虚构示例；新增内容只保存在当前页面内存中，刷新即恢复。不接入 LifeSpace、真实 AI 或任何健康数据接口。

## 体验目标

使用 ALOHA 统一视觉语言，让普通用户以“健康问题、指标、记录、资料和方案”为入口完成一系列具体操作，而不是在首页查看一组静态卡片。

### 推荐四条体验路线

1. **关注事项工作台：** 首页 → 正在关注的问题 → 详情（现在怎么样 / 正在做什么 / 最近发生 / 依据）→ 关联测量、健康事件、资料、评估和方案；在已有问题中添加记录会自动带入当前关联。
2. **指标记录与回顾：** 身体 → 指标 → 选指标 → 查看趋势 → 记录一次 → 根据数值、文本、是/否自动变化的表单 → 返回时间线和指标历史；也可以新增指标定义。录入只产生一个与指标取值类型一致的观测值。
3. **报告整理：** 身体 → 资料 → 添加资料 → 选取演示文件（只取文件名）→ 查看“模拟提取”的虚构测量结果 → 用户勾选是否保留 → 最终确认 → 新增资料与可选的待核实观测。提取示例**与所选文件内容无关**，不执行真实读取、分析、上传。
4. **健康方案：** 身体 → 干预 → 新建方案 → 填写执行说明 / 开始结束日期 / 每天或每周安排 / 首次执行日期 → 保存 → 首页“今天可以做什么”中点击体验完成状态。日期和重复计划规则在表单内进行验证。真实 Recurrence / Task 生成不属于原型。

另外可从身体 → 时间线添加健康事件或健康评估，选择支持判断的报告或测量，并将任意记录关联到一个或多个健康问题。

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
