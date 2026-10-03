# ALOHA Health Agent Instructions

`apps/health` is the ALOHA Health PWA surface.

## Current phase

Health is currently a product/runtime scaffold only. The goal of this phase is to prove the independent PWA workspace, path scope and release boundary without prematurely defining the health domain model or backend integration.

## Rules

- Keep Health independently buildable and releasable from Assistant and other ALOHA PWA surfaces.
- Keep the install identity scoped to `/health/`; do not broaden the PWA scope to `/`.
- Do not introduce health records, metrics, medication, lab, device-sync or other domain schemas until their owning contract and source of truth are explicitly decided.
- Do not route non-Agent health data through Agent Control merely because it already exists. The Health data/API path is a separate architectural decision.
- Never put private health data, production examples, credentials or real user content in this public repository.
- Browser-visible permission checks are UX only; trusted authorization must remain server-side.
- Keep startup fast, dependencies small and Mobile/Desktop responsive.
- Health must eventually have its own final PWA icon set; placeholder or missing icon assets are not a release-complete state.
