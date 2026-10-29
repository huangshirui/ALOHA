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

## Worker Production and named staging Preview

ALOHA uses one LifeSpace Application per environment: the production application for all production surfaces, and a shared Preview application for all staging surfaces. PWA deployments do not create additional LifeSpace Application identities.

Each PWA keeps **one Cloudflare Worker project** with two isolated deployments:

- **Production**: `wrangler deploy`, production-only bindings and secrets, released through an explicit production approval flow.
- **Staging**: `wrangler preview --name staging` publishes an isolated named Preview of each surface Worker. The Preview uses staging-only backend settings and credentials. The Preview workflow must never use `wrangler deploy`, which updates Production code.
- **State**: Preview-specific Durable Object classes and storage are automatically isolated from the production Durable Object namespace. Keep DO migrations at the Worker root and declare the Preview DO bindings under `previews.durable_objects.bindings` when the Worker code needs them.
- **Shared sign-in / ingress**: All production surfaces are routed under the same product origin at their distinct paths; similarly, the target staging experience uses **one shared staging origin and Cloudflare Access login** for its PWA paths. Do not create a separate end-user Access application for every surface. A separate staging origin avoids mixing staging with production at one host. The shared staging front door and route dispatch are an additional integration step, **not automatically provided by independently named Worker Previews**. Until it exists, direct Worker Preview URLs must also be access-controlled or disabled; a front-door login alone does not secure bypass URLs.
- **Security**: A Preview does not inherit production secrets. Never share credentials or use a request URL/query parameter to switch the LifeSpace environment. Cloudflare Preview service bindings target a bound Worker's production deployment, not another Worker's Preview; configure any staging dispatch path explicitly and validate that it cannot reach production accidentally.
- **Infrastructure**: Preview resources are an environment of the same Worker project, not a separately named Worker or a second LifeSpace Application. Any required binding to an external Worker must point explicitly to a staging service.

This is the target policy for every independently released ALOHA PWA. The Health BFF Preview is the first implementation; other PWA deployment workflows should adopt the same split before handling staging data. The Assistant's temporary Gateway hosting remains a separate migration constraint.

## Optional one-time runtime bootstrap for an existing assets-only Worker

Some Workers were originally deployed with static assets only. When a Preview later adds an actual runtime entrypoint and bindings, the dashboard may still present the old assets-only settings view. For this migration, the Health deployment workflow includes an **explicitly confirmed one-time Production runtime bootstrap** that publishes the complete Worker bundle but does **not** activate any production hostname or route.

This exception is intentionally limited: the Worker configuration must set `workers_dev: false`, `preview_urls: true`, have a runtime `main` entrypoint and no production `route`, `routes` or `vars`. The bootstrap must pass typechecks/tests and a Wrangler dry-run before deploying. Do not install Preview credentials on Production or treat the bootstrap as a release of the Health product. The existing named `staging` Preview and its isolated storage are separate.

**Dashboard caveat:** This bootstrap may allow the Dashboard to recognize a script-based Worker. It does not guarantee that Cloudflare's current UI can edit secrets scoped to an already-created individual Preview. The Dashboard documents **Previews Base** configuration; Base changes apply to newly created Previews, not existing ones. Always confirm the selected environment and whether the change targets an existing Preview or only the Base template.

## Shared staging ingress (implementation candidate)

The shared staging hostname requires a **separate, small ingress Worker** to route the product's path-scoped PWAs. The first supported path is `/health/*`; every other path fails closed until its independently deployed surface is ready.

The ingress does not use Service Bindings to target downstream Worker Previews: Cloudflare currently routes those bindings to **production**, not the matching Preview. Instead, it makes an explicit HTTPS request to a single configured **named `staging` Worker Preview URL**, with the `global_fetch_strictly_public` compatibility flag. It only accepts a fixed-form `staging-*.workers.dev` upstream host; it cannot turn the request URL into an arbitrary proxy target.

There are two distinct Access checks: the shared browser-facing hostname validates the product user's Access identity, and the downstream Preview requires a dedicated **service-token policy** in addition to its private browser policy. The ingress sends the service token to the downstream Access layer while preserving the original user-signed Access assertion in a private hop header. The Health BFF sends this original proof to LifeSpace Identity for signature, audience and account validation; it never treats the ingress as an independent user authorization authority. On unsafe HTTP methods, the ingress validates the browser Origin and normalizes it for the internal upstream hop; the Health BFF still validates the internal hop Origin.

Required runtime configuration on the **shared ingress Worker only**: `ACCESS_AUDIENCE`, `HEALTH_PREVIEW_URL`, `UPSTREAM_ACCESS_CLIENT_ID` and `UPSTREAM_ACCESS_CLIENT_SECRET` (last two as Secrets). Each Health Worker Preview retains its own separate `LIFESPACE_APPLICATION_CREDENTIAL`; never copy it to the ingress. All actual hostnames, audience IDs and secrets must stay in private Cloudflare configuration. Neither the ingress nor the Health Preview is enabled for real data until its end-to-end Access and Origin checks pass.

The ingress is deployed as its own staging-only Worker with `workers_dev: false` and **no public route in source**. Its manual deployment does not create DNS or attach the shared custom domain. Configure and validate the product-level Cloudflare Access application before binding the hostname; verify that the downstream service-token request is actually accepted, that public bypass URLs are blocked and that the original user assertion reaches the trusted BFF. If a probe fails, do not expose the shared hostname to real health data.

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
