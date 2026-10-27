# ALOHA Assistant Agent Instructions

`apps/assistant` is the ALOHA Assistant PWA surface.

## Rules

- Optimize first for very fast startup and high-frequency Mobile / Tablet / Desktop use.
- Preserve the three-area interaction shell: header, interaction stage and input/composer; exact visual design may evolve.
- Keep input/output interaction state separate from Agent reasoning state. The PWA renders and sends intent; it does not implement the Agent loop.
- Communicate through the Gateway（网关）contract only. Do not call Agent Runtime internals or external domain services directly from browser code unless the architecture is deliberately changed.
- Never place trusted application/service credentials in browser-delivered code.
- Permission-based hiding is UX only; server-side authorization remains authoritative.
- Consume shared visual foundations from `@aloha/design-tokens` and `@aloha/ui`; keep Assistant-specific interaction/layout rules local.
- `DESIGN.md` owns Assistant-specific visual/interaction additions, while `docs/design-system.md` owns cross-surface design language.
- Maintain accessible controls, safe-area handling and responsive behavior across Mobile, Tablet and Desktop.
- Until the LifeSpace upgrade required by the current Assistant work is complete, do not activate the independent `/assistant/` production route or expand Assistant product behavior as part of unrelated multi-PWA work.
