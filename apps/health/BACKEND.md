# ALOHA Health · LifeSpace 对接（实施中）

## 目前边界

- `apps/health/src/worker.ts` 是**同源可信 BFF**。LifeSpace 是业务事实及授权权威；Health Worker 另外管理 ALOHA 专属的展示偏好。
- 浏览器只请求 `/health/api/v1/...`；请求必须携带 Cloudflare Access 原始断言，BFF 用服务端 `lsa_*` 与 LifeSpace Identity 交换当前用户的限权短期 token；再由 Core 对每个 Space/Model 操作进行现时授权。
- `GET /health/api/v1/spaces` 返回当前用户已有授权的 Space 清单。它**不能自动判断哪个是 Personal Space**：LifeSpace 已移除 Space.kind。Space 首次选择须由用户明确确认，不允许从名称/排序猜测；健康主体 Person 不提供切换入口，而是由 BFF 使用 Core 当前用户 Principal 与当前 Space 成员关系里的 personId 确定。
- `GET /health/api/v1/spaces/:spaceId/models/:modelKey/records` 与同一路径的 `POST`、子路径的 `GET/PATCH/DELETE`，暂只允许 Health 第一批七个模型。BFF 不接受用户自填的 Principal/User token。
- `HealthObservation` 写入要按实际的 Metric 类型校验唯一值，且查询 Metric 和写入受同一次当前用户授权约束。模型字段语义仍以 LifeSpace 已发布 Registry 版本为权威。
- Vue 已提供显式的 Live 模式（编译变量 `VITE_HEALTH_DATA_MODE=live`）：由用户明确选择 Space、再由受信 BFF 解析本人 Person 后读取七个已发布模型的记录，并将普通记录的创建、修改、删除写回 Core。没有完成 Staging 模型发布与应用授权前，Live 模式会显示明确的错误或空状态，绝不自动回退到虚构演示记录。默认未配置该变量时仍为原型 Demo 模式；两种模式不能混用。

## 部署配置（不提交真实值）

在**同一个 Health Worker 项目**的 Production 与命名 `staging` Preview 中分别设置；Preview 与 Production 不共享运行时 Secrets 或 DO 数据：

- `LIFESPACE_IDENTITY_BASE_URL` — 对应环境 HTTPS Identity origin
- `LIFESPACE_CORE_BASE_URL` — 对应环境 HTTPS Core origin
- `LIFESPACE_APPLICATION_CREDENTIAL` — 对应 LifeSpace 环境中 ALOHA Application 颁发的 Health BFF 专用 `lsa_*` Secret。Staging 与 Production 的 Application 和 Credential 不同；同环境内多个 PWA 可共用 Application，但应各自使用可撤销的 Credential。
- Health 的登录入口采用 ALOHA 产品级共享 Cloudflare Access（Production / Staging 各自的统一入口），而不是每个 PWA 自建 Access Application。相应环境的 Access Audience 必须登记给该环境的 ALOHA LifeSpace Application；独立 Worker Preview 的直连 URL 也必须有防绕过保护。

LifeSpace Console 分别在对应环境的 ALOHA Application 配置七模型 read/write Access；用户须具备 Space Membership/Grant 和 `profile:read/spaces:read/resources:read/resources:write` Scope。应用侧仅声明这批预期 Scope，不会越过 Identity/ Core 当前授权。

## 验收

1. 缺少任一服务端配置或 Access Assertion → 503/401，且不发 Core 请求。
2. Cross-origin 写入、白名单外模型、缺失 version → 403/404/400。
3. Staging 用户调用 `/health/api/v1/spaces`，仅显示自己有权访问的 Space；不得猜选家庭 Space 为个人空间。
4. 依赖模型发布后，合成 Metric/Observation 测量 CRUD，更新版本冲突 409、跨用户/跨 Space 禁止 403，观测类型不符 422。
5. 第一批资料上传/复杂语义关联/Task 完成需进一步接 LifeSpace 专用 API，不允许把虚构文件名作为稳定 `fil_*` 写入。

