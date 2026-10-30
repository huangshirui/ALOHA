# ALOHA architecture baseline

This document records the current target boundary for the ALOHA repository.

ALOHA is one personal digital-life product and one LifeSpace Application Context with multiple first-party PWA surfaces. ALOHA Assistant is the Agent-oriented surface; Health, Finance and future domain surfaces are peer product surfaces, not sub-agents or separate LifeSpace applications.

## Product surface topology

```text
                         ALOHA
                one product / application
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
     Assistant PWA      Health PWA      future PWA
      /assistant/         /health/       /<surface>/
          |                |                |
          |                |                |
          +-------- shared platform/backend boundaries -------+
                           |
                        LifeSpace
```

Each PWA surface is independently buildable and independently releasable. Its install identity, manifest, icon, UI and route scope belong to that surface.

PWA deployment separation does not imply duplicated application identity, duplicated authorization systems or duplicated backend services.

See `docs/pwa-deployment.md` for the deployment contract and staged migration state.

## ALOHA Assistant architecture

Assistant is the Agent-oriented ALOHA surface. Preserve the logical path:

```text
ALOHA Assistant PWA / future Assistant channels
              |
              v
       Gateway（网关）
  ALOHA Interaction Protocol
              |
              v
 Agent Control（智能体控制层） <---- LifeSpace Identity
  Conversation / Run state
  Identity / Context / Policy
              |
              v
Canonical Run Envelope（规范运行信封）
              |
              v
 Runtime Adapter（运行时适配器）
              |
              v
      Runtime Backend
      n8n Agent (MVP)
              |
      +-------+---------+---------+
      |       |         |         |
      v       v         v         v
 LifeSpace  n8n      Search /   future
 Core Tool  Workflow  other Tool  Tools
```

The Assistant architecture has two stable protocol boundaries:

1. **Gateway -> Agent Control:** ALOHA Interaction Protocol（ALOHA 交互协议）.
2. **Agent Control -> Runtime Adapter:** Canonical Run Envelope（规范运行信封）under the Runtime Contract（运行时契约）.

The Runtime Adapter converts the Envelope into the selected Runtime request and normalizes Runtime output back into ALOHA events.

Agent Control is not the model/runtime engine and does not own a generic Tool Loop.

## Other PWA surfaces

A domain surface such as Health is not required to send ordinary structured data access through Agent Control.

The following must be decided explicitly when a domain is implemented:

- the owning domain/model source of truth;
- the trusted API/BFF path used by the browser;
- read/write authorization and attribution;
- offline/cache/sync behavior where applicable;
- any Agent-assisted actions and whether they enter the Assistant/Agent-Control path.

Do not infer these choices from the Assistant architecture.

The Health prototype is merged; Draft PR #37 adds a same-origin trusted LifeSpace BFF for seven Console-published domain models, and a separate per-user SQLite-backed Durable Object for ALOHA-only body-point/attention presentation state. Neither the Live integration nor Production routing has passed staging acceptance.

## Gateway（网关）

Gateway is the shared Assistant channel/transport boundary and may also expose shared ALOHA API routes where an explicit contract assigns that responsibility.

For Assistant it owns:

- external request admission and authentication handoff;
- first-party / future channel adaptation;
- ALOHA Interaction Protocol transport;
- HTTP/SSE/session transport and routing;
- transport-level controls.

Gateway does **not** own model reasoning, Tool Loop, Conversation / Run product state, Confirmation policy or domain business semantics.

Do not route every future domain surface through Gateway by default merely because Gateway already exists.

## Agent Control（智能体控制层）

Agent Control is an Assistant/Agent product boundary, not the backend for every ALOHA screen.

For Assistant it owns:

1. **Conversation / Run state** — durable ALOHA Conversation and Run lifecycle.
2. **Trusted identity binding** — bind verified LifeSpace Principal, ALOHA Agent Actor and ALOHA Application Context.
3. **Context / policy assembly** — attach only Context and ALOHA product policy required by the current Run.
4. **Canonical Run Envelope** — emit the stable Runtime-facing ALOHA request.
5. **Canonical events** — normalize Runtime status/result/error into ALOHA semantics.

Agent Control does not own the model/reasoning loop or generic Tool Loop.

## Runtime Contract / Runtime Backend

The Runtime Backend is replaceable. The MVP Runtime remains **n8n Agent**.

Runtime Adapter has one main job:

> translate the Canonical Run Envelope into the concrete Runtime request, then translate Runtime output back into ALOHA semantics.

Runtime-specific SDK/protocol/session/event details stay behind the adapter. Do not build generic multi-runtime negotiation for the MVP.

## LifeSpace boundary

LifeSpace remains the authority for Identity（身份）, Principal（权限主体）, Actor（执行者）, Application Context（应用上下文）, Space/Grant and Shared Reality（共享现实）for the data it owns.

All ALOHA PWA surfaces remain part of the same registered ALOHA LifeSpace Application by default.

### Assistant identity path

For a real authenticated Assistant Run:

```text
Principal = LifeSpace User / usr_*
Actor     = ALOHA Agent / agt_*
Application = ALOHA
```

Agent Control resolves trusted identity server-side. Client-supplied IDs, grants or scopes are not authorization authority.

### LifeSpace Core as capability/domain provider

LifeSpace Core remains an independent Shared Reality and domain capability provider. Assistant may reach it through a Runtime Tool / MCP / adapter path. A structured domain PWA may later use a different explicitly designed trusted API path.

Neither path moves LifeSpace domain authorization logic into ALOHA.

## Capability and Confirmation boundary

