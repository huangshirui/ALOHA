# Apps Agent Instructions

`apps/` contains user-facing ALOHA PWA surfaces.

Each first-party surface is independently developable and releasable, while remaining part of the same ALOHA product and LifeSpace Application Context.

## Rules

- Give each installable PWA its own app workspace under `apps/<surface>`.
- Each PWA owns its presentation, interaction ergonomics, local client state, manifest, install name, icons, path scope and client-side platform concerns.
- PWA scopes must not overlap in the target production topology. Do not use `/` as an installable scope once the independent multi-PWA routing cutover is complete.
- Keep apps independently buildable and releasable; a Health-only change must not require an Assistant release, and vice versa.
- Share packages only for stable cross-surface contracts or primitives with real reuse. Do not create speculative shared frameworks before a second consumer exists.
- Do not move Agent reasoning, authorization authority or external-domain business ownership into an app.
- Client-visible permission checks are usability only, never the security boundary.
- Keep startup fast and the dependency surface small; ALOHA is a high-frequency personal tool.
- Read the nearest nested `AGENTS.md` before changing an app.
