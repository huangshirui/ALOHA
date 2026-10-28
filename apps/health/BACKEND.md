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

当前实现状态：仅在独立 ALOHA 功能分支，未部署或通过在线端到端验收。真实文件上传/File 引用的创建、Semantic Relation 关系维护、Task 完成、人体位置及关注度持久化尚未接入；Live 模式不能把这些演示操作当作真实数据写入。HealthEvent 的有时刻记录暂按浏览器本地时区转换为绝对 Instant，需在实测中核对用户所在地与 Space 时区不同的情况。

## 开启 Staging Live 模式

1. 用 LifeSpace Console 在 **Staging** 注册七个普通模型并为**现有 ALOHA Application**授权 read/write，不修改 LifeSpace 仓库。
2. Staging Health Worker 配置 Identity/Core HTTPS Origin、专用 `LIFESPACE_APPLICATION_CREDENTIAL` Secret；确认受 Cloudflare Access 保护且 audience 归属同一个 ALOHA Application。
3. 构建 Health 前端时设置 `VITE_HEALTH_DATA_MODE=live`；这个变量是公开的功能开关，不是权限或安全边界。
4. 登录后明确选择个人 Space；本人 Person 由 BFF 从已认证 user 及该 Space 成员关系解析，不允许切换他人。空间选择只影响 UI 请求范围，权限仍由 Identity/Core 每次判定。
5. 用虚构合成记录验证七模型列表、普通 CRUD、版本冲突和拒绝路径；文件、关系和任务不通过前不宣布完整 Health 业务验收。

## ALOHA-owned Health 展示偏好 D1（本分支新增）

这是一份 **ALOHA 私有展示数据**，不是 LifeSpace 的第八个 Health 模型，也不应新增 `health_concern` 的字段。固定坐标含 `view`（正/背面）、`assetId`（人体素材版本）及归一化 `x,y ∈ [0,1]`；`attention` 仅表示用户自定关注级别，不是病情严重度。清除定位仅清除点位，不删除 HealthConcern。

- 迁移：`apps/health/migrations/0001_concern_presentation.sql`；D1 binding：`PRESENTATION_DB`。
- D1 唯一主键：`(space_id,user_id,person_id,concern_id)`，隔离不同用户和不同 Space 的展示偏好，不存放身份令牌或健康资料原文。
- `GET /health/api/v1/spaces/:spaceId/presentation/concerns`：读取当前用户/Person 的偏好列表。
- `PATCH /health/api/v1/spaces/:spaceId/presentation/concerns/:concernId`：原子合并 `{attention? ,placement?}`，使用 `placement:null` 清除定位；拒绝非法坐标、未知素材和非法关注度。
- `DELETE` 同一详情路径：在 LifeSpace Concern 删除成功后清理用户偏好；清理失败不反向撤销 LifeSpace 的业务删除，残留点位由于无对应 Concern 不会显示。
- BFF 必须先使用已验证的 Access assertion → Identity 用户 token → Core 当前 user 与 Space member 的 personId；读取时验证 `health_concern` 模型读权限，写入时额外读取目标 Concern，强制 `subjectPersonId===ownPersonId`，不接受客户端自报的用户/人员 ID。
- UI 在读取七模型时并行读取偏好，按实际 Concern ID 交集复原；切换 Space 清空原状态，加载失败不回退至演示数据。

### Staging Preview 配置

1. 在 Cloudflare 为 ALOHA Health 创建独立 **Staging D1**，将其 `database_id` 作为 GitHub Secret `ALOHA_HEALTH_PRESENTATION_STAGING_D1_ID`；不在公开仓库提交真实 ID。
2. 在现有 **Deploy Health PWA Preview** 手工 workflow 中选择 `data_mode=live`，会在 CI 临时将 `PRESENTATION_DB` D1 binding 注入 Wrangler 配置，执行远程 migration，再打包 Live 前端、部署 Health Worker；默认 `demo` 不需要 D1，且不暴露任何真实记录。
3. Live 部署还要求配置同一 ALOHA Application 的 BFF Secret `LIFESPACE_APPLICATION_CREDENTIAL`、Identity/Core HTTPS 地址和受保护的 Cloudflare Access audience。它们仍分别在 Staging 与 Production 维护。
4. Production 尚未开放路由。以后发布 Production 必须使用单独 D1、单独身份凭证/环境绑定与迁移流程，不得复用 Staging D1。
5. 验收：刷新/跨设备恢复点位和关注度、换 Space 不串数据、非法定位 422、无成员关系/无模型权限 403、伪造另一 Person Concern 403、删除后无孤点，以及 D1 不可用时明确报 503。

**状态**：以上为 PR #37 的代码与部署准备，不代表真实 Staging D1 已建立、模型已发布、Cloudflare Access 已配置或端到端验收已通过。原型模式仍使用纯内存虚构数据。真实文件上传、Semantic Relation 与 Task 完成仍未接入。