Two Assistant concepts remain separate:

- **ALOHA-managed Capability（ALOHA 管理能力）** — capability exposed through an ALOHA-controlled invocation path.
- **Runtime Tool（运行时工具）** — tool configured for the Runtime, such as LifeSpace Tool or n8n Workflow Tool.

Confirmation is an ALOHA Agent product behavior, not a substitute for LifeSpace domain authorization. High-impact confirmation enforcement must remain outside the model.

## ALOHA Hub and AISR account boundary (Draft / 2026-10-30)

The **ALOHA Hub is a shared UI component**, not a separate web app, new
Identity provider, or account database. It is available from each participating
PWA using the same brand presentation contract in `@aloha/ui`
(`AlohaHub.vue`, `AlohaHubSettings.vue`); Health and the Assistant scaffold
are its first two consumers. Each surface keeps its own PWA path scope.

- **Account center**: the external entry is `https://account.aisr.online/`
  (the site itself is an independently developed product). Hub opens it in a
  new tab; it does not implement account security, authorization, or profile
  writes.
- **Global User profile**: LifeSpace Identity `GET /api/v1/me` is the source
  for `usr_*` `displayName` and `avatarUrl` used by HomeMew Web and
  ALOHA. A family's Person display name/avatar is not the global User profile.
  The Health same-origin BFF returns the verified Identity profile and proxies
  the current user's avatar, without granting browser access to server tokens.
  Other PWA backends must provide equivalent current-user admission before
  claiming they display real profile data.
- **Path-based app settings**: Health `/health/hub/settings`, Assistant target
  `/assistant/hub/settings`, with no separate Hub hostname. These routes are
  inside the individual PWA scopes and do not create cross-PWA deployment
  coupling. The Assistant's independent PWA route is **not yet Production**.
- **Default Space**: the shared component renders authorized Space options
  provided by each PWA's trusted BFF; Health reads Core `/api/v1/me/spaces`.
  The per-origin `aloha.space` localStorage key is merely a selection
  preference (with legacy `aloha.health.space` migration), never a grant,
  Identity claim, or cross-origin synchronization service. Core continues
  current membership and grant enforcement for every read/write. Distinct
  Staging Preview origins cannot share localStorage.
- **Health MVP scope**: basic manual health records, files, relationships,
  observations and health workspace form the candidate MVP pending Staging
  release verification. AI import/Health Agent (Issue #43) and regimen
  Task/Recurrence execution (Issue #44) are separate future work. Live Health
  must not present demo AI as an authenticated, working Agent.

This is candidate implementation on the Health integration Draft PR; do not
interpret this section as a Production deployment guarantee.

## Multi-PWA deployment boundary

Target production topology:

```text
aloha.aisr.online/
  /assistant/*  -> Assistant PWA Worker
  /health/*     -> Health PWA Worker
  /finance/*    -> Finance PWA Worker
  /.../*        -> corresponding PWA Worker

shared/Agent API paths -> Gateway where applicable
                         -> Agent Control where Agent semantics are required
```

PWA scopes must not overlap. The root path is not a fifth installable PWA in the target topology.

### Current migration state

- `apps/web` has been retired.
- `apps/assistant` owns the existing Assistant UI.
- Assistant still uses the transitional root-scope manifest and is physically served with the Gateway Worker in production. This remains until the current LifeSpace-dependent Assistant upgrade/cutover is ready.
- `apps/health` owns Health UI and the `/health/` PWA identity with an independent Preview Worker; Draft PR #37 adds trusted LifeSpace BFF and a separate per-user DO state class.
- the production `/health/*` route is not activated yet.

This staged state is deliberate: repository ownership can be corrected without forcing a production routing migration at the same time.

## Repository responsibilities

### `apps/assistant`

ALOHA Assistant PWA and its first-party Agent interaction experience.

### `apps/health`

ALOHA Health PWA. Interactive prototype merged; trusted seven-model LifeSpace BFF and user-owned SQLite DO display state are staged in Draft PR #37, not Production.

### future `apps/<surface>`

Independent PWA surfaces with non-overlapping install scopes and release boundaries.

### `workers/gateway`

Shared external transport/API boundary. It continues to serve Assistant static assets only as a transitional production arrangement.

### `workers/agent-control`

Assistant Conversation / Run control, trusted identity/context assembly, Canonical Run Envelope production, Runtime selection and canonical event normalization.

### `packages/contracts`

Stable shared ALOHA/Assistant interaction, Run, Context and Runtime-facing contracts. Do not add a domain contract here merely because two UIs might theoretically use it.

### `packages/runtime-n8n`

Concrete mapping between the ALOHA Runtime Contract and the controlled n8n Agent workflow.

### `packages/capabilities`

ALOHA-managed capability registry/adapters. Do not use this package as a generic registry for all Runtime-native Tools or domain APIs.

## Current implementation order

1. Keep existing Assistant M0-M3 behavior stable while the required LifeSpace upgrade is completed.
2. Keep the independently deployed Health PWA boundary. Publish the seven ordinary Health models through LifeSpace Console; validate the Draft BFF and DO integration in Staging before production cutover.
3. When LifeSpace-dependent Assistant work is ready, finish Assistant integration and separately cut Assistant production from root/Gateway static hosting to its independent `/assistant/` PWA Worker.
4. Activate Health production routing only when Health has a release-ready UI, final icon assets and an explicitly designed trusted data/API boundary.
5. Add Finance or other surfaces only when their product scope is concrete; reuse the same independent-PWA pattern rather than copying Assistant internals.
