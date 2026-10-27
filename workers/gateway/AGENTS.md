# Gateway Agent Instructions

`workers/gateway` is ALOHA's thin external transport and channel boundary. It sits between first-party/third-party Assistant channels and ALOHA Agent Control（智能体控制层）; it is not the Agent Runtime and is not the generic backend for every ALOHA PWA surface.

In the current transitional Cloudflare production deployment, the built `apps/assistant` PWA is still attached to this Worker as Static Assets（静态资源） so the existing Assistant UI and API keep one public origin while the LifeSpace-dependent Assistant upgrade is unfinished.

This is a migration constraint only. The target multi-PWA topology gives each PWA surface its own independent Worker/static-asset release unit and non-overlapping path scope. Do not add Health, Finance or future PWA static assets to Gateway.

## Rules

- Own request admission, authentication handoff, channel adaptation, protocol normalization, session/stream transport, routing and transport-level errors.
- Support ALOHA's own first-party Assistant Interaction Protocol while allowing adapters for WeCom, Feishu and future channels.
- Do not implement model reasoning, prompt/tool orchestration, Capability policy, confirmation policy, domain business rules or long-running workflow state here.
- Keep first-party interaction semantics channel-neutral at their semantic core; channel adapters may degrade unsupported presentation/interaction features explicitly.
- Forward client-provided contextual input only as contextual claims with source/freshness metadata where applicable. Never treat client-supplied principal IDs, grants or scopes as authorization authority.
- Forward only verified/normalized identity and delegated-authority context from trusted boundaries to Agent Control.
- Prefer an explicit Service Binding or another authenticated internal interface to reach Agent Control; do not couple through persistence.
- Keep CORS, rate limiting and transport controls separate from product/domain authorization.
- Serving compiled Assistant assets from Gateway must not move UI/product logic into `workers/gateway`; source UI ownership remains in `apps/assistant`.
- Do not attach additional PWA surface bundles to Gateway. Health and future surfaces require their own deployment units.
- Any external protocol change must update `packages/contracts`, affected clients/Agent Control, tests and `docs/architecture.md` when the boundary changes.
