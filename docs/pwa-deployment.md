# ALOHA Multi-PWA Deployment

This document records the deployment boundary for ALOHA's first-party PWA surfaces.

## Decision

ALOHA is one product and one LifeSpace Application Context, but it may expose multiple independently installable PWA surfaces such as:

- ALOHA Assistant -> `/assistant/`
- ALOHA Health -> `/health/`
- ALOHA Finance -> `/finance/`
- future ALOHA domain surfaces -> their own non-overlapping path scopes

Each PWA surface is independently developable and independently releasable.

## Target deployment boundary

Each PWA surface MUST have its own Cloudflare Worker deployment for static assets and its own non-overlapping route scope.

Conceptually:

```text
aloha.aisr.online/
  /assistant/*  -> aloha-app-assistant Worker
  /health/*     -> aloha-app-health Worker
  /finance/*    -> aloha-app-finance Worker
  /.../*        -> corresponding PWA Worker

shared API routes -> ALOHA Gateway Worker
                    -> Agent Control Worker where Agent semantics are required
                    -> Runtime / Capabilities
```

The root path is not an installable PWA scope in the target topology. It should remain a lightweight product entry point and may redirect to `/assistant/`.

## Shared versus independent

The PWA Workers are deployment units, not separate ALOHA applications.

All first-party PWA surfaces share:

- the same ALOHA product identity;
- the same LifeSpace Application Context;
- the same origin, authentication/session model and browser-origin storage boundary once mounted on `aloha.aisr.online`;
- shared backend/platform capabilities where applicable;
- shared packages/contracts/design primitives only when there is stable cross-surface reuse.

Each PWA surface independently owns:

- its UI and interaction model;
- its manifest, install name and icons;
- its `start_url` and PWA scope;
- its static asset build;
- its release cadence and rollback.

A surface does not automatically use Agent Control merely because Assistant does. Non-Agent domain API/data paths must be explicitly designed for the owning surface/domain.

## Why multiple PWA Workers

Attaching all PWA assets to one Gateway Worker would make the frontend deployment atomic: changing one PWA would require redeploying the shared asset bundle. That conflicts with the requirement that Assistant, Health, Finance and future surfaces can be developed and released independently.

The Gateway therefore remains a shared transport/API boundary and must not become the long-term release container for every PWA's static assets.

## Invariants

1. PWA route scopes MUST NOT overlap in the target topology.
2. A PWA Worker MUST NOT contain Agent reasoning, authorization authority or domain backend logic merely for deployment convenience.
3. Gateway and Agent Control remain shared backend services where their responsibilities apply; PWA release boundaries do not imply backend duplication.
4. Adding a new PWA surface does not create a new LifeSpace Application identity by default.
5. A failure or rollback of one PWA deployment should not require redeploying unrelated PWA surfaces or the shared backend.
6. Production route activation is a separate step from creating a buildable/deployable PWA workspace.

## Current staged migration

The repository has now moved from `apps/web` to explicit PWA workspaces:

```text
apps/assistant/
apps/health/
```

### Assistant

`apps/assistant` owns the existing Assistant client, but its production deployment remains transitional:

- the current production manifest/scope still uses `/`;
- `workers/gateway` still serves the built Assistant static assets;
- production deployment remains coupled to the existing Gateway/Agent-Control workflow;
- the independent `/assistant/` Worker/route cutover is intentionally deferred until the LifeSpace-dependent Assistant work is ready.

This preserves current production behavior while removing the old generic `apps/web` ownership ambiguity.

### Health

`apps/health` is the first surface built directly for the target model:

- PWA identity/name: `ALOHA Health` / `Health`;
- `id`, `start_url` and scope: `/health/`;
- build output mirrors the `/health/` path for Worker static-asset routing;
- `aloha-app-health` is an independent assets Worker deployment unit;
- the `Deploy Health PWA Preview` workflow can deploy it independently to a Worker preview endpoint;
- the production `aloha.aisr.online/health/*` route is intentionally not activated yet.

Health currently contains only a UI/runtime scaffold. Health domain models, data sources, API paths and final icon assets are separate future decisions.
