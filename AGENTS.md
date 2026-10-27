# ALOHA Agent Instructions

ALOHA is one personal digital-life product and one LifeSpace Application Context with multiple first-party PWA surfaces.

Current surfaces include:

- **ALOHA Assistant** — the Agent-oriented personal super-assistant / digital chief-of-staff surface;
- **ALOHA Health** — a structured health workspace surface, currently scaffold-only;
- **ALOHA Finance** and other future domain surfaces — added only when their product scope is concrete.

These surfaces are peer product experiences inside ALOHA. A new PWA surface does not create a new LifeSpace Application identity by default.

ALOHA Assistant is not a generic multi-Agent platform or generic Agent Framework. HomeMew Agent remains a separate peer Agent product.

This repository owns ALOHA product experiences, first-party interaction semantics, thin Gateway（网关）, ALOHA Agent Control（智能体控制层）, Runtime Contract / adapters, and ALOHA-side Capability（能力）contracts/adapters where those responsibilities apply. It does not own LifeSpace/HomeMew domain logic and does not require ALOHA to implement a generic Agent Runtime engine.

## Open-source and public-repository safety model

This is an open-source project. Treat every tracked file, commit, branch, pull request, issue, review comment, CI log/artifact, screenshot, fixture, generated example and documentation snippet as if it can become public and permanently indexed.

The repository is source code and public documentation only. It is not a storage location for private user context or live infrastructure configuration.

### Never publish private or sensitive data

Do not commit, paste, generate, snapshot, log, fixture, test with, or otherwise expose:

- personal conversations, prompts, memories, emails, contacts, calendars, tasks, files, photos, voice/audio, precise location, identifiers, health/financial/family data, or other real user content;
- production/staging datasets, exports, database dumps, request/response captures, analytics samples, traces or logs that may contain real user or tenant data;
- secrets or credentials of any kind: API keys, OAuth client secrets, access/refresh tokens, JWTs, cookies, session values, private keys, webhook secrets, service-account material, passwords, recovery codes or signed URLs;
- non-public infrastructure details: provider account/resource identifiers, origin IPs, private hostnames/routes, Access audience/team identifiers, deployment-only topology, private repository/document links, or equivalent live metadata;
- values retrieved through connected tools or personal systems unless the value is explicitly intended to be public and necessary for the repository.

Use synthetic examples only. Use `example.com`, invented people/content and clearly fake identifiers. Never “anonymize” a real private payload and commit it.

Runtime secrets and live configuration must be injected through deployment/platform secret/configuration mechanisms and must never be committed.

If sensitive material is found, stop propagation, rotate/revoke secrets as appropriate, and treat Git history as persistent until explicitly cleaned.

## Licensing and third-party material

- The repository is licensed under **GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)** unless a file explicitly states otherwise.
- Do not change licensing or introduce incompatible third-party code/assets without explicit project-owner approval.
- Before copying code, prompts, schemas or substantial text from another project, verify licensing/attribution requirements. Publicly accessible does not mean reusable.

## Read before making changes

Read in this order:

1. `README.md` for the current product boundary, PWA surface state and MVP goals;
2. `docs/architecture.md` for architecture/ownership boundaries;
3. `docs/pwa-deployment.md` for multi-PWA deployment and migration rules when changing app/deployment structure;
4. the nearest nested `AGENTS.md` for every directory changed;
5. relevant contracts, tests, configuration and implementation.

If a required source of truth does not exist, establish the smallest explicit contract/decision before implementing behavior that depends on it.

## Sources of truth

- Product boundary and current surface state: `README.md`
- Architecture and repository boundaries: `docs/architecture.md`
- Multi-PWA deployment/release boundary: `docs/pwa-deployment.md`
- Runtime trust and independent Runtime authority: `docs/runtime-trust-authority.md`
- Assistant first-party interaction behavior: relevant `docs/*` Assistant specs
- Shared ALOHA interaction/context/run/capability/runtime-facing types: `packages/contracts`
- ALOHA-managed Capability registration/adaptation: `packages/capabilities`
- Deployable behavior: `apps/*` and `workers/*`
- Verified behavior: automated tests once present
- Deployment bindings: each deployable unit's configuration

Planned behavior is not implemented behavior. Documentation must distinguish target architecture from current deployment state.

## Multi-PWA product boundary

ALOHA PWA surfaces are independently developable and releasable while sharing the same ALOHA product/application identity.

### Mandatory surface rules

- Each installable surface lives in `apps/<surface>`.
- Each surface owns its manifest, install name, icons, UI, client state and path scope.
- Target production PWA scopes must not overlap.
- A surface release must not require rebuilding/redeploying unrelated PWA surfaces once its independent production deployment is activated.
- Do not duplicate Identity, authorization, Gateway, Agent Control or platform services merely to mirror the PWA split.
- Do not create shared UI/domain frameworks before there is stable reuse across at least two real consumers.
- A domain surface does not automatically use Agent Control for ordinary structured data access. Decide its trusted data/API path explicitly.

### Current migration exception

`apps/assistant` owns the existing Assistant client, but production still serves Assistant assets from `workers/gateway` under the transitional root PWA scope. Do not activate the independent `/assistant/` production route until the current LifeSpace-dependent Assistant work is ready.

`apps/health` is scaffold-only and may evolve in parallel. Do not invent health domain schemas, data-source semantics or authorization flows as part of scaffold work.

## Assistant architecture lens

For ALOHA Assistant, preserve the logical path:

`Assistant PWA -> Gateway -> Agent Control -> Runtime Adapter -> Runtime Backend -> Capability/Tool -> real execution`

