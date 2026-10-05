# ALOHA Things Agent Instructions

`apps/things` is the ALOHA Things PWA surface.

## Current phase

Things is a development scaffold only. Define the actual object/space/maintenance product boundary and its data ownership in a dedicated Things development session before implementing domain behavior.

## Rules

- Keep Things independently buildable and releasable from all other PWA surfaces.
- Keep its install identity scoped to `/things/`.
- Consume `@aloha/design-tokens` and `@aloha/ui`; keep Things-specific information architecture and domain components local.
- Design every implemented screen for Mobile, Tablet and Desktop; layouts may differ substantially by viewport.
- Do not invent item, space, inventory, maintenance or lifecycle schemas before the source-of-truth/domain ownership decision is explicit.
- Do not route structured Things data through Assistant Agent Control by default.
- Never commit real household inventories, serial numbers, private locations, credentials or production examples.
- Browser-visible permission checks are UX only; trusted authorization remains server-side.
- The SVG icon is a development source asset; production installability review must add platform-appropriate raster/maskable icon assets.
