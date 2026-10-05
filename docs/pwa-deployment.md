# ALOHA Multi-PWA Deployment

This document records the deployment boundary for ALOHA's first-party PWA surfaces.

## Decision

ALOHA is one product and one LifeSpace Application Context with multiple independently installable and releasable PWA surfaces:

- ALOHA Assistant -> target `/assistant/`
- ALOHA Health -> `/health/`
- ALOHA Finance -> `/finance/`
- ALOHA Things -> `/things/`

Each surface owns its own manifest, icon set, static build and release cadence. The path scopes must not overlap.

## Target topology

```text
aloha.aisr.online/
  /assistant/*  -> aloha-app-assistant Worker
  /health/*     -> aloha-app-health Worker
  /finance/*    -> aloha-app-finance Worker
  /things/*     -> aloha-app-things Worker

shared API routes -> ALOHA Gateway Worker
                    -> Agent Control Worker where the Assistant Agent path applies
                    -> other trusted domain services/platform APIs as explicitly designed
```

The root path is not a fifth installable PWA. In the final topology it is a lightweight product entry point and may redirect to `/assistant/`.

## Shared versus independent

The PWA Workers are frontend/static deployment units, not separate ALOHA applications.

All first-party surfaces share:

- the same ALOHA product identity;
- the same LifeSpace Application Context;
- the same browser origin once production path routing is active;
- shared authentication/session behavior where the selected authentication mechanism is origin-scoped;
- shared design tokens/primitives and contracts where appropriate.

Each surface independently owns:

- UI and information architecture;
- manifest, install name and icons;
- `start_url` and PWA scope;
- static asset build;
- release and rollback.

A PWA split does not imply a backend split. Gateway and Agent Control remain shared only where their responsibilities apply. Structured domain PWAs must not be routed through Agent Control by default.

## Current deployment state

- **Assistant:** workspace is `apps/assistant`, but production remains on the legacy root-scope assets attached to `workers/gateway` until the LifeSpace-dependent migration is ready.
- **Health:** `apps/health`, scope `/health/`, assets-only Worker `aloha-app-health`, manual preview deployment available; no production route yet.
- **Finance:** `apps/finance`, scope `/finance/`, assets-only Worker `aloha-app-finance`, manual preview deployment available; no production route yet.
- **Things:** `apps/things`, scope `/things/`, assets-only Worker `aloha-app-things`, manual preview deployment available; no production route yet.

This allows Health, Finance and Things to develop/release preview builds without touching the current Assistant production deployment.

## Invariants

1. Production PWA scopes MUST NOT overlap.
2. A PWA Worker MUST NOT contain authorization authority, Agent reasoning or domain backend ownership merely because it serves that surface.
3. A failure or rollback of one independent PWA must not require redeploying unrelated PWA surfaces.
4. Adding a PWA surface does not create a new LifeSpace Application identity by default.
5. Shared origin/browser state is intentional; local persisted keys/databases must be namespaced to avoid accidental cross-surface collisions.
6. Every PWA must support Mobile, Tablet and Desktop, but layouts/navigation may differ by viewport.

## Production activation checklist per surface

Before binding a surface to `aloha.aisr.online/<surface>/*`:

- domain/data/API boundary is explicit where the surface needs backend data;
- trusted authentication/authorization path is explicit;
- manifest `id`, `start_url` and scope match the production path;
- final raster/maskable/Apple icon assets are supplied and tested;
- service worker and navigation fallback work under the path prefix;
- Mobile/Tablet/Desktop smoke checks pass;
- release and rollback are independent from unrelated surfaces;
- no live secrets or private user data are browser-bundled or committed.

Assistant additionally requires its LifeSpace-dependent migration/cutover decision before moving from `/` to `/assistant/`.