Physical deployment may collapse some logical layers, but responsibilities remain explicit.

Keep these concepts separate:

- **Principal（权限主体）**: whose authority is being exercised;
- **Actor（执行者）**: who/what executes or initiates the operation;
- **Application Context（应用上下文）**: ALOHA as the application through which the operation occurs.

ALOHA may act for the user, but it does not gain authority merely because it is the Actor. Access to LifeSpace/HomeMew is bounded by verified user authority/delegation and ALOHA Application scope.

## Mandatory boundaries

### ALOHA vs HomeMew Agent

- ALOHA Assistant and HomeMew Agent are independent, peer Agent products.
- Do not make one Agent the internal implementation of the other.
- Reuse stable Capability / Tool / SDK / Protocol abstractions only when there is a real shared consumer.

### First-party clients

- ALOHA owns its personalized first-party client experiences.
- Assistant may evolve progressive/streaming Run state, approvals, artifacts, annotations and richer UI events as first-class interaction semantics.
- Domain PWAs may have completely different interaction models; do not force them into chat/Run semantics.
- Client-collected context such as location/device/selection is contextual evidence, not authorization authority.

### Gateway（网关）

- Keep Gateway thin: request admission, authentication handoff, channel adaptation, protocol normalization, session/stream transport, routing and transport controls.
- For Assistant, Gateway answers how requests enter/leave ALOHA, not how ALOHA reasons.
- Do not place model reasoning, Capability policy, confirmation policy, long-running workflow orchestration or domain ownership in Gateway.
- Do not route every new PWA domain through Gateway by default merely because it already exists.

### Agent Control（智能体控制层）

Agent Control owns Assistant product semantics around a Run: verified Identity/Principal context, authorization context, Context policy, ALOHA-managed Capability exposure policy, confirmation policy, Conversation / Run semantics, Runtime selection and canonical event normalization.

Agent Control is not a generic Agent Runtime / Framework and is not the default backend for every ALOHA domain screen.

### Runtime Contract / Runtime Backend

- Runtime Backend is replaceable; n8n Agent remains the MVP Runtime.
- Runtime-specific SDK/protocol/session/event details stay behind explicit Runtime Adapters.
- Do not force all runtimes into a lowest-common-denominator abstraction.
- Prompt/system instructions are behavior guidance, not an authorization boundary.
- Hard confinement requires credential isolation, ALOHA-mediated invocation, downstream authorization checks, or enforceable Runtime tool/sandbox controls.

### Capability（能力）

- A Runtime receives only ALOHA-managed capabilities exposed under verified authority and current Run policy.
- A Capability is an explicit callable boundary, not a place to copy another system's business logic into ALOHA.
- LifeSpace remains the Identity / Shared Reality authority for data it owns.
- HomeMew remains the family product/domain capability provider for HomeMew-owned behavior.
- Relay, Poina, Facet, 知了 and other shared infrastructure remain independently owned systems integrated through explicit contracts.

### Authorization and high-impact actions

- Never trust client-supplied `userId`, Principal IDs, Space IDs, grants or scopes as authorization authority.
- Authentication and authorization must be derived from verified credentials/context at a trusted boundary.
- Preserve Principal / Actor / Application attribution through Assistant Agent Control, Runtime and Capability calls.
- High-impact external sends, important mutations and irreversible actions require an explicit confirmation path unless a deliberately scoped automation policy says otherwise.
- Confirmation enforcement must happen in trusted code outside the model.

## Context Envelope（上下文信封）

For Assistant, treat context as structured product input, not merely prompt text. Categories may include server-verified Identity/Authorization context, environment/time/locale, device context, location with accuracy/timestamp/consent, interaction state/selection/annotation and resource references.

Context that can affect authority must come from trusted server-side sources. Client-provided context must remain distinguishable from verified context.

## Contract workflow

When changing externally observable behavior:

1. change the owning contract/type first when applicable;
2. update architecture/docs when a boundary changes;
3. update implementation;
4. add positive, failure and authorization/deny-path tests appropriate to the change;
5. verify compatibility across affected PWA, Gateway, Agent Control, Runtime Adapter and Capabilities.

Do not duplicate protocol shapes independently when they belong in `packages/contracts`.

## Repository discipline

- Keep each user-facing PWA in `apps/<surface>`.
- Keep independently deployable ALOHA edge/control services in `workers`.
- An assets-only PWA Worker configuration may be co-located with its app when the deployment unit belongs exclusively to that surface.
- Keep only ALOHA-internal reusable contracts/adapters in `packages`.
- Give concrete Runtime Adapters an explicit owning package; do not scatter provider-specific code across Gateway or Agent Control.
- Keep stable architectural decisions in `docs`; do not turn architecture documents into transient task logs.
- Keep live environment/resource identifiers and secrets outside source control.
- Prefer the smallest implementation that proves the next invariant; preserve real extension points rather than speculative frameworks.
- The old `aloha-assistant-pwa` repository is historical reference only, not a compatibility/migration baseline.

## Change completion

Before declaring a change complete, inspect the coupled surfaces that apply: PWA manifest/scope, UI, Interaction Protocol, Context, Gateway, Agent Control, Runtime Contract/Adapter, Capability registry/adapter, authentication/authorization, confirmation, streaming/error semantics, docs, tests and deployment configuration.

For every change, perform a public-repository safety pass over the diff: confirm that no private user data, credentials, live infrastructure details or non-public connector content was introduced.

At minimum run the repository `check` command once the environment supports it. If a check cannot run, state that explicitly and do not describe unverified behavior as working.
