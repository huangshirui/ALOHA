# ALOHA

ALOHA is a personal digital-life product built around one shared application identity and multiple focused first-party PWA surfaces.

The product is intentionally broader than ALOHA Assistant. Assistant is the Agent interaction surface; Health, Finance and future domain surfaces provide shorter, purpose-built paths for structured personal workflows while sharing the same ALOHA product, authentication context and LifeSpace Application Context.

## PWA surfaces

Current and planned first-party surfaces are:

| Surface | Install name | Target path | Current state |
| --- | --- | --- | --- |
| ALOHA Assistant | `Assistant` | `/assistant/` | Existing product surface. Repository workspace has been separated, but production remains on the transitional root/Gateway deployment until the required LifeSpace upgrade is complete. |
| ALOHA Health | `Health` | `/health/` | Scaffold available. Independently buildable and deployable to a preview Worker; health domain/data contracts are intentionally not defined yet. |
| ALOHA Finance | `Finance` | `/finance/` | Planned; no implementation yet. |
| Future ALOHA surfaces | surface-specific | non-overlapping path | Added only when a real product need exists. |

These surfaces are **not separate LifeSpace applications**. They are independently installable/releasable surfaces of the same ALOHA application.

See [`docs/pwa-deployment.md`](./docs/pwa-deployment.md) for the deployment boundary.

## Open-source repository

ALOHA is developed as an open-source project under **AGPL-3.0-or-later**. Public source and documentation must never contain private user data, real conversation/memory/health/financial content, credentials, production datasets, private infrastructure identifiers or live provider configuration. Examples and fixtures must remain synthetic.

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
(MVP Runtime)
        |
        +-------------------+
        |                   |
        v                   v
LifeSpace / Tools       n8n Workflow / other Tools
```

The stable Assistant boundaries are:

- **Gateway -> Agent Control:** ALOHA Interaction Protocol.
- **Agent Control -> Runtime Adapter:** Canonical Run Envelope v1.
- **Runtime Adapter -> Runtime:** backend-specific mapping only.

Agent Control does not own the model reasoning loop or a generic Tool Loop.

For a real authenticated Assistant Run:

```text
Principal（权限主体） = LifeSpace User / usr_*
Actor（执行者）       = ALOHA Agent / agt_*
Application（应用）  = registered ALOHA LifeSpace Application
```

Health and future structured domain surfaces do **not** automatically inherit the Assistant Agent-Control data path. Their domain/data API boundary must be decided explicitly when the corresponding domain work begins.

## Current execution state

Assistant M0-M3 work already exists in the repository. Further Assistant product/runtime integration is intentionally paused where it depends on the in-progress LifeSpace upgrade.

Health work may proceed in parallel because the current Health scaffold only establishes the independent PWA/release boundary and does not depend on a health domain model or the unfinished Assistant/LifeSpace integration.

## Sources of truth

- `README.md` — ALOHA product/repository boundary and current surface state
- [`docs/architecture.md`](./docs/architecture.md) — architecture and ownership boundaries
- [`docs/pwa-deployment.md`](./docs/pwa-deployment.md) — multi-PWA deployment and release boundary
- [`docs/canonical-run-envelope.md`](./docs/canonical-run-envelope.md) — Assistant Canonical Run Envelope v1
- [`docs/conversation-run-lifecycle.md`](./docs/conversation-run-lifecycle.md) — Assistant Conversation / Run lifecycle
- [`docs/interaction-protocol.md`](./docs/interaction-protocol.md) — Assistant first-party Interaction Protocol
- [`docs/runtime-trust-authority.md`](./docs/runtime-trust-authority.md) — Assistant Runtime trust/authority boundary
- [`docs/n8n-runtime.md`](./docs/n8n-runtime.md) — n8n Runtime integration
- `packages/contracts` — code-owned shared ALOHA/Assistant contracts

## Repository layout

```text
apps/
  assistant/               # ALOHA Assistant PWA
  health/                  # ALOHA Health PWA scaffold + independent preview deployment
  <future-surface>/        # future independently releasable PWA surfaces

workers/
  gateway/                 # shared public transport/API boundary; transitional Assistant static hosting
  agent-control/           # Assistant Agent Control / Identity / Conversation / Run

packages/
  contracts/               # shared ALOHA interaction/runtime contracts
  capabilities/            # ALOHA-managed capability registry/adapters
  runtime-n8n/             # Assistant MVP n8n Runtime Adapter

docs/                      # normative product/architecture specifications
```

## Development

```bash
npm install

npm run dev:assistant
npm run dev:health
npm run dev:gateway
npm run dev:agent-control

npm run build:assistant
npm run build:health
npm run check
```

Health can be preview-deployed independently through the `Deploy Health PWA Preview` workflow. The workflow intentionally does not claim the production `/health/*` route yet.

The current production workflow still deploys Assistant assets with the shared Gateway Worker. This is a migration constraint, not the target multi-PWA topology; Assistant will move to its independent `/assistant/` deployment only after the LifeSpace-dependent work is ready for that cutover.

See [`docs/development.md`](./docs/development.md) for detailed deployment and private-configuration rules.