当前实现状态：仅在独立 ALOHA 功能分支，未部署或通过在线端到端验收。真实文件上传/File 引用的创建、Semantic Relation 关系维护、Task 完成尚未接入；人体位置及关注度已在 DO 代码中实现，但尚未完成 Staging 在线验收；Live 模式不能把这些演示操作当作真实数据写入。HealthEvent 有时刻记录使用浏览器当前时区将本地时间转换为绝对 Instant，读取时反向转为当前浏览器本地时间，不再直接截取 UTC 时分。需在 Staging 验证 Space 时区、跨日事件和夏令时歧义；本轮暂不宣称具备独立事件时区输入。

## 开启 Staging Live 模式

1. 在 LifeSpace **Staging** 确认七个普通模型已发布，为该环境统一的 ALOHA Preview Application 单独授权 read/write，不修改 LifeSpace 仓库。
2. Staging Health Worker 配置 Identity/Core HTTPS Origin、专用 `LIFESPACE_APPLICATION_CREDENTIAL` Secret；确认受 Cloudflare Access 保护且 audience 归属同一个 ALOHA Application。
3. 构建 Health 前端时设置 `VITE_HEALTH_DATA_MODE=live`；这个变量是公开的功能开关，不是权限或安全边界。
4. 登录后明确选择个人 Space；本人 Person 由 BFF 从已认证 user 及该 Space 成员关系解析，不允许切换他人。空间选择只影响 UI 请求范围，权限仍由 Identity/Core 每次判定。
5. 用虚构合成记录验证七模型列表、普通 CRUD、版本冲突和拒绝路径；文件、关系和任务不通过前不宣布完整 Health 业务验收。

## ALOHA-owned Health 展示偏好：SQLite-backed Durable Object（本分支）

人体图定位属于 ALOHA 的 Presentation Projection，不是 LifeSpace 的第八个健康模型，也不写入 `health_concern`。一条记录包括正/背面、人体素材 `assetId`、归一化坐标 `x/y ∈ [0,1]`，以及四档主观关注度（**不是**医学严重程度）。清除点位不删除 HealthConcern，也不清除关注度。

- `apps/health/src/health-presentation-do.ts` 导出 `HealthPresentationState` Durable Object 类；`apps/health/wrangler.jsonc` 包含 `HEALTH_PRESENTATION` Binding 和 `health-presentation-v1` 的 `new_sqlite_classes` Migration。首次部署时 Cloudflare 为该 Worker 自动创建 SQLite-backed DO Namespace，**无需新建 D1，也无需 D1 数据库 ID Secret**。
- Health BFF 以 LifeSpace Identity/Core 验证的 `usr_*` 计算 `idFromName('user:'+userId)`，每个用户是独立 DO 实例。DO 内 SQLite 表主键 `(space_id, person_id, concern_id)`；不能从浏览器自报的 User ID 派发对象。DO 不拥有公开的独立 HTTP 路由。
- 浏览器 API 保持：`GET /health/api/v1/spaces/:spaceId/presentation/concerns`、`PATCH /health/api/v1/spaces/:spaceId/presentation/concerns/:concernId` 和相同详情地址的 `DELETE`。BFF 先校验 Core `health_concern` 读取权限；修改时再校验目标 Concern 的 `subjectPersonId` 为当前 Space 用户的 Person。
- DO 使用单条 SQLite `ON CONFLICT ... DO UPDATE` 实现部分字段原子更新。`placement:null` 只删除点位，不清除关注度；成功删除 Concern 后 UI 通过 `DELETE` 清理展示数据。
- 读取七个 Health 模型时并行读取 DO，按当前实际 Concern ID 交集显示；切换 Space 清除旧坐标；存储失败就报错，不回退 Demo 假数据。
- 与 Assistant 的 Conversation/Run DO 互不依赖。Finance/Things 出现真实共享需求之前，不提前建立统一 ALOHA State Worker。

