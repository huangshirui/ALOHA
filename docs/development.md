# Development baseline

## Runtime/toolchain

- Node.js: 22.12+
- Package manager: npm 10
- Workspace layout: npm workspaces
- PWA clients: Vue 3 + Vite + `vite-plugin-pwa`
- Shared edge/control services: Cloudflare Workers + Wrangler
- Assistant Agent Runtime Backend: **n8n Agent for the MVP**, reached through `@aloha/runtime-n8n`

ALOHA now contains multiple first-party PWA workspaces. A PWA surface is a release unit, not a separate LifeSpace Application.

## App workspaces

```text
apps/assistant/   # existing ALOHA Assistant PWA
apps/health/      # ALOHA Health scaffold
```

Future surfaces follow the same `apps/<surface>` pattern when their product scope becomes concrete.

### Assistant

Assistant currently keeps its existing production behavior while the LifeSpace-dependent upgrade is unfinished:

- local workspace: `apps/assistant`;
- production PWA scope: still transitional `/`;
- production static assets: still deployed with `workers/gateway`;
- independent `/assistant/` Worker/route activation: deferred.

Do not use unrelated repository work to force this cutover.

### Health

Health is intentionally scaffold-only:

- local workspace: `apps/health`;
- PWA `id`, `start_url`, scope: `/health/`;
- build output: `apps/health/dist/health`;
- Worker deployment unit: `aloha-app-health` via `apps/health/wrangler.jsonc`;
- current deployment: independent Worker preview only;
- production `/health/*` route: not activated.

No health model, data source or API path is implied by this scaffold.

## Install and run

```bash
npm install

npm run dev:assistant
npm run dev:health
npm run dev:gateway
npm run dev:agent-control
```

Build individual surfaces independently:

```bash
npm run build:assistant
npm run build:health
```

Repository-wide validation remains:

```bash
npm run check
```

`check` performs workspace typechecks/tests, validates public runtime assets and builds all workspaces that expose a build command.

## Assistant local integration

The Assistant app calls the Gateway only. During local Vite development, `/v1` is proxied to `http://127.0.0.1:8787`. `VITE_GATEWAY_URL` remains available for separately hosted Assistant variants and contains no credential.

Gateway uses an `AGENT_CONTROL` Service Binding（服务绑定） to reach Agent Control.

Agent Control selects the n8n Agent Runtime Adapter when `N8N_AGENT_WEBHOOK_URL` is configured. An optional `N8N_AGENT_AUTH_TOKEN` is sent by the adapter as a bearer credential. Both are deployment configuration and must never be committed with live values.

M2 Direct Capability invocation additionally uses `CAPABILITY_GRANT_SIGNING_KEY` on Agent Control. If the key is absent, ordinary Runtime execution remains available but the Runtime receives an empty ALOHA-managed Capability set.

The public repository intentionally contains no real n8n endpoint, token, capability signing key, temporary capability grant or workflow execution data.

## Health development rule

Until a health-domain decision explicitly exists, Health development is limited to client/runtime scaffolding and generic product-shell work.

Do not add speculative schemas for health records, metrics, medications, labs, device sync or medical documents. Do not choose a backend path by copying the Assistant Agent-Control path.

Before real Health data behavior is implemented, define at minimum:

1. domain/model ownership and source of truth;
2. trusted browser API/BFF path;
3. identity/authorization and attribution semantics;
4. read/write and sync behavior;
5. which operations, if any, enter the Agent path.

## Repository validation

Pull-request CI (`.github/workflows/ci.yml`) validates the whole repository so shared-contract regressions are still caught across workspaces.

Independent release workflows may validate only the surface they deploy plus any required shared dependency checks. This allows one PWA to release without coupling its deployment to another PWA.

## Runtime development rule

Do not add generic Agent-loop logic to `workers/agent-control`. The model/reasoning/tool loop for the Assistant MVP belongs to the selected n8n Agent workflow.

When integrating or evolving an Assistant Runtime:

1. define the minimum ALOHA Runtime Contract required by the concrete use case;
2. keep provider/backend-specific protocol and session/event translation inside an explicit Runtime Adapter;
3. keep verified identity/authorization, Context, Capability exposure, confirmation policy and Conversation/Run product semantics in Agent Control;
4. keep backend-native runtime mechanics in the Runtime Backend unless ALOHA intentionally promotes them into its stable contract;
5. add contract tests for behavior ALOHA actually depends on.

