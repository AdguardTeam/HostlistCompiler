/**
 * Utilities for filtering out redundant metadata headers from filter lists.
 * This prevents upstream source headers from appearing in the compiled output.
 */

/**
 * List of metadata header prefixes that should be removed from upstream sources.
 * These headers are specific to the upstream source and should not be included
 * in the compiled list, as they will be replaced by our own headers.
 */
const METADATA_HEADER_PREFIXES = [
    '! Title:',
    '! Description:',
    '! Homepage:',
    '! License:',
    '! Version:',
    '! Last modified:',
    '! Expires:',
    '! TimeUpdated:',
    '! Checksum:',
    '! Compiled by ', // Note the trailing space to make it more specific
    '! Diff-Path:',
    '! Diff-Expires:',
];

/**
 * Checks if a line is a metadata header that should be filtered out.
 * 
 * @param line - The line to check
 * @returns True if the line is a metadata header that should be removed
 */
function isMetadataHeader(line: string): boolean {
    const trimmed = line.trim();
    
    // Check if line matches any metadata header prefix
    for (const prefix of METADATA_HEADER_PREFIXES) {
        if (trimmed.startsWith(prefix)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Filters out upstream metadata headers from a filter list.
 * 
 * This function removes metadata headers that are specific to the upstream source
 * (like Title, Description, Compiled by, etc.) while preserving:
 * - Actual filter rules
 * - Informational comments about the rules themselves
 * - Standalone comment markers (!)
 * 
 * The function intelligently handles header sections by removing consecutive
 * metadata headers while preserving the structure of the list.
 * 
 * @param lines - Array of filter list lines
 * @returns Array with metadata headers removed
 */
export function stripUpstreamHeaders(lines: string[]): string[] {
    const result: string[] = [];
    let inHeaderSection = true;
    let consecutiveEmptyComments = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Check if this is a metadata header
        if (isMetadataHeader(line)) {
            // Skip this line - it's an upstream metadata header
            continue;
        }
        
        // Track consecutive empty comment markers (!) at the start
        if (trimmed === '!' && inHeaderSection) {
            consecutiveEmptyComments++;
            // Skip excessive empty comment markers in header (keep max 1)
            if (consecutiveEmptyComments > 1) {
                continue;
            }
            result.push(line);
            continue;
        }
        
        // If we encounter a non-comment line or a substantive comment, we're out of the header
        if (trimmed !== '' && !trimmed.startsWith('!')) {
            inHeaderSection = false;
            consecutiveEmptyComments = 0;
            result.push(line);
            continue;
        }
        
        // If it's a comment but not a metadata header, keep it
        if (trimmed.startsWith('!') && trimmed !== '!') {
            // This is a substantive comment (e.g., section descriptions)
            // Only keep it if it doesn't look like a metadata header
            consecutiveEmptyComments = 0;
            result.push(line);
            continue;
        }
        
        // For empty lines, just pass through
        if (trimmed === '') {
            result.push(line);
            continue;
        }
        
        // Default: keep the line
        result.push(line);
    }
    
    // Clean up leading empty comment markers efficiently
    let leadingEmptyCount = 0;
    while (leadingEmptyCount < result.length && result[leadingEmptyCount].trim() === '!') {
        leadingEmptyCount++;
    }
    
    if (leadingEmptyCount > 0) {
        result = result.slice(leadingEmptyCount);
    }
    
    return result;
}

/**
 * Checks if a line appears to be part of a source header that should be removed.
 * This is more aggressive than isMetadataHeader and can be used for additional filtering.
 * 
 * @param line - The line to check
 * @returns True if the line looks like it's part of an upstream header
 */
export function looksLikeUpstreamHeader(line: string): boolean {
    const trimmed = line.trim();
    
    // Metadata headers
    if (isMetadataHeader(line)) {
        return true;
    }
    
    // Empty comment markers at the very start
    if (trimmed === '!') {
        return false; // Let stripUpstreamHeaders handle these contextually
    }
    
    return false;
}
