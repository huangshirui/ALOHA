# ALOHA Health · LifeSpace 对接（实施中）

## 目前边界

- `apps/health/src/worker.ts` 是**同源可信 BFF**（薄代理），不是独立的 Health 数据库或第二套权限系统。
- 浏览器只请求 `/health/api/v1/...`；请求必须携带 Cloudflare Access 原始断言，BFF 用服务端 `lsa_*` 与 LifeSpace Identity 交换当前用户的限权短期 token；再由 Core 对每个 Space/Model 操作进行现时授权。
- `GET /health/api/v1/spaces` 返回当前用户已有授权的 Space 清单。它**不能自动判断哪个是 Personal Space**：LifeSpace 已移除 Space.kind。第一次绑定必须由受信产品配置或用户明确选择，不允许根据 Space 名称、排序或唯一的 `linkedUser` 猜测。
- `GET /health/api/v1/spaces/:spaceId/models/:modelKey/records` 与同一路径的 `POST`、子路径的 `GET/PATCH/DELETE`，暂只允许 Health 第一批七个模型。BFF 不接受用户自填的 Principal/User token。
- `HealthObservation` 写入要按实际的 Metric 类型校验唯一值，且查询 Metric 和写入受同一次当前用户授权约束。模型字段语义仍以 LifeSpace 已发布 Registry 版本为权威。
- 还未将真实列表/编辑/删除接到 Vue 原型：之前所有演示记录仍为虚构内存数据。必须完成 Staging 模型发布与身份/Space 绑定后再切到 live 模式，且<strong>不得</strong>用假数据冒充实时数据。

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

目前仅代码就绪，尚未部署或通过在线端到端验收。
