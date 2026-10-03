# ALOHA Multi-PWA Deployment

This document records the deployment boundary for ALOHA's first-party PWA surfaces.

## Decision

ALOHA is one product and one LifeSpace Application Context, but it may expose multiple independently installable PWA surfaces such as:

- ALOHA Assistant -> `/assistant/`
- ALOHA Health -> `/health/`
- ALOHA Finance -> `/finance/`
- future ALOHA domain surfaces -> their own non-overlapping path scopes

Each PWA surface is independently developable and independently releasable.

## Deployment boundary

Each PWA surface MUST have its own Cloudflare Worker deployment for static assets and its own non-overlapping route scope.

Conceptually:

```text
aloha.aisr.online/
  /assistant/*  -> aloha-app-assistant Worker
  /health/*     -> aloha-app-health Worker
  /finance/*    -> aloha-app-finance Worker
  /.../*        -> corresponding PWA Worker

shared API routes -> ALOHA Gateway Worker
                    -> Agent Control Worker
                    -> Runtime / Capabilities
```

The root path is not an installable PWA scope. It should remain a lightweight product entry point and may redirect to `/assistant/`.

## Shared versus independent

The PWA Workers are deployment units, not separate ALOHA applications.

All first-party PWA surfaces share:

- the same ALOHA product identity;
- the same LifeSpace Application Context;
- the same origin, authentication/session model and browser-origin storage boundary;
- the same Gateway and Agent Control services;
- shared packages/contracts/design primitives where appropriate.

Each PWA surface independently owns:

- its UI and interaction model;
- its manifest, install name and icons;
- its `start_url` and PWA scope;
- its static asset build;
- its release cadence and rollback.

## Why multiple PWA Workers

Attaching all PWA assets to one Gateway Worker would make the frontend deployment atomic: changing one PWA would require redeploying the shared asset bundle. That conflicts with the requirement that Assistant, Health, Finance and future surfaces can be developed and released independently.

The Gateway therefore remains a shared transport/API boundary and must not become the release container for every PWA's static assets.

## Invariants

1. PWA route scopes MUST NOT overlap.
2. A PWA Worker MUST NOT contain Agent reasoning, authorization authority or domain backend logic.
3. Gateway and Agent Control remain shared backend services unless a separate future architectural decision changes that boundary.
4. Adding a new PWA surface does not create a new LifeSpace Application identity by default.
5. A failure or rollback of one PWA deployment should not require redeploying unrelated PWA surfaces or the shared backend.

## Migration note

The current MVP physically serves `apps/web/dist` from `workers/gateway`. That remains the current implementation until the multi-PWA deployment structure is implemented. The target state is to detach first-party static assets from Gateway and deploy each PWA surface independently.
