# ALOHA

ALOHA is a personal digital-life product built around one shared application identity and multiple focused first-party PWA surfaces.

Assistant is the Agent interaction surface; Health, Finance and Things provide shorter, purpose-built paths for structured personal workflows while sharing the same ALOHA product, authentication context and LifeSpace Application Context.

## PWA surfaces

| Surface | Install name | Target path | Current state |
| --- | --- | --- | --- |
| ALOHA Assistant | `Assistant` | `/assistant/` | Existing product surface. Workspace is separated, but production remains on the transitional root/Gateway deployment until the required LifeSpace upgrade is complete. |
| ALOHA Health | `Health` | `/health/` | Development scaffold ready; independently buildable and preview-deployable. Domain/data contracts intentionally TBD. |
| ALOHA Finance | `Finance` | `/finance/` | Development scaffold ready; independently buildable and preview-deployable. Domain/data contracts intentionally TBD. |
| ALOHA Things | `Things` | `/things/` | Development scaffold ready; independently buildable and preview-deployable. Domain/data contracts intentionally TBD. |

These surfaces are **not separate LifeSpace applications**. They are independently installable/releasable surfaces of the same ALOHA application.

All four surfaces share one cross-surface design language but may use completely different information architecture and domain interaction models. Every surface must intentionally support Mobile, Tablet and Desktop. See [`docs/design-system.md`](./docs/design-system.md).

See [`docs/pwa-deployment.md`](./docs/pwa-deployment.md) for the deployment boundary.

## Open-source repository

ALOHA is developed as an open-source project under **AGPL-3.0-or-later**. Public source and documentation must never contain private user data, real conversation/memory/health/financial/household content, credentials, production datasets, private infrastructure identifiers or live provider configuration. Examples and fixtures must remain synthetic.

Contributors and coding agents must read `AGENTS.md` and the nearest nested `AGENTS.md` before changing code.

## Product and platform boundary

ALOHA owns its first-party product experiences and ALOHA-specific control/interaction semantics.

LifeSpace remains the authority for Identity（身份）, Principal（权限主体）, Actor（执行者）, Application Context（应用上下文）, Space/Grant and Shared Reality（共享现实）. ALOHA does not duplicate those platform responsibilities.

The browser/UI surface is never the final authorization boundary. Trusted authorization must be enforced by the owning server/platform boundary.

## ALOHA Assistant architecture

Assistant is the Agent-oriented ALOHA surface. Its current logical path remains:

```text
ALOHA Assistant PWA
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
Canonical Run Envelope v1
        |
        v
Runtime Adapter（运行时适配器）
        |
        v
n8n Agent Workflow
```

Health, Finance and Things do **not** automatically inherit the Assistant Agent-Control data path. Their trusted domain/data API boundaries must be decided explicitly in their own development work.

## Current execution state

Assistant M0-M3 work already exists. Further Assistant product/runtime integration is paused where it depends on the in-progress LifeSpace upgrade.

Health, Finance and Things may proceed independently from their prepared PWA scaffolds without inventing domain schemas in advance.

## Sources of truth

- `README.md` — ALOHA product/repository boundary and current surface state
- [`docs/architecture.md`](./docs/architecture.md) — architecture and ownership boundaries
- [`docs/pwa-deployment.md`](./docs/pwa-deployment.md) — multi-PWA deployment and release boundary
- [`docs/design-system.md`](./docs/design-system.md) — cross-surface visual/responsive language
- Assistant-specific runtime/interaction documents under `docs/`
- `packages/contracts` — code-owned shared ALOHA/Assistant contracts
- `packages/design-tokens` — shared semantic visual tokens
- `packages/ui` — minimal shared UI primitives

## Repository layout

```text
apps/
  assistant/               # ALOHA Assistant PWA
  health/                  # ALOHA Health scaffold + preview Worker
  finance/                 # ALOHA Finance scaffold + preview Worker
  things/                  # ALOHA Things scaffold + preview Worker

workers/
  gateway/                 # shared public transport/API boundary; transitional Assistant static hosting
  agent-control/           # Assistant Agent Control / Identity / Conversation / Run

packages/
  contracts/               # shared ALOHA interaction/runtime contracts
  capabilities/            # ALOHA-managed capability registry/adapters
  runtime-n8n/             # Assistant MVP n8n Runtime Adapter
  design-tokens/           # cross-surface semantic visual tokens
  ui/                      # minimal cross-surface UI primitives

docs/                      # normative product/architecture/design specifications
```

## Development

```bash
npm install

npm run dev:assistant
npm run dev:health
npm run dev:finance
npm run dev:things

npm run build:assistant
npm run build:health
npm run build:finance
npm run build:things
npm run build:pwas

npm run check
```

Health, Finance and Things each have their own manually triggered preview deployment workflow and Worker. These preview deployments do not claim the production `aloha.aisr.online/<surface>/*` routes yet.

The current production workflow still deploys Assistant assets with the shared Gateway Worker. This is a migration constraint, not the target multi-PWA topology; Assistant moves to independent `/assistant/` deployment only after the LifeSpace-dependent work is ready for cutover.

When starting concrete work on a PWA, open that app's `AGENTS.md` first, keep domain decisions local to the surface, and promote only proven cross-surface primitives into shared packages.

See [`docs/development.md`](./docs/development.md) for detailed deployment and private-configuration rules.
