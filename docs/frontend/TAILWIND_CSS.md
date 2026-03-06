# Tailwind CSS v4 Integration

This document explains how Tailwind CSS v4 is integrated into the Angular frontend.

## Overview

Tailwind CSS v4 has been integrated into the Angular 21 frontend using a CSS-first,
PostCSS-based approach. v4 introduces significant changes from v3:

- **No config file required** — configuration lives in CSS via `@theme` and `@custom-variant`
- **Single import** — `@import "tailwindcss"` replaces the three `@tailwind` directives
- **New PostCSS plugin** — uses `@tailwindcss/postcss` instead of `tailwindcss` directly
- **Automatic content scanning** — no `content` array needed in config

## Configuration Files

### `.postcssrc.json`

PostCSS configuration using the v4 plugin:
```json
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

### `src/styles.css`

Tailwind is imported at the top of the global stylesheet, before Angular Material:
```css
@import "tailwindcss";

@custom-variant dark (&:where(body.dark-theme *, [data-theme='dark'] *));
```

The `@custom-variant dark` selector matches the existing ThemeService dark mode selectors
(`body.dark-theme` class and `html[data-theme='dark']` attribute).

## Material Design 3 Bridge (`@theme inline`)

The integration's key feature is a `@theme inline` block that maps Angular Material's
M3 role tokens to Tailwind CSS custom properties. This makes every Material token
available as a semantic Tailwind utility class.

```css
@theme inline {
    --color-primary: var(--mat-sys-primary);
    --color-on-surface: var(--mat-sys-on-surface);
    --color-surface-variant: var(--mat-sys-surface-variant);
    --color-on-surface-variant: var(--mat-sys-on-surface-variant);
    --color-error: var(--mat-sys-error);
    --color-outline: var(--mat-sys-outline);
    --font-sans: 'IBM Plex Sans', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --font-display: 'Syne', sans-serif;
    /* ... full list in styles.css */
}
```

### Why `inline`?

The `inline` keyword tells Tailwind v4 to resolve values at runtime rather than
build time. This is essential for integration with Angular Material M3 tokens, whose
CSS custom properties change value when the dark theme is applied — ensuring dark mode
works correctly with all generated Tailwind utilities.

### Generated utilities

Every `--color-*` entry generates `bg-*`, `text-*`, `border-*`, `ring-*`, and
`fill-*` utilities. Every `--font-*` entry generates `font-*` utilities.

| CSS variable | Example Tailwind classes |
|---|---|
| `--color-primary` | `bg-primary`, `text-primary`, `border-primary` |
| `--color-on-surface` | `text-on-surface` |
| `--color-surface-variant` | `bg-surface-variant` |
| `--color-on-surface-variant` | `text-on-surface-variant` |
| `--color-error` | `text-error`, `border-error` |
| `--color-tertiary` | `text-tertiary` |
| `--color-outline` | `border-outline` |
| `--font-sans` | `font-sans` (IBM Plex Sans) |
| `--font-mono` | `font-mono` (JetBrains Mono) |
| `--font-display` | `font-display` (Syne) |

## Usage in Components

Angular components use Tailwind utility classes directly in their inline templates.

### Semantic color classes (preferred)

Use the bridged Material token utilities instead of arbitrary CSS variable values:

```html
<!-- ✅ Preferred: semantic Tailwind class via @theme inline bridge -->
<div class="bg-surface-variant text-on-surface-variant">...</div>

<!-- ❌ Avoid: arbitrary value syntax — brittle and verbose -->
<div class="bg-[var(--mat-sys-surface-variant)] text-[var(--mat-sys-on-surface-variant)]">...</div>
```

### Layout and Spacing

```html
<!-- Flex row with gap -->
<div class="flex items-center gap-4">
  <span>Item 1</span>
  <span>Item 2</span>
</div>

<!-- Responsive grid -->
<div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
  <!-- Grid items -->
</div>
```

### Skeleton Loaders

Skeleton components use Tailwind's `animate-pulse` utility with Material surface tokens:
```html
<div class="h-[14px] rounded animate-pulse bg-surface-variant"></div>
```

### Dark Mode

Tailwind dark mode is wired to the same selectors as the existing ThemeService.
M3 token utilities (`bg-primary`, `text-on-surface`, etc.) automatically adapt because
the underlying CSS variables change at runtime when the dark theme activates — no
`dark:` prefix needed for Material-token-based utilities:

```html
<!-- M3 tokens: dark mode handled automatically via CSS variable swap -->
<div class="bg-surface-variant text-on-surface-variant">Always correct</div>

<!-- Standard Tailwind colors: use dark: prefix -->
<div class="bg-white dark:bg-zinc-900">Custom palette value</div>
```

## Integration Rules

| Concern | Use |
|---|---|
| Layout (flex, grid, spacing) | Tailwind utilities |
| Color (backgrounds, text, borders) | Semantic classes via `@theme inline` bridge |
| Typography size/weight | Tailwind (`text-sm`, `font-bold`) |
| Font family | `font-sans`, `font-mono`, `font-display` (bridged) |
| Angular Material components | Leave to Material — do not override with Tailwind |
| Hover/focus transforms, complex state | Component-scoped CSS in `styles: []` |

## Development Workflow

1. Add Tailwind classes directly to Angular component inline templates
2. Run `ng serve` — Angular CLI processes PostCSS automatically via `.postcssrc.json`
3. No separate CSS build step required

## Production

Angular CLI handles Tailwind's CSS tree-shaking automatically as part of the build process.
Only classes used in component templates are included in the final bundle.

## References

- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Tailwind v4 `@theme` reference](https://tailwindcss.com/docs/theme)
- [Angular guide for Tailwind](https://angular.dev/guide/tailwind)
- [Install Tailwind CSS with Angular](https://tailwindcss.com/docs/guides/angular)
