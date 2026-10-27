# ALOHA Finance Agent Instructions

`apps/finance` is the ALOHA Finance PWA surface.

## Current phase

Finance is a development scaffold only. Establish the client experience and trusted domain/data contracts in a dedicated Finance development session before adding real financial behavior.

## Rules

- Keep Finance independently buildable and releasable from all other PWA surfaces.
- Keep its install identity scoped to `/finance/`.
- Consume `@aloha/design-tokens` and `@aloha/ui`; keep Finance-specific information architecture and domain components local.
- Design every implemented screen for Mobile, Tablet and Desktop; layouts may differ substantially by viewport.
- Do not invent account, transaction, budgeting, asset, liability or financial-sync schemas before the owning backend/source-of-truth decision is explicit.
- Do not route structured Finance data through Assistant Agent Control by default.
- Never commit real financial data, account identifiers, credentials or production examples.
- Browser-visible permission checks are UX only; trusted authorization remains server-side.
- The SVG icon is a development source asset; production installability review must add platform-appropriate raster/maskable icon assets.