### Production / named staging Preview：同一个 Worker 项目

Health 使用一个 Cloudflare Worker 项目 `aloha-app-health`：Production 接 LifeSpace Production / 正式 ALOHA Application；命名 `staging` 的真正 **Worker Preview** 接 LifeSpace Staging / ALOHA Preview Application。两者不是两个 Worker 项目，也不是根据请求 URL/查询参数动态切换后端。

- Staging **只通过** `wrangler preview --name staging` 更新命名 Preview，生产版本只能通过单独审批后的 `wrangler deploy` 更新。现有 GitHub 手工 Workflow 强制构建 `VITE_HEALTH_DATA_MODE=live`；它是公开的 UI 功能模式，不承担环境边界。
- `wrangler.jsonc` 的顶层 Durable Object Class / SQLite Migration 保持不变；`previews.durable_objects.bindings` 声明 Preview 的 `HEALTH_PRESENTATION`。Cloudflare 每个 Preview 自动获得**独立的 SQLite-backed Durable Object Namespace**。不能把 Preview DO 重新绑定到生产 DO。
- Preview Worker Secrets **不继承** Production。使用 Cloudflare Preview 的独立 Secret 配置：`LIFESPACE_APPLICATION_CREDENTIAL`、`LIFESPACE_IDENTITY_BASE_URL`、`LIFESPACE_CORE_BASE_URL`。后两项也可作为非敏感的 Preview-scoped Vars 由平台配置；源代码不提交实际环境地址或私有配置。设置前 BFF 应返回 503，而不是回退 Production。
- **认证入口与路由**：Staging 应通过 ALOHA 统一的受 Access 保护的 Preview Origin 访问 `/health/`，与其他子应用共享登录 Audience；它不是针对 Health 单独创建的 Access Application。独立命名 Worker Preview 并不会自动提供同源路径路由，需要在正式联调前完成共享入口及安全转发，并保护或关闭 Worker Preview 直连 URL，防止绕过统一入口。此共享入口尚未部署，不应宣称其现已可用。
- 首次 Preview 上传后用安全终端或 Cloudflare Preview 设置页面添加独立 Preview Secrets。示例命令（仅传名称，实际值应在安全终端交互输入，不进入 GitHub 日志）：`npx wrangler@4.135.0 preview secret put LIFESPACE_APPLICATION_CREDENTIAL --name staging`。其它敏感配置同理。
- Staging Model Registry 七模型的存在不等于 Application Model Access 已授予；需单独配置 read/write，并核对用户的 Space/Data Grant。DO、BFF、Access 均完成后用**完全合成记录**验证刷新/跨设备恢复、User/Space/Person 隔离、非法坐标 422、权限拒绝、清除点位、删除后无孤点、后端失效明确报错，不修改 Production。
- Production 只在已通过 Staging 验收、显式批准并配置自己的 Access Audience、`lsa_*`、DO 和发布路由后上线。不要把已有 Worker 的 Production 版本或 Workers.dev 端点当作 Staging Preview。

**当前状态**：功能仍在 Draft PR #37，七个 Health 模型已在 LifeSpace Staging 注册；本分支只修正命名 Preview 的部署与环境隔离，没有执行 Preview / Production 部署或在线 E2E 验收。真实文件上传、Semantic Relations 与 Task 完成仍未接入。

## Workers Runtime 本地集成测试（PR #37）

`npm run test -w @aloha/health` 依次运行纯 Vitest 单元测试及 `@cloudflare/vitest-plugin` 的 workerd SQLite DO 测试。后者通过 `apps/health/wrangler.test.jsonc` 装载与正式 Worker 相同的 DO 类，验证建表、写入、实例隔离和驱逐后重启读取；全部使用合成值，不调用 Staging。该通过不等于 Staging 已经配置 Access、发布模型或真实 CRUD。相关部署仍须走 Console 与 Preview 部署流程。
