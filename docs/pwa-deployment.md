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

## ALOHA Shared Settings route (non-installable utility)

`/settings/` is a **peer path** to `/health/` and `/assistant/`, not
`/health/hub/settings`. It does **not** create a fifth installable PWA or
additional LifeSpace Application Context. Its independently deployed Worker
`aloha-app-settings` serves `apps/settings`, a small UI based on
`@aloha/ui/AlohaHubSettings.vue` plus a read-only same-origin Identity/Core
BFF. It must not overlap other surface PWA scopes.

**Production route (manual activation after review):**
`aloha.aisr.online/settings*` -> Settings Worker; Worker normalizes
`/settings` to `/settings/`. The route wildcard is needed to cover
assets and `/settings/api/*`; it also matches `/settings-other`,
which the Settings Worker must reject. Do not attach this route to the
transitional Assistant Gateway as an unreviewed side effect.

**Staging:** protected named `staging` Preview of the Settings Worker.
The Preview hostname differs from Health/Assistant Preview hosts.
Set GitHub **preview environment variables** `ALOHA_SETTINGS_STAGING_URL`
and `ALOHA_HEALTH_STAGING_URL` to the exact already-issued Preview
destinations when exercising cross-Preview navigation; those values are
public URLs, not credentials. Production builds use same-origin `/settings/`.
Browser localStorage does **not** traverse Staging Preview origins. Thus
cross-app Space-preference persistence must be tested under a shared
origin separately before Production activation.

Run [`deploy-settings.yml`](../.github/workflows/deploy-settings.yml)
using the exact staging confirmation, after the named Settings Worker
Preview has the required Access policy and **preview-only** Identity/Core
configuration. An optional one-time no-public-route runtime bootstrap
is separately gated by explicit Production environment approval, just
as the Health Worker. It does not publish `/settings` or install a
Production route.

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

## Worker Production and named staging Preview

ALOHA uses one LifeSpace Application per environment: the production application for all production surfaces, and a shared Preview application for all staging surfaces. PWA deployments do not create additional LifeSpace Application identities.

Each PWA keeps **one Cloudflare Worker project** with two isolated deployments:

- **Production**: `wrangler deploy`, production-only bindings and secrets, released through an explicit production approval flow.
- **Staging**: `wrangler preview --name staging` publishes an isolated named Preview of each surface Worker. The Preview uses staging-only backend settings and credentials. The Preview workflow must never use `wrangler deploy`, which updates Production code.
- **State**: Preview-specific Durable Object classes and storage are automatically isolated from the production Durable Object namespace. Keep DO migrations at the Worker root and declare the Preview DO bindings under `previews.durable_objects.bindings` when the Worker code needs them.
- **Preview hostnames**: Production surfaces share a single product origin with distinct paths. In staging, each PWA uses its own Cloudflare-provided named Preview URL and Worker-level Access policy; there is no shared staging ingress. Register each required Preview Access Audience under the single staging LifeSpace Application. Cross-surface browser origins remain distinct in staging.
- **Security**: A Preview does not inherit production secrets. Never share credentials or use request parameters to switch LifeSpace environments. Protect each Preview URL with Cloudflare Access; authorize user requests using its signed assertion and the staging application's configured Access Audiences.
- **Infrastructure**: Preview resources are an environment of the same Worker project, not a separately named Worker or a second LifeSpace Application. Staging surfaces are accessed directly, without Worker-to-Worker proxying.

This is the target policy for every independently released ALOHA PWA. The Health BFF Preview is the first implementation; other PWA deployment workflows should adopt the same split before handling staging data. The Assistant's temporary Gateway hosting remains a separate migration constraint.

## Optional one-time runtime bootstrap for an existing assets-only Worker

Some Workers were originally deployed with static assets only. When a Preview later adds an actual runtime entrypoint and bindings, the dashboard may still present the old assets-only settings view. For this migration, the Health deployment workflow includes an **explicitly confirmed one-time Production runtime bootstrap** that publishes the complete Worker bundle but does **not** activate any production hostname or route.

This exception is intentionally limited: the Worker configuration must set `workers_dev: false`, `preview_urls: true`, have a runtime `main` entrypoint and no production `route`, `routes` or `vars`. The bootstrap must pass typechecks/tests and a Wrangler dry-run before deploying. Do not install Preview credentials on Production or treat the bootstrap as a release of the Health product. The existing named `staging` Preview and its isolated storage are separate.

**Dashboard caveat:** This bootstrap may allow the Dashboard to recognize a script-based Worker. It does not guarantee that Cloudflare's current UI can edit secrets scoped to an already-created individual Preview. The Dashboard documents **Previews Base** configuration; Base changes apply to newly created Previews, not existing ones. Always confirm the selected environment and whether the change targets an existing Preview or only the Base template.

## Native staging Preview URLs

Each independently deployed PWA can use its Cloudflare named `staging` Preview URL directly. The URL has the form `https://staging-<worker>.<account>.workers.dev/<surface>/`. Cloudflare Access protects the corresponding `preview_worker` destination and produces a signed identity assertion. Register that Access Audience with the shared staging LifeSpace Application; the application itself and its model permissions remain shared across ALOHA surfaces.

This keeps staging deployment simple, but **staging PWAs have separate browser origins**. Do not rely on shared cookies or local storage across staging surfaces. Production remains a shared product origin with path-scoped independent PWA Workers; validate origin-specific integrations separately before launch. No staging reverse proxy or cross-Worker service token is required.

## Current deployment state

- **Assistant:** workspace is `apps/assistant`, but production remains on the legacy root-scope assets attached to `workers/gateway` until the LifeSpace-dependent migration is ready.
- **Health:** `apps/health`, scope `/health/`, a single Worker project with a named `staging` Preview. Draft branch adds same-origin LifeSpace BFF and separately bound, user-scoped SQLite-backed DO presentation data; no production route or online acceptance yet.
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
