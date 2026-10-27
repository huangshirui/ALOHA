# ALOHA Health 交互原型 / Experience Prototype

> Status: exploratory UX demo, **not** a connected health-data application.

## Purpose / 目标

Explore the ALOHA Health mobile/tablet/desktop experience on top of the existing independent PWA scaffold in PR #35. ALOHA Health is one surface of one ALOHA product/LifeSpace Application Context. Do not migrate code from the historical `aloha-assistant-pwa`.

### Interactive journeys / 可体验路径

1. 首页：健康状态概览、关注事项、趋势入口、当天辅助任务、最近事件。
2. 身体：概览、健康问题、指标、时间线、资料、干预六个二级入口。
3. HealthConcern：从关注事项深入到趋势、近期事件、方案与资料；操作按钮带当前页面语境。
4. 健康指标：示意曲线与快捷添加数值。当前会话的临时录入仅存在前端内存，刷新清空。
5. 资料导入：本地选文件仅显示名称，不读取内容、不上传、不保存，模拟“原始证据 → 结构化提取 → 人工确认”的后续流程。
6. Health Agent：右上角统一入口，移动端 Bottom Sheet / 桌面右侧抽屉；回应用固定演示文案，未连接 n8n/AI。
7. ALOHA App Switcher 与统一账号：仅用于检验可发现性；其他 Surface 路由与 LifeSpace 授权仍需真实集成。
8. 饮食 / 运动：第二批规划，仅有一级导航占位。

## Safety / 数据安全

- All numbers, descriptions and example entries are **synthetic UI demonstration data**, not real personal health, medical, household or financial information.
- Does **not** call LifeSpace, Gateway, Agent Control, n8n, or external provider APIs.
- Does **not** persist input locally or remotely; demo entries live in in-memory Vue state only.
- File preview does **not** read the file body; it displays the selected filename and an explanatory workflow.
- No medical interpretation or health score is computed. Avoid treating demo trends as clinical evidence.

## Local development / 本地体验

From the repository root with the toolchain specified in `docs/development.md`:

```bash
npm install --legacy-peer-deps
npm run dev:health
npm run typecheck -w @aloha/health
npm run build:health
npm run check
```

The Vite app uses the `/health/` PWA scope. A manual preview-deploy workflow already exists in the PR #35 development branch, but it is **not a production route**. Production `/health/*` and real health-domain read/write require separate architecture, security, model and deployment acceptance.

## Known gaps / 后续真实产品任务

- Connect actual LifeSpace Health models through a **trusted domain API**, not browser-side privileged secrets or a fake Agent-Control data path.
- Implement verified Personal Space / Grant / Application authorization and consent-based sharing.
- Implement HealthDocument File lifecycle, AI structured extraction, evidence links, and user review.
- Add real concern/metric visualization & medically appropriate uncertainty/source metadata.
- Implement HealthRegimen/Task/Recurrence, and test deny/confirm paths.
- Implement Health Agent context binding and session continuity via the owning ALOHA Interaction Protocol.
- Add final install icons and smoke-test responsive/safe-area/accessibility before production launch.

## Dependency / 合并顺序

The multi-PWA foundation was merged in [PR #35](https://github.com/huangshirui/ALOHA/pull/35). This prototype's PR #36 is based on current `main`, with only Health UX files changed; keep it Draft until preview/UX acceptance. Never activate a production route simply to demonstrate the prototype.
