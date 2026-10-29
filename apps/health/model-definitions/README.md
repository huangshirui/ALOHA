# ALOHA Health — Model Definitions

This directory contains **candidate LifeSpace Model Definition v1 JSON** files for the ALOHA Health application. They describe public, reusable domain structures only; they do not contain health records or environment configuration.

## Models / 模型

| Key | Meaning / 业务含义 |
| --- | --- |
| `health_metric` | 可重复使用的健康指标定义 |
| `health_concern` | 持续跟踪的健康关注主题 |
| `health_event` | 单次健康相关事件 |
| `health_document` | 原始健康资料的文件引用 |
| `health_observation` | 单次指标观测事实 |
| `health_regimen` | 持续执行的健康方案 |
| `health_assessment` | 基于事实的分析或建议 |

Model keys, field keys, and enum values are stable English identifiers. Display names and descriptions are written in concise Chinese business language so that both UI and Agent consumers can distinguish the models and their fields.

## Contracts and validation / 契约与验证

- These JSON files are **candidates**, not evidence that a model has been published. The target LifeSpace Model Registry and its versioned contracts remain authoritative after validation and publication.
- Keep field types, required/immutable flags, reference targets, query metadata, access declarations, Semantic Relations, and Recurrence Capability bindings compatible with the platform DSL.
- Run `npm run test -w @aloha/health` to check basic schema structure and semantic regression guards. **A passing repository test does not replace the platform's Model Definition validator.**
- Validate model dependencies before publication. Referenced models must already be available in the target registry.
- The `health_observation` value fields (`valueNumber`, `valueText`, `valueBoolean`) are mutually exclusive in the business domain and must agree with the referenced metric's `valueType`. These cross-record rules require validation by a trusted application layer.
- Never add real patient information, sample records derived from user data, credentials, internal discussions, private project links, or deployment-specific identifiers to this directory. Test fixtures must be wholly synthetic.

Publishing these definitions and granting read/write access are separate, explicitly authorized platform operations.
