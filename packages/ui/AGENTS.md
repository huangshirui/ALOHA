# Shared UI Agent Instructions

`packages/ui` contains only stable, domain-neutral presentation primitives shared by multiple ALOHA PWA surfaces.

## Rules

- Keep the package intentionally small. CSS primitives are preferred until repeated component behavior proves a Vue abstraction is stable.
- Depend on semantic tokens from `@aloha/design-tokens`; never introduce a second visual token system.
- Do not encode domain navigation, information architecture or business state here.
- Responsive primitives must work across Mobile, Tablet and Desktop.
- Accessibility is part of the primitive contract: focus visibility, touch target size and reduced-motion behavior must not regress.
- A new shared component requires at least two concrete consumers and a stable interaction contract.
