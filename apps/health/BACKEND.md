# ALOHA Health · LifeSpace 对接（实施中）

## 目前边界

- `apps/health/src/worker.ts` 是**同源可信 BFF**（薄代理），不是独立的 Health 数据库或第二套权限系统。
- 浏览器只请求 `/health/api/v1/...`；请求必须携带 Cloudflare Access 原始断言，BFF 用服务端 `lsa_*` 与 LifeSpace Identity 交换当前用户的限权短期 token；再由 Core 对每个 Space/Model 操作进行现时授权。
- `GET /health/api/v1/spaces` 返回当前用户已有授权的 Space 清单。它**不能自动判断哪个是 Personal Space**：LifeSpace 已移除 Space.kind。第一次绑定必须由受信产品配置或用户明确选择，不允许根据 Space 名称、排序或唯一的 `linkedUser` 猜测。
- `GET /health/api/v1/spaces/:spaceId/models/:modelKey/records` 与同一路径的 `POST`、子路径的 `GET/PATCH/DELETE`，暂只允许 Health 第一批七个模型。BFF 不接受用户自填的 Principal/User token。
- `HealthObservation` 写入要按实际的 Metric 类型校验唯一值，且查询 Metric 和写入受同一次当前用户授权约束。模型字段语义仍以 LifeSpace 已发布 Registry 版本为权威。
- Vue 已提供显式的 Live 模式（编译变量 `VITE_HEALTH_DATA_MODE=live`）：通过 Space 与 Person 明确选择后读取七个已发布模型的记录，并将普通记录的创建、修改、删除写回 Core。没有完成 Staging 模型发布与应用授权前，Live 模式会显示明确的错误或空状态，绝不自动回退到虚构演示记录。默认未配置该变量时仍为原型 Demo 模式；两种模式不能混用。

## 部署配置（不提交真实值）

在对应的 Health Worker Preview / Production 分开设置：

- `LIFESPACE_IDENTITY_BASE_URL` — 对应环境 HTTPS Identity origin
- `LIFESPACE_CORE_BASE_URL` — 对应环境 HTTPS Core origin
- `LIFESPACE_APPLICATION_CREDENTIAL` — 同一个 ALOHA LifeSpace Application 颁发的 Health BFF 专用 `lsa_*` Secret。独立凭证不代表新增 Application。
- Health 路由外部须由 Cloudflare Access 保护，且所用 Access audience 已登记给同一个 ALOHA Application。

LifeSpace Console 配置该 Application 的七模型 read/write Access；用户须具备 Space Membership/Grant 和 `spaces:read/resources:read/resources:write` Scope。应用侧仅声明这批预期 Scope，不会越过 Identity/ Core 当前授权。

## 验收

1. 缺少任一服务端配置或 Access Assertion → 503/401，且不发 Core 请求。
2. Cross-origin 写入、白名单外模型、缺失 version → 403/404/400。
3. Staging 用户调用 `/health/api/v1/spaces`，仅显示自己有权访问的 Space；不得猜选家庭 Space 为个人空间。
4. 依赖模型发布后，合成 Metric/Observation 测量 CRUD，更新版本冲突 409、跨用户/跨 Space 禁止 403，观测类型不符 422。
5. 第一批资料上传/复杂语义关联/Recurrence 需进一步接 LifeSpace 专用 API，不允许把虚构文件名作为稳定 `fil_*` 写入。

当前实现状态：仅在独立 ALOHA 功能分支，未部署或通过在线端到端验收。真实文件上传/File 引用的创建、Semantic Relation 关系维护、Task 完成、人体位置及关注度持久化尚未接入；Live 模式不能把这些演示操作当作真实数据写入。HealthEvent 的有时刻记录暂按浏览器本地时区转换为绝对 Instant，需在实测中核对用户所在地与 Space 时区不同的情况。

## 开启 Staging Live 模式

1. 用 LifeSpace Console 在 **Staging** 注册七个普通模型并为**现有 ALOHA Application**授权 read/write，不修改 LifeSpace 仓库。
2. Staging Health Worker 配置 Identity/Core HTTPS Origin、专用 `LIFESPACE_APPLICATION_CREDENTIAL` Secret；确认受 Cloudflare Access 保护且 audience 归属同一个 ALOHA Application。
3. 构建 Health 前端时设置 `VITE_HEALTH_DATA_MODE=live`；这个变量是公开的功能开关，不是权限或安全边界。
4. 登录后明确选择个人 Space 和档案 Person；Space/Person 选择只影响 UI 请求范围，权限仍由 Identity/Core 每次判定。
5. 用虚构合成记录验证七模型列表、普通 CRUD、版本冲突和拒绝路径；文件、关系和任务不通过前不宣布完整 Health 业务验收。
