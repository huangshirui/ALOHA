# ALOHA Shared Settings (非独立 PWA)

The `/settings/` route is an ALOHA shared product utility. It is **not** a separate LifeSpace application, Identity provider, user directory, or installable PWA.

- Serve the shared settings UI and strictly scoped same-origin BFF. It owns explicit ALOHA workspace onboarding only: resolve current binding, create ordinary Space or bind an existing current member Space through Core. Own the per-user SQLite-backed WorkspaceState Durable Object in this Worker. Only Settings may mutate; other authenticated ALOHA BFFs use the named WorkspaceReader Service Binding (read only). Never create a second user/Space authority.
- All access to LifeSpace Identity and Core uses verified Cloudflare Access -> Identity token exchange server-side. Never trust a userId/Space membership from browser input.
- Do not create user/Space identity databases or use cookies shared across subdomains.
- `/settings/` must not overlap `/health/` or `/assistant/` installation scope. Do not import Health-specific code.
- Keep staged and production backend credentials isolated; no real data, infrastructure IDs or credentials in source/tests/logs.
- Preserve Settings as a non-installable web route, while application PWAs remain independently deployable.
