/**
 * postbuild.js — run automatically by npm after `npm run build`
 *
 * Angular's SSR build with RenderMode.Client routes outputs the SPA shell as
 * `index.csr.html` instead of `index.html`.  Both the Cloudflare Worker ASSETS
 * binding and Cloudflare Pages expect the SPA entry point to be named `index.html`,
 * so we copy it over here.
 *
 * This script is safe to run multiple times: if index.html already exists it is
 * simply overwritten with the latest CSR build output.
 */

const fs = require('fs');
const path = require('path');

const browserDir = path.join(__dirname, '..', 'dist', 'adblock-compiler-poc', 'browser');
const src = path.join(browserDir, 'index.csr.html');
const dst = path.join(browserDir, 'index.html');

if (!fs.existsSync(src)) {
    // index.csr.html is only generated when Angular SSR is configured with
    // RenderMode.Client routes.  If it is absent the build either uses a
    // different render mode or the output path changed — nothing to do.
    console.log('[postbuild] index.csr.html not found; skipping index.html copy.');
    process.exit(0);
}

fs.copyFileSync(src, dst);
console.log('[postbuild] Copied index.csr.html -> index.html');
