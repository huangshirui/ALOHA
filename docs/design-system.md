# ALOHA Cross-Surface Design Language

This document is the source of truth for the visual language shared by ALOHA's first-party PWA surfaces.

The goal is **one recognizable ALOHA family, not one identical UI**. Assistant, Health, Finance and Things may use different navigation, information architecture and domain components while sharing the same visual foundations and interaction quality.

## Shared foundation

Cross-surface values live in:

- `@aloha/design-tokens` — semantic colors, typography, spacing, radius, elevation, control size, motion and surface accents;
- `@aloha/ui` — minimal domain-neutral CSS presentation primitives that already have multiple consumers.

Do not create a large component framework in advance. Repeated markup should become a shared Vue component only after at least two real surfaces prove that its behavior and accessibility contract are stable.

## Surface identity

Each PWA keeps its own install name, path, icon and accent while remaining visually related:

| Surface | Install name | Accent role | Target scope |
| --- | --- | --- | --- |
| ALOHA Assistant | `Assistant` | blue | `/assistant/` after migration |
| ALOHA Health | `Health` | green UI / distinct Health app icon | `/health/` |
| ALOHA Finance | `Finance` | amber | `/finance/` |
| ALOHA Things | `Things` | violet | `/things/` |

The accent differentiates surfaces; neutral colors, typography rhythm, spacing, radii, elevation and interaction feedback remain shared.

## Responsive baseline

Every first-party PWA must be intentionally designed for all three layout classes:

- **Mobile / compact:** `< 48rem` — touch-first, usually single-column, lower information density.
- **Tablet / medium:** `48rem–74.999rem` — touch remains first-class; use two-column or master/detail layouts where useful.
- **Desktop / wide:** `>= 75rem` — keyboard/mouse friendly, higher information density, multi-column or persistent navigation where useful.

These are layout modes, not device detection. A surface may choose different navigation and composition in each mode. Desktop must not be implemented as merely a stretched mobile screen.

## Shared interaction rules

- Minimum primary touch/control target should be around the shared `--aloha-control-*` scale; small visual glyphs still need an adequately sized hit area.
- Keyboard focus must remain visible.
- Safe-area insets must be respected on installed mobile/tablet PWAs.
- Honor `prefers-reduced-motion`.
- Semantic color must not be the only carrier of state.
- Loading, empty, error and disabled states should use the shared visual language even when their domain meaning is surface-specific.

## Tokens

Use semantic variables from `packages/design-tokens/tokens.css`. Do not copy raw palette values into app components when a semantic token already exists.

Surface roots set `data-aloha-surface="assistant|health|finance|things"` so accent tokens inherit naturally without creating separate theme systems.

Example imports:

```ts
import '@aloha/design-tokens/tokens.css'
import '@aloha/ui/styles.css'
```

## What stays local to each PWA

The following remain owned by the surface unless stable reuse is later proven:

- navigation model and information architecture;
- page/screen layouts;
- charts and domain visualizations;
- Assistant Composer / Current Work Surface;
- Health health-domain components;
- Finance financial components;
- Things item/space/maintenance components;
- domain-specific empty states and workflows.

## PWA icon assets

Each surface owns its own icon source. The repository currently includes distinct SVG development source icons so every scaffold has an identity from day one.

Before a surface is considered production-installable, create and verify platform-appropriate raster/maskable assets (including 192px/512px where required) and Apple Home Screen assets. Do not rely on the development SVG alone for final cross-platform install quality.

## Change rule

When a visual decision is specific to one PWA, keep it in that app. Promote it into the shared foundation only when it is clearly part of the ALOHA family language and has at least two real consumers.