Do not assume these Agent Runtime rules define the data path for Health or another structured PWA surface.

## Lockfile policy

The initial remote scaffold was created without executing a package-manager install, so `package-lock.json` is not yet committed. Until it exists, CI uses `npm install` and does not enable npm dependency caching.

At the first local dependency install:

1. run `npm install` with the declared Node/npm baseline;
2. commit the generated `package-lock.json`;
3. change CI to `npm ci` and enable npm cache;
4. thereafter treat lockfile changes as part of dependency changes.

## Environment and secrets

- Never commit `.env`, `.dev.vars`, tokens or provider credentials.
- Add `.env.example` / `.dev.vars.example` only with synthetic placeholders when local setup needs one.
- Keep staging and production Worker bindings/resources separate.
- Browser code must never receive trusted service/application credentials.
- `VITE_GATEWAY_URL` may be browser-visible because it is only a route; it must never carry credentials or delegated authority.
- Runtime Backend credentials/endpoints remain deployment-only configuration.
- `N8N_AGENT_AUTH_TOKEN` and `CAPABILITY_GRANT_SIGNING_KEY` are secrets and must use the deployment platform's secret mechanism.
- Short-lived Capability Grants must never be committed or logged into public artifacts.

## Cloudflare deployment

### Transitional production deployment

`.github/workflows/deploy.yml` still deploys the existing Assistant stack after code reaches `main`:

1. verify the repository;
2. build `apps/assistant`;
3. deploy Agent Control;
4. deploy Gateway together with the Assistant static assets;
5. run the existing Assistant runtime acceptance gates where applicable.

Current transitional topology:

```text
Assistant Browser
  -> aloha-edge Worker
       |- Assistant Static Assets (temporary coupling)
       |- /v1/* Gateway API
       `- AGENT_CONTROL Service Binding
            -> aloha-agent-control Worker
                 -> n8n Agent Runtime / Assistant capabilities
```

`workers/gateway/wrangler.jsonc` points its static-assets directory at `apps/assistant/dist`. This keeps production behavior stable after the repository rename from `apps/web`.

### Health independent preview deployment

`.github/workflows/deploy-health.yml` is manually dispatched and independently:

1. installs repository dependencies;
2. typechecks only `@aloha/health`;
3. builds only Health;
4. deploys `apps/health/wrangler.jsonc` as the `aloha-app-health` Worker.

The Health Worker currently exposes only its Worker preview endpoint. The workflow intentionally does not configure `aloha.aisr.online/health/*`.

This preview path validates independent development/release mechanics without creating a production routing dependency.

### Target production deployment

After the staged migration is complete:

```text
aloha.aisr.online/assistant/* -> Assistant PWA Worker
aloha.aisr.online/health/*    -> Health PWA Worker
aloha.aisr.online/finance/*   -> Finance PWA Worker

shared API/Agent routes       -> Gateway where applicable
                                -> Agent Control where Agent semantics apply
```

Each PWA can deploy and roll back without redeploying unrelated PWAs or the shared backend.

## GitHub deployment credentials

For the current single Cloudflare account deployment, workflows use repository secrets:

- `CLOUDFLARE_API_TOKEN` — dedicated least-privilege token; never use a Global API Key;
- `CLOUDFLARE_ACCOUNT_ID` — deployment account identifier kept outside public source.

Fork/PR code must not receive deployment secrets. Do not add `pull_request_target` or privileged deployment of untrusted pull-request code.

Runtime-specific Assistant secrets remain on the Agent Control Worker, including:

- `N8N_AGENT_WEBHOOK_URL`
- `N8N_AGENT_AUTH_TOKEN`
- `CAPABILITY_GRANT_SIGNING_KEY`

Secret values must never appear in workflow YAML, Wrangler config, logs or repository documentation.

## Definition of done for scaffold/architecture changes

A scaffold or architecture change is complete only when the relevant `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/pwa-deployment.md`, workspace scripts, CI validation and deployment configs remain consistent.

For a new PWA surface, additionally verify:

- unique manifest identity/name;
- non-overlapping target path scope;
- independent build;
- independent deployment unit;
- no accidental new LifeSpace Application identity;
- no speculative domain/backend ownership introduced by the scaffold.
