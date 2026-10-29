# ALOHA Health · LifeSpace Model Definition 候选

> **状态：待 LifeSpace Staging Console Validate / Publish；仅为 ALOHA 应用侧定义候选，不是已发布的 Model Registry 或 Baseline。**

本目录是七个 **ALOHA Health 使用的普通 Native Model Definition v1** 的**唯一候选源码**。未来如模型进入多个应用共享的 Baseline，再按平台规则评估迁移所有权；现在不将这批应用专属 JSON 放在 LifeSpace 源代码仓库。

## 权责边界

- **ALOHA** 持有 Health 业务模型候选、业务用例、Agent 语义文字、产品适配与验证场景。
- **LifeSpace** 始终持有 Model Definition DSL、Validate/Publish 权威、已发布的版本化 Registry / `mct_*`、授权、Query、Semantic Relations、Recurrence、物理存储与运行时行为。
- 将这些 JSON 提交到 ALOHA **不会自动创建数据库表、发布模型或授予 Agent/用户任何权限**。LifeSpace Console 发布成功后的 Registry 合约才是运行时事实。
- 本目录只包含公开可复用的结构定义，不含任何真实健康信息、私人标识符或环境凭证。

## 七个候选

| Model Key | 中文职责 |
| --- | --- |
| `health_metric` | 可复用健康指标定义；不是一次实际测量 |
| `health_concern` | 需要长期跟踪的健康关注主题；不是医学确诊 |
| `health_event` | 一次症状、受伤、就诊、检查或治疗事件 |
| `health_document` | 已上传原始健康资料的索引 |
| `health_observation` | 某人在某日的单次指标测量/观察事实 |
| `health_regimen` | 持续方案；平台 Recurrence 可据此生成 Task |
| `health_assessment` | 医生、AI 或规则的评估/建议；不是原始事实 |

## Agent 语义与 Token 原则

- 稳定机器 `key`、字段名和 Enum Value 使用英文，`display`、`title`、`description` 使用简洁中文业务语言。
- 模型描述说清用途、选择时机和相邻模型边界；字段描述只补歧义、业务约束和高风险误填，不重复结构类型/通用协议约束。
- 七个模型共 **60 字段**，其中 44 个有字段级业务描述。保留 Query、字段引用、Semantic Relations、Recurrence Capability、Access 及默认值不变；省略 DSL v1 已强制为 true 的重复 `lifecycle` 声明。
- 初步静态字符对比：七份 JSON 12,503 → 14,187 字符；Agent Tool 主要业务描述文本 1,112 → 1,846 字符。**这并不代表 Token 降低**；目标 Agent 的 tokenizer、实际 Tool Schema、模型/操作按需加载需要另行测量。不要为了削减 Token 牺牲业务解释。
- 一般不要向 Agent 同时加载七模型全量 CRUD 工具；优先 Runtime Discovery 按需选择 Space、模型与操作。

## 发布顺序与未满足的约束

1. 在 **LifeSpace Staging Console** 使用这些 JSON 顺序 Validate/Publish：`health_metric` → `health_concern` → `health_event` → `health_document` → `health_observation` → `health_regimen` → `health_assessment`。
2. 在同一 Console 为现有 ALOHA Application 配置七模型读写访问，再验证 User / Service / Agent 的 Scope、Space Membership / Data Grant 和受信代理身份链。
3. 使用**虚构测试数据**验收 CRUD、引用完整性、Recurrence、Version Conflict、Soft Delete、Agent 语义与跨身份拒绝。生产另行审批/验证。
4. 跨字段规则并不会因在 `description` 中写出就自动生效：Observation 的数值/文本/布尔值必须恰好使用一个并匹配 Metric.valueType；当次参考范围必须与单位匹配；任何健康分析不能冒充临床事实。这些由受信 BFF/适配层另外验证。

**特别注意：** `health_observation` 不含此前移除的 `status`、`interpretation`、`sourceNote`；`health_regimen` 的 `capabilities.recurrence` 仍完整保留。请勿使用旧 Notion 粘贴版或 LifeSpace 历史 PR #448/#450 分支作为当前发布候选。

> GitHub Actions 配额目前不可用。候选已进行结构一致性静态核查，但尚未完成目标平台的 `validateDefinition`、Console Validate 及真实 Agent Token 测量。无验收前不得宣称已发布或已具备生产能力。
