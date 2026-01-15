/**
 * Centralized version management for the adblock-compiler package.
 * This ensures version consistency across all modules.
 */

/**
 * Package version - should match deno.json
 * Updated automatically by version bump scripts.
 */
export const VERSION = '0.8.3';

/**
 * Package name as published to JSR
 */
export const PACKAGE_NAME = '@jk-com/adblock-compiler';

/**
 * Package metadata for headers and identification
 */
export const PACKAGE_INFO = {
    name: PACKAGE_NAME,
    version: VERSION,
} as const;

/**
 * User agent string for HTTP requests
 */
export const USER_AGENT: string = `${PACKAGE_NAME}/${VERSION} (Deno)`;
