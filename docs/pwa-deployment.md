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

  /settings*    -> aloha-app-settings Worker

Assistant Worker (thin Gateway) -> private aloha-agent-control Worker
Domain BFFs -> LifeSpace; shared application configuration -> Settings
```

The root path is not a fifth installable PWA. In the final topology it is a lightweight product entry point and may redirect to `/assistant/`.

## ALOHA Shared Settings route (non-installable utility)

`/settings/` is a **peer path** to `/health/` and `/assistant/`, not
`/health/hub/settings`. It does **not** create a fifth installable PWA or
additional LifeSpace Application Context. Its independently deployed Worker
`aloha-app-settings` serves `apps/settings`, a small UI based on
`@aloha/ui/AlohaHubSettings.vue` plus a scoped same-origin Identity/Core
BFF for profile and workspace onboarding. It must not overlap other surface PWA scopes.

**Production route (manual activation after review):**
`aloha.aisr.online/settings*` -> Settings Worker; Worker normalizes
`/settings` to `/settings/`. The route wildcard is needed to cover
assets and `/settings/api/*`; it also matches `/settings-other`,
which the Settings Worker must reject. Do not attach this route to the
transitional Assistant Gateway as an unreviewed side effect.

**Staging:** use the existing Settings named `staging` Preview, with its own automatically isolated `WorkspaceState` DO namespace. Production Health targets the production Settings read-only named `WorkspaceReader` Service Binding. Named Health Preview cannot bind a peer Preview; it uses an HTTPS GET to the existing Settings Preview's dedicated read-only endpoint, admitted by Cloudflare Access Service Auth, carrying the original user assertion independently verified by staging Identity. No browser-supplied user ID, no redirect or cross-environment fallback. Production does not serve this HTTP endpoint.

When a live cross-Preview experience is actually needed, deploy Settings Preview using `DEPLOY_ALOHA_SETTINGS_STAGING_PREVIEW`; retain its existing Access audience and staging secrets. Health Preview deployment discovers the existing named Health and Settings Preview URLs through Cloudflare metadata using the existing deployment credential, verifies both are deployed and share the same account suffix, and injects the Settings URL into the Health build and Preview-only runtime configuration. No manual `ALOHA_SETTINGS_STAGING_URL` variable is required for this workflow. Missing or mismatched Preview metadata fails closed. Create a narrowly scoped Access Service Token accepted by the Settings Preview Access application (Service Auth policy, preserve the human Allow policy), and store the Client ID and Client Secret in Health **Preview-only** secrets `ALOHA_SETTINGS_ACCESS_CLIENT_ID` and `ALOHA_SETTINGS_ACCESS_CLIENT_SECRET`. Do not use production credentials. Then deploy Health Preview; the workflow checks required binding names and rejects an unexpected production Service Binding. Do not commit or log the token.

Run [deploy-settings.yml](../.github/workflows/deploy-settings.yml) for the named Preview or separate main-only Production job. No new product or staging Worker, no automatic route or secret provisioning.

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

## Transitional Assistant root Service Worker / 根作用域缓存隔离

While the Assistant is served from the root `/`, its installable PWA has a
root-scoped Service Worker. A default Workbox SPA navigation fallback would
otherwise intercept requests to independently routed peer paths such as
`/health/` and `/settings/` and return the cached Assistant page, even when
the Cloudflare Workers Routes are correctly configured.

The temporary Assistant Workbox `navigateFallbackAllowlist` therefore
allows only `/` to use the Assistant offline shell. Health, Settings,
Finance, Things and their API routes must reach their own independently
deployed Workers. Keep this boundary in place until the separate
`/assistant/` PWA scope migration is explicitly approved. Existing clients
may need to visit/reload the Assistant root page to receive the updated
Service Worker; an incognito window can distinguish an existing stale
Service Worker from a server-side routing problem.

## Production-first release policy / 生产优先迭代

During the early, owner-operated product phase, Production is the default destination for completed functional changes. Named Preview is an optional UX exploration and experiment environment. It need not mirror every Production feature or backend integration, and no successful Preview deployment or Preview acceptance is a prerequisite for an ordinary Production release.

Default path: reviewed change → automated tests/typecheck/security checks → merge to main → affected Production workflow(s), including existing binding/build/dry-run gates → brief real-use smoke test and iteration. Release only affected units; deploy providers before consumers. Keep the prior recoverable version and distinguish code rollback from irreversible data changes. Do not use production personal records for destructive verification.

Preview path: use synthetic/demo data by default for UX prototypes and visual comparison. When a real backend is necessary, use only isolated Preview resources and staging credentials. Existing protected Named Previews remain available; no new Worker or forced production parity. Optional isolated testing remains appropriate for risky migrations, authority/security changes, sensitive writes or major cross-service changes. Those changes still require targeted verification, explicit risk review and a recovery plan; never waive security or data integrity gates.

Health/Settings keep their current explicit owner-dispatched, main-only Production workflows and confirmation parameters; Assistant's existing narrowly filtered auto-release remains unchanged. This decision does not introduce new automatic production deployments, activate routes, or change the release requirements of LifeSpace or HomeMew.

## Independent Production release pipelines / 生产独立发布

Shared code is not a shared deployment unit. `packages/ui` (including ALOHA Hub)
and `packages/design-tokens` are compiled into each consuming surface at that
surface's build time. Updating a shared component **does not** redeploy Health,
Settings or Assistant; release each affected consumer deliberately and separately.

| Unit | Staging / Preview | Production |
| --- | --- | --- |
| Health | `.github/workflows/deploy-health.yml` (Preview job) | `.github/workflows/deploy-health.yml` (Production job) |
| Settings (shared utility, not a PWA) | `.github/workflows/deploy-settings.yml` (Preview job) | `.github/workflows/deploy-settings.yml` (Production job) |
| Assistant / transitional Gateway | existing Assistant staging path | `.github/workflows/deploy.yml` |
| Finance, Things | their own Preview workflows | production workflows when ready |

Production Health and Settings releases are individually dispatched from
`main` using different workflows, each with its own confirmation and `production` environment gate.
Each workflow checks only its Worker bindings, validates/builds only its
workspace, and executes `wrangler deploy` in only that app directory.
Neither workflow deploys the other app, Assistant, Gateway or Agent Control.
Production route activation and Access are separate release steps.

The transitional `deploy.yml` retains its historic automatic
`push main` deployment **only for changes within `apps/assistant`, `workers/gateway` or
`workers/agent-control`**. Changes confined to
`apps/health`, `apps/settings`, `packages/ui`, design tokens, other shared packages or common
documentation **must not** trigger it. For shared-component changes,
perform normal CI then explicitly release only the consuming apps that
should receive the new version; do not broadcast deployments to all consumers.
This constraint applies even while Assistant is temporarily hosted by Gateway.

General CI may validate the whole repository on every PR or push, but CI
verification is not a Production deployment. Rollback remains per Worker.

## Health production model readiness / 健康模型上线门禁

Deploying the Health Worker does **not** publish LifeSpace models or grant the
ALOHA Application model access. These are separate Core control-plane changes
and must be reviewed through the LifeSpace **Production Console** before
declaring Health Production ready.

For the Health UI, the Production Core registry must have published definitions
for all seven native models:

- `health_concern`, `health_metric`, `health_observation`,
  `health_event`, `health_document`, `health_assessment`,
  `health_regimen`.

The Production ALOHA Application must then have the appropriate
**Application × Model Access** policy for all seven. The Health editor needs
`write` (which also enables reading); grants are not inferred from the
browser's Space choice. Validate that a verified current User has a linked
Space Person and that the usual Space membership/Grant rules independently
allow the intended operation.

**Do not copy D1 model registry rows, staging record data or generated model
tables directly into Production.** Publish reviewed canonical Model
Definitions through LifeSpace Console's Platform Admin API, which also builds
the typed storage and Model Contract. Keep Staging and Production application
credentials, Access audiences and Scope ceilings independent.

During Production smoke checks or optional isolated live validation, separately verify:
1. Settings explicitly creates or binds an available Space and persists the current cloud pointer in its per-user DO.
2. Health without a valid cloud binding navigates to Settings instead of selecting an arbitrary Space or reading a stale browser preference.
3. Health with a verified available Space can read the expected model snapshot
   (including an **empty** personal record set) without HTTP 404/403.
4. Health create/read/write still respects both ALOHA Application policy and
   LifeSpace's current Space/Person authority. No synthetic data is shown
   when the Production backend is unavailable.

A zero-model Production Registry or missing Application × Model Access is a
**failed platform-readiness check**, not a reason to redeploy Health or
circumvent the Core BFF. The Health UI must report missing model publication
separately from a missing record/Space. The existing Health Worker Release
remains isolated; control-plane publication is not another Health Worker deploy.

## Worker Production and named staging Preview

ALOHA uses one LifeSpace Application per environment: the production application for all production surfaces, and a shared Preview application for all staging surfaces. PWA deployments do not create additional LifeSpace Application identities.

Each PWA keeps **one Cloudflare Worker project** with two isolated deployments:

- **Production**: `wrangler deploy`, production-only bindings and secrets, released through an explicit production approval flow.
- **Staging / optional Preview**: `wrangler preview --name staging` publishes an isolated named Preview of each surface Worker. The Preview uses staging-only backend settings and credentials. The Preview workflow must never use `wrangler deploy`, which updates Production code.
- **State**: Preview-specific Durable Object classes and storage are automatically isolated from the production Durable Object namespace. Keep DO migrations at the Worker root and declare the Preview DO bindings under `previews.durable_objects.bindings` when the Worker code needs them.
- **Preview hostnames**: Production surfaces share a single product origin with distinct paths. In staging, each PWA uses its own Cloudflare-provided named Preview URL and Worker-level Access policy; there is no shared staging ingress. Register each required Preview Access Audience under the single staging LifeSpace Application. Cross-surface browser origins remain distinct in staging.
- **Security**: A Preview does not inherit production secrets. Never share credentials or use request parameters to switch LifeSpace environments. Protect each Preview URL with Cloudflare Access; authorize user requests using its signed assertion and the staging application's configured Access Audiences.
- **Infrastructure**: Preview resources are an environment of the same Worker project, not a separately named Worker or a second LifeSpace Application. Staging browser surfaces are accessed directly. Explicit read-only backend integrations may use authenticated HTTPS to the intended peer Preview; do not use a Preview Service Binding to production.

This is the policy for each independently released ALOHA PWA. Health and Settings have separate Preview and Production jobs within their own individual workflows; migration/bootstrap-only jobs have been retired. The Assistant's temporary Gateway hosting remains a separate migration constraint.

## Native staging Preview URLs

Each independently deployed PWA can use its Cloudflare named `staging` Preview URL directly. The URL has the form `https://staging-<worker>.<account>.workers.dev/<surface>/`. Cloudflare Access protects the corresponding `preview_worker` destination and produces a signed identity assertion. Register that Access Audience with the shared staging LifeSpace Application; the application itself and its model permissions remain shared across ALOHA surfaces.

This keeps staging deployment simple, but **staging PWAs have separate browser origins**. Do not rely on shared cookies or local storage across staging surfaces. Production remains a shared product origin with path-scoped independent PWA Workers; verify origin-specific integrations in the selected environment, with Production smoke checks for the actual production topology. No staging reverse proxy is required. For the explicit Health-to-Settings backend read, use a Preview-only Access Service Token; ordinary browser sign-in remains unchanged.

## Current deployment state

- **Assistant:** workspace is `apps/assistant`, but production remains on the legacy root-scope assets attached to `workers/gateway` until the LifeSpace-dependent migration is ready.
- **Health:** `apps/health`, scope `/health/`, a single Worker project with a named `staging` Preview. The LifeSpace BFF and user-scoped SQLite-backed DO presentation data are merged into `main`; the public Production route and full same-origin acceptance remain separate activation gates.
- **Finance:** `apps/finance`, scope `/finance/`, assets-only Worker `aloha-app-finance`, manual preview deployment available; no production route yet.
- **Things:** `apps/things`, scope `/things/`, assets-only Worker `aloha-app-things`, manual preview deployment available; no production route yet.

This allows Health, Finance and Things to develop/release Preview builds without touching the current Assistant Production deployment. The audited GitHub Actions workflow inventory and public-log policy are in [Actions security](./actions-security.md).

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
