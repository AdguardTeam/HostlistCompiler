/**
 * API Key Utilities
 *
 * Helpers for generating and managing API keys.
 * Keys are generated as random tokens and stored as SHA-256 hashes
 * in the database — the raw key is only returned once at creation time.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Result of API key generation.
 * The rawKey is only available at creation time.
 */
export interface GeneratedApiKey {
    /** The raw API key to give to the user (only shown once) */
    rawKey: string;
    /** SHA-256 hash of the key (stored in database) */
    keyHash: string;
    /** First 8 characters of the key (stored for identification) */
    keyPrefix: string;
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generates a new API key with its hash and prefix.
 *
 * Format: `abc_` + 48 random hex characters (e.g., `abc_a1b2c3d4e5f6...`)
 *
 * The `abc_` prefix makes keys easy to identify in logs and config files.
 * The 48 hex chars (192 bits of entropy) provide strong security.
 *
 * @returns Generated key with raw value, hash, and prefix
 *
 * @example
 * ```typescript
 * const key = await generateApiKey();
 * // Give key.rawKey to the user
 * // Store key.keyHash and key.keyPrefix in the database
 * ```
 */
export async function generateApiKey(): Promise<GeneratedApiKey> {
    // Generate 24 random bytes (192 bits of entropy) -> 48 hex chars
    const randomBytes = new Uint8Array(24);
    crypto.getRandomValues(randomBytes);

    const hexString = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const rawKey = `abc_${hexString}`;
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = await hashKey(rawKey);

    return { rawKey, keyHash, keyPrefix };
}

/**
 * Hashes an API key using SHA-256.
 * Uses the Web Crypto API available in Cloudflare Workers.
 */
export async function hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
