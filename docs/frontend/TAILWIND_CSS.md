# Tailwind CSS Integration

This document explains how Tailwind CSS is integrated into the Adblock Compiler project.

## Overview

Tailwind CSS v3.4 has been integrated into the frontend to provide a utility-first CSS framework alongside the existing custom styles. The integration uses PostCSS and is configured to work with all HTML files in the `public/` directory.

## Configuration Files

### `tailwind.config.js`

The Tailwind configuration includes:
- **Content paths**: Scans all HTML and JS files in `public/` directory
- **Dark mode**: Configured to use both `class` and `[data-theme="dark"]` strategies
- **Custom colors**: Extends Tailwind's color palette with project-specific colors:
  - `primary`: `#667eea` (with `dark` and `light` variants)
  - `secondary`: `#764ba2` (with `dark` variant)

### `postcss.config.js`

Simple PostCSS configuration that includes:
- `tailwindcss`: Processes Tailwind directives
- `autoprefixer`: Adds vendor prefixes for browser compatibility

### `public/input.css`

The source CSS file that imports Tailwind directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Build Scripts

The following npm scripts are available for building Tailwind CSS:

```bash
# Build CSS for development
npm run build:css

# Build CSS and watch for changes
npm run build:css:watch

# Build minified CSS for production
npm run build:css:prod
```

## Integration with Existing Styles

Tailwind CSS is loaded **before** the existing `shared-styles.css` in the HTML files:

```html
<!-- Tailwind CSS -->
<link rel="stylesheet" href="/tailwind.css">
<!-- Shared styles -->
<link rel="stylesheet" href="/shared-styles.css">
```

This order ensures:
1. Tailwind's base styles and utilities are available
2. Custom styles in `shared-styles.css` can override Tailwind when needed
3. Both systems work together harmoniously

## Usage Examples

### Using Tailwind Classes

You can now use Tailwind utility classes in your HTML:

```html
<!-- Flexbox layout -->
<div class="flex items-center justify-between gap-4">
  <!-- Content -->
</div>

<!-- Custom colors -->
<button class="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded">
  Click me
</button>

<!-- Responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <!-- Grid items -->
</div>
```

### Dark Mode

Tailwind is configured to work with the existing dark mode system:

```html
<!-- Will apply dark mode styles when data-theme="dark" -->
<div class="bg-white dark:bg-gray-800 text-black dark:text-white">
  Content
</div>
```

### Custom Colors

Use the project's custom colors:

```html
<div class="bg-primary text-white">Primary background</div>
<div class="bg-secondary text-white">Secondary background</div>
<div class="bg-gradient-to-r from-primary to-secondary">Gradient</div>
```

## Development Workflow

1. **Edit HTML files** in the `public/` directory with Tailwind classes
2. **Rebuild CSS** using `npm run build:css` or `npm run build:css:watch`
3. **Generated CSS** is saved to `public/tailwind.css` (gitignored)
4. **Test changes** using `npm run dev` to start the development server

## Production Build

Before deploying:

```bash
npm run build:css:prod
```

This generates a minified version of the CSS with only the classes used in your HTML files, keeping the file size minimal.

## File Structure

```
.
├── tailwind.config.js          # Tailwind configuration
├── postcss.config.js            # PostCSS configuration
├── public/
│   ├── input.css                # Tailwind source file (tracked in git)
│   ├── tailwind.css             # Generated CSS (gitignored)
│   ├── shared-styles.css        # Existing custom styles
│   ├── index.html               # Updated with Tailwind link
│   ├── compiler.html            # Updated with Tailwind link
│   └── ...                      # Other HTML files
├── package.json                 # Contains build scripts
└── .gitignore                   # Excludes public/tailwind.css
```

## Benefits

- **Utility-first approach**: Rapid UI development with pre-built utilities
- **Small file size**: Only includes CSS for classes actually used
- **Responsive design**: Built-in responsive utilities
- **Dark mode support**: Integrated with existing dark mode system
- **Customization**: Extended with project-specific colors
- **Compatibility**: Works alongside existing custom CSS

## Troubleshooting

### CSS not updating

If your changes aren't reflected:
1. Rebuild CSS: `npm run build:css`
2. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
3. Check that `public/tailwind.css` exists

### Classes not working

If Tailwind classes don't apply:
1. Ensure the HTML file is in the `content` paths in `tailwind.config.js`
2. Rebuild CSS after adding new classes
3. Check browser console for CSS loading errors

### Build errors

If the build fails:
1. Ensure dependencies are installed: `npm install`
2. Check that Node.js and npm are available
3. Verify `tailwind.config.js` and `postcss.config.js` syntax

## References

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Tailwind CSS Customization](https://tailwindcss.com/docs/configuration)
