/**
 * postbuild.js — run automatically by npm after `npm run build`
 *
 * Angular's SSR build with RenderMode.Client routes outputs the SPA shell as
 * `index.csr.html` instead of `index.html`.  Both the Cloudflare Worker ASSETS
 * binding and Cloudflare Pages expect the SPA entry point to be named `index.html`,
 * so we copy it over here.
 *
 * The Angular browser output directory is resolved in this priority order:
 *   1. CLI argument:              node scripts/postbuild.js <browser-output-dir>
 *   2. Environment variable:      ANGULAR_BROWSER_OUTPUT_PATH=<browser-output-dir>
 *   3. Default (this project):    dist/adblock-compiler/browser
 */

const fs = require('fs');
const path = require('path');

// Allow overriding the Angular browser output directory via CLI arg or env var.
// Priority: CLI arg > ANGULAR_BROWSER_OUTPUT_PATH env var > default path.
const cliBrowserDir = process.argv[2];
const envBrowserDir = process.env.ANGULAR_BROWSER_OUTPUT_PATH;
const browserDir = cliBrowserDir
    ? path.resolve(cliBrowserDir)
    : envBrowserDir
        ? path.resolve(envBrowserDir)
        : path.join(__dirname, '..', 'dist', 'adblock-compiler', 'browser');

if (!fs.existsSync(browserDir)) {
    console.error(
        `[postbuild] Expected Angular browser output directory "${browserDir}" not found.\n` +
        '           The Angular "outputPath" or project name may have changed.\n' +
        '           Set the correct path via CLI (e.g. "node scripts/postbuild.js <browser-output-dir>")\n' +
        '           or the ANGULAR_BROWSER_OUTPUT_PATH environment variable.',
    );
    process.exit(1);
}

const src = path.join(browserDir, 'index.csr.html');
const dst = path.join(browserDir, 'index.html');

if (!fs.existsSync(src)) {
    // index.csr.html is only generated when Angular SSR is configured with
    // RenderMode.Client routes. If it is absent but the browser output
    // directory exists, this usually indicates a configuration mismatch.
    console.error(
        `[postbuild] Expected CSR shell "${src}" not found.\n` +
        '           Ensure Angular SSR is configured with RenderMode.Client routes\n' +
        '           or update the postbuild script/output path configuration.',
    );
    process.exit(1);
}

fs.copyFileSync(src, dst);
console.log('[postbuild] Copied index.csr.html -> index.html');
