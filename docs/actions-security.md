# GitHub Actions public-repository security baseline

ALOHA is a public AGPL repository. Actions workflow YAML, job logs, build
summaries, PR metadata and uploaded artifacts may all be publicly accessible.
Do not put user records, Access assertions, LifeSpace credentials, cookies,
API tokens, live configuration payloads or private infrastructure identifiers
in the repository or workflow output.

## Maintained workflows

| File | Trigger | Production deployment boundary |
| --- | --- | --- |
| `ci.yml` | PR and main push | No deployment or runtime credentials; typecheck/tests/build + full-history redacted secret scan |
| `deploy.yml` | main push for Assistant-owned paths, or manual main dispatch | Assistant client + its transitional Gateway and Agent Control only |
| `deploy-health.yml` | manual dispatch | Health-only named Preview **or** Health-only Production job |
| `deploy-settings.yml` | manual dispatch | Settings-only named Preview **or** Settings-only Production job |
| `deploy-finance.yml` | manual dispatch | Finance-only named Preview, no Production job |
| `deploy-things.yml` | manual dispatch | Things-only named Preview, no Production job |

Finance and Things development scaffolds expose only explicit `deploy:staging`
commands; neither ships an unguarded `deploy` script that publishes Production.

No joint Health/Settings deployment. No Worker rename, secret generation,
one-time runtime bootstrap or old M1/M2 fallback is run during normal releases.
Common Hub/`@aloha/ui` code is bundled when each consuming app is explicitly
released, never deployed as a separate runtime or automatically broadcast to
unrelated apps. `deploy.yml` keeps Assistant's current Gateway migration
boundary without deploying any other app.

## Required safety controls

1. **Least privilege:** PR CI has only `contents: read` and does not receive
   deployment secrets. No `pull_request_target`, `workflow_run` or other
   privileged untrusted-code entrypoint. Only explicitly reviewed deployment
   jobs receive Cloudflare credentials, through their own `preview` or
   `production` GitHub Environment. Production Health/Settings dispatches
   require `main` plus a distinct exact confirmation.
2. **No secret values in output:** Cloudflare API responses are parsed in
   memory, checking only binding **names**. Do not print entire response
   bodies, tokens, headers, environment dumps or URLs with embedded secrets.
   Do not enable shell tracing, verbose curl or upload deployment logs as
   public artifacts.
3. **Quiet/sanitized CLI:** Set `WRANGLER_LOG=error`,
   `WRANGLER_LOG_SANITIZE=true` and `WRANGLER_SEND_METRICS=false` for
   deployment jobs. Avoid a wrapper Action when local Wrangler already
   supports the operation; pin supported first-party Actions to full
   reviewed commit SHAs, not floating tags. While this repository has no
   lockfile, disable setup-node v6 automatic package-manager caching, and use
   the Wrangler package installed by the workspace rather than an ad hoc
   `npx --yes` download.
4. **Fail closed:** Verify the Production target Worker and required binding
   **names** before deploying. Do not initialize/replace signing keys during
   normal deployment; rotate only by an explicit operational procedure.
   Environment activation, hostname routes and Access policy changes are
   separate reviewable operations, not side effects of an app release.
5. **Ongoing checks:** `npm run check` executes
   `scripts/check-release-isolation.mjs` and `ci.yml` runs Gitleaks over
   full Git history with redaction. This guards workflow inventory, pinned
   Action references, least-privilege triggers, suppressed dangerous
   logging and per-app boundaries. PR checks remain credential-free.
6. **Operational access:** Restrict who can change workflow files or
   approve the `production` GitHub Environment. Where supported, use
   environment-scoped Cloudflare API tokens with the minimum Worker scope;
   a GitHub Environment declaration alone **does not guarantee** required
   reviewers are configured.

## Audit scope and limitations (2026-10-30)

The audit reviewed the YAML source of every currently maintained Actions
workflow and the deployment-related scripts they invoke. Two recent
successfully completed job logs (Assistant deployment and Settings Preview)
were checked for unmasked bearer/JWT/token patterns and account-ID-bearing
Cloudflare API URLs; no matching exposure was observed in those samples.
This is **not** proof that every historical run, archived artifact, expired
log, provider response or workflow from earlier commits was free of sensitive
information. The Gitleaks history scan covers repository commits, not all
historical Actions logs.

GitHub environment approval/branch-protection configuration, token scope,
and the precise upstream error text Wrangler may emit at runtime are external
controls that source code alone cannot certify. If a real disclosure is
suspected, stop deployments, revoke/rotate affected credentials and inspect
the relevant historical public Actions runs separately.

No Production app was deployed and no public hostname route was activated
as part of this workflow audit.
