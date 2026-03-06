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

## Usage in Components

Angular components use Tailwind utility classes directly in their inline templates.

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

Skeleton components use Tailwind's `animate-pulse` utility:
```html
<div class="h-[14px] rounded mb-[10px] animate-pulse bg-[var(--mat-sys-surface-variant)]"></div>
```

This leverages CSS custom properties from the Material Design 3 token system.

### Dark Mode

```html
<div class="bg-white dark:bg-zinc-900 text-black dark:text-white">
  Adapts to the active theme
</div>
```

Dark mode applies when `body.dark-theme` class or `[data-theme='dark']` attribute is present.

## Integration with Angular Material

Tailwind utilities work alongside Angular Material components:
- Material components handle their own theming via `--mat-sys-*` tokens
- Tailwind handles layout, spacing, and utility styling
- CSS custom properties from `styles.css` can be used as arbitrary values: `bg-[var(--app-primary)]`

## Development Workflow

1. Add Tailwind classes directly to Angular component inline templates
2. Run `ng serve` — Angular CLI processes PostCSS automatically via `.postcssrc.json`
3. No separate CSS build step required

## Production

Angular CLI handles Tailwind's CSS tree-shaking automatically as part of the build process.
Only classes used in component templates are included in the final bundle.

## References

- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Angular guide for Tailwind](https://angular.dev/guide/tailwind)
- [Install Tailwind CSS with Angular](https://tailwindcss.com/docs/guides/angular)
