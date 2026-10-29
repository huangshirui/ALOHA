# ALOHA Health · LifeSpace 对接（实施中）

## 目前边界

- `apps/health/src/worker.ts` 是**同源可信 BFF**。LifeSpace 是业务事实及授权权威；Health Worker 另外管理 ALOHA 专属的展示偏好。
- 浏览器只请求 `/health/api/v1/...`；请求必须携带 Cloudflare Access 原始断言，BFF 用服务端 `lsa_*` 与 LifeSpace Identity 交换当前用户的限权短期 token；再由 Core 对每个 Space/Model 操作进行现时授权。
- `GET /health/api/v1/spaces` 返回当前用户已有授权的 Space 清单。它**不能自动判断哪个是 Personal Space**：LifeSpace 已移除 Space.kind。Space 首次选择须由用户明确确认，不允许从名称/排序猜测；健康主体 Person 不提供切换入口，而是由 BFF 使用 Core 当前用户 Principal 与当前 Space 成员关系里的 personId 确定。
- `GET /health/api/v1/spaces/:spaceId/models/:modelKey/records` 与同一路径的 `POST`、子路径的 `GET/PATCH/DELETE`，暂只允许 Health 第一批七个模型。BFF 不接受用户自填的 Principal/User token。
- `HealthObservation` 写入要按实际的 Metric 类型校验唯一值，且查询 Metric 和写入受同一次当前用户授权约束。模型字段语义仍以 LifeSpace 已发布 Registry 版本为权威。
- Vue 已提供显式的 Live 模式（编译变量 `VITE_HEALTH_DATA_MODE=live`）：由用户明确选择 Space、再由受信 BFF 解析本人 Person 后读取七个已发布模型的记录，并将普通记录的创建、修改、删除写回 Core。没有完成 Staging 模型发布与应用授权前，Live 模式会显示明确的错误或空状态，绝不自动回退到虚构演示记录。默认未配置该变量时仍为原型 Demo 模式；两种模式不能混用。

## 部署配置（不提交真实值）

在对应的 Health Worker Preview / Production 分开设置：

- `LIFESPACE_IDENTITY_BASE_URL` — 对应环境 HTTPS Identity origin
- `LIFESPACE_CORE_BASE_URL` — 对应环境 HTTPS Core origin
- `LIFESPACE_APPLICATION_CREDENTIAL` — 同一个 ALOHA LifeSpace Application 颁发的 Health BFF 专用 `lsa_*` Secret。独立凭证不代表新增 Application。
- Health 路由外部须由 Cloudflare Access 保护，且所用 Access audience 已登记给同一个 ALOHA Application。

LifeSpace Console 配置该 Application 的七模型 read/write Access；用户须具备 Space Membership/Grant 和 `profile:read/spaces:read/resources:read/resources:write` Scope。应用侧仅声明这批预期 Scope，不会越过 Identity/ Core 当前授权。

## 验收

1. 缺少任一服务端配置或 Access Assertion → 503/401，且不发 Core 请求。
2. Cross-origin 写入、白名单外模型、缺失 version → 403/404/400。
3. Staging 用户调用 `/health/api/v1/spaces`，仅显示自己有权访问的 Space；不得猜选家庭 Space 为个人空间。
4. 依赖模型发布后，合成 Metric/Observation 测量 CRUD，更新版本冲突 409、跨用户/跨 Space 禁止 403，观测类型不符 422。
5. 第一批资料上传/复杂语义关联/Task 完成需进一步接 LifeSpace 专用 API，不允许把虚构文件名作为稳定 `fil_*` 写入。

当前实现状态：仅在独立 ALOHA 功能分支，未部署或通过在线端到端验收。真实文件上传/File 引用的创建、Semantic Relation 关系维护、Task 完成尚未接入；人体位置及关注度已在 DO 代码中实现，但尚未完成 Staging 在线验收；Live 模式不能把这些演示操作当作真实数据写入。HealthEvent 有时刻记录使用浏览器当前时区将本地时间转换为绝对 Instant，读取时反向转为当前浏览器本地时间，不再直接截取 UTC 时分。需在 Staging 验证 Space 时区、跨日事件和夏令时歧义；本轮暂不宣称具备独立事件时区输入。

## 开启 Staging Live 模式

1. 用 LifeSpace Console 在 **Staging** 注册七个普通模型并为**现有 ALOHA Application**授权 read/write，不修改 LifeSpace 仓库。
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

### Staging Preview 配置与验收

1. 手工 Workflow **Deploy Health PWA Preview** 选择 `data_mode=live`；DO Binding 和 Migration 随 `aloha-app-health` Worker 一起发布。`demo` 模式同样配置 DO Class，但不会向其写入真实展示状态。无需 Cloudflare D1 新建/迁移流程。
2. Staging Worker 仍需服务端 `LIFESPACE_IDENTITY_BASE_URL`、`LIFESPACE_CORE_BASE_URL`、`LIFESPACE_APPLICATION_CREDENTIAL` 和受 Cloudflare Access 保护的 audience。通过 LifeSpace Console 在 Staging 发布七个 Health 普通模型，为现有 ALOHA Application 配置 Model Access，不修改 LifeSpace 仓库。
3. Production 以后必须使用独立 Worker/DO namespace，不能将已供 Staging 使用的同一 Worker/DO Namespace 改绑到 Production；不要把展示数据存储合并到 LifeSpace D1 或 Assistant Agent Control DO。
4. 在线验收：刷新/跨设备恢复、不同 User/Space/Person 隔离、非法点位/素材 422、无 Core Model 权限 403、清除点位保留关注度、删除后无孤点、DO 不可用时明确 503。

**当前状态**：功能仍在 Draft PR #37，尚未完成 Staging 模型发布、Access 配置及端到端验收；没有创建新 D1。Demo 模式只用虚构内存数据。真实文件上传、Semantic Relations 与 Task 完成仍未接入。

## Workers Runtime 本地集成测试（PR #37）

`npm run test -w @aloha/health` 依次运行纯 Vitest 单元测试及 `@cloudflare/vitest-plugin` 的 workerd SQLite DO 测试。后者通过 `apps/health/wrangler.test.jsonc` 装载与正式 Worker 相同的 DO 类，验证建表、写入、实例隔离和驱逐后重启读取；全部使用合成值，不调用 Staging。该通过不等于 Staging 已经配置 Access、发布模型或真实 CRUD。相关部署仍须走 Console 与 Preview 部署流程。
