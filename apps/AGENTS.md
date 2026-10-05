# Apps Agent Instructions

`apps/` contains user-facing ALOHA PWA surfaces.

Each first-party surface is independently developable and releasable, while remaining part of the same ALOHA product and LifeSpace Application Context.

## Rules

- Give each installable PWA its own app workspace under `apps/<surface>`.
- Each PWA owns its presentation, interaction ergonomics, local client state, manifest, install name, icons, path scope and client-side platform concerns.
- PWA scopes must not overlap in the target production topology. Do not use `/` as an installable scope once the independent multi-PWA routing cutover is complete.
- Keep apps independently buildable and releasable; one surface change must not require another surface release.
- All first-party PWA surfaces must support Mobile, Tablet and Desktop. Adapt information density/navigation/layout by viewport rather than treating Desktop as enlarged Mobile.
- Cross-surface visual language comes from `@aloha/design-tokens`, `@aloha/ui` and `docs/design-system.md`. Domain-specific UI remains inside the owning app.
- Share packages only for stable cross-surface contracts or primitives with real reuse. Do not create speculative shared frameworks before a second consumer exists.
- Do not move Agent reasoning, authorization authority or external-domain business ownership into an app.
- Client-visible permission checks are usability only, never the security boundary.
- Keep startup fast and the dependency surface small; ALOHA is a high-frequency personal tool.
- Read the nearest nested `AGENTS.md` before changing an app.
