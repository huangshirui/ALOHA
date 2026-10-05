# ALOHA Health Agent Instructions

`apps/health` is the ALOHA Health PWA surface.

## Current phase

Health is currently a product/runtime scaffold only. The goal is to provide a production-quality development foundation without prematurely defining the health domain model or backend integration.

## Rules

- Keep Health independently buildable and releasable from Assistant and other ALOHA PWA surfaces.
- Keep the install identity scoped to `/health/`; do not broaden the PWA scope to `/`.
- Consume `@aloha/design-tokens` and `@aloha/ui` for shared design language; keep Health-specific information architecture and domain components local.
- Design every implemented screen for Mobile, Tablet and Desktop. Responsive adaptation may change navigation/layout rather than merely scale the same screen.
- Do not introduce health records, metrics, medication, lab, device-sync or other domain schemas until their owning contract and source of truth are explicitly decided.
- Do not route non-Agent health data through Agent Control merely because it already exists. The Health data/API path is a separate architectural decision.
- Never put private health data, production examples, credentials or real user content in this public repository.
- Browser-visible permission checks are UX only; trusted authorization must remain server-side.
- Keep startup fast and dependencies small.
- The SVG icon is a development source asset; production installability review must add platform-appropriate raster/maskable icon assets.
