# ALOHA Assistant Design Notes

Cross-surface visual foundations are owned by [`docs/design-system.md`](../../docs/design-system.md), `@aloha/design-tokens` and `@aloha/ui`.

This file owns only Assistant-specific visual and interaction rules.

## Assistant-specific principles

- Keep the primary experience quiet, fast and state-first.
- Preserve the three-area interaction shell: Header, Current Work Surface and Composer.
- Assistant may remain visually sparse even when other ALOHA domain surfaces use dashboards, lists or denser structured layouts.
- Mobile / Tablet can prioritize touch and voice entry; Desktop can prioritize keyboard input and wider work surfaces.
- Use shared semantic tokens instead of creating an Assistant-only palette/spacing system.
- Assistant-specific interaction components such as Composer, pending resources, voice transcript overlays and generative work surfaces remain local unless stable reuse across another PWA is later proven.

## Current migration constraint

Assistant production still uses the transitional root PWA deployment. Do not change its scope to `/assistant/` until the LifeSpace-dependent migration is explicitly activated.
