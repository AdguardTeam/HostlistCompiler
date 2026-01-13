/**
 * Checksum calculation utilities for filter lists.
 * Implements a secure checksum format using SHA-256 (instead of legacy MD5).
 */

/**
 * Calculates a checksum for a filter list.
 * The checksum is a Base64-encoded SHA-256 hash of the filter content.
 *
 * Implementation follows standard checksum practices:
 * 1. Join all lines (except the checksum line itself) with \n
 * 2. Calculate SHA-256 hash of the content
 * 3. Encode the hash as Base64
 * 4. Truncate to 27 characters for consistency with traditional MD5 checksums
 *
 * Note: We use SHA-256 instead of MD5 for better security, truncated to match
 * the traditional checksum length (MD5 base64 is exactly 24 chars, we use 27).
 *
 * @param lines - Array of filter list lines
 * @returns Base64-encoded SHA-256 checksum (truncated to 27 chars)
 */
export async function calculateChecksum(lines: string[]): Promise<string> {
    // Filter out any existing checksum lines and join with newlines
    const content = lines
        .filter((line) => !line.startsWith('! Checksum:'))
        .join('\n');

    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Calculate SHA-256 hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert hash to Base64
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64 = btoa(String.fromCharCode(...hashArray));

    // Truncate to 27 characters for consistency
    return base64.substring(0, 27);
}

/**
 * Adds a checksum line to the filter list header.
 * The checksum line should be inserted after the other metadata
 * and before the "Compiled by" line.
 *
 * @param lines - Array of filter list lines
 * @returns Array with checksum line added
 */
export async function addChecksumToHeader(lines: string[]): Promise<string[]> {
    // Calculate checksum of all lines
    const checksum = await calculateChecksum(lines);

    // Find where to insert the checksum line
    // It should go after metadata (Title, Description, etc.) but before "Compiled by"
    const compiledByIndex = lines.findIndex((line) => line.includes('! Compiled by'));

    if (compiledByIndex === -1) {
        // If no "Compiled by" line, add at the end of header section
        // Look for the first non-comment line or end of file
        const firstRuleIndex = lines.findIndex((line) =>
            line.trim() !== '' &&
            !line.startsWith('!')
        );

        const insertIndex = firstRuleIndex === -1 ? lines.length : firstRuleIndex;
        return [
            ...lines.slice(0, insertIndex),
            `! Checksum: ${checksum}`,
            ...lines.slice(insertIndex),
        ];
    }

    // Insert checksum before "Compiled by" line
    // Find the blank line before "Compiled by" or the "Compiled by" line itself
    let insertIndex = compiledByIndex;
    if (compiledByIndex > 0 && lines[compiledByIndex - 1] === '!') {
        insertIndex = compiledByIndex - 1;
    }

    return [
        ...lines.slice(0, insertIndex),
        `! Checksum: ${checksum}`,
        ...lines.slice(insertIndex),
    ];
}
