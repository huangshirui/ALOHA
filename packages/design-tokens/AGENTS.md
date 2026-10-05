# Design Tokens Agent Instructions

`packages/design-tokens` owns the smallest stable visual language shared by ALOHA PWA surfaces.

## Rules

- Keep this package framework-agnostic and CSS-first.
- Tokens describe semantic roles, not a specific screen or domain widget.
- Preserve one common neutral/typography/spacing/radius/motion system while allowing each surface its own accent tokens.
- Every token added here must be useful to at least two PWA surfaces or represent a cross-surface accessibility/responsive invariant.
- Do not add health, finance, things or Assistant product semantics here.
- Breaking token changes require checking every `apps/*` consumer.
