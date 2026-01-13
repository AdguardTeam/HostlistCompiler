/**
 * Utilities for working with URLs and file paths.
 * Centralizes path detection and resolution logic to eliminate duplication.
 */

/**
 * URL schemes that indicate a remote resource
 */
const URL_SCHEMES = ['http://', 'https://'] as const;

/**
 * Regex pattern for Windows absolute paths (e.g., C:\, D:\)
 */
const WINDOWS_ABSOLUTE_PATH_REGEX = /^[a-zA-Z]:[/\\]/;

/**
 * Utility class for working with URLs and file paths.
 */
export class PathUtils {
    /**
     * Checks if a string is a valid URL (http or https).
     * @param source - String to check
     * @returns True if source is a URL
     */
    public static isUrl(source: string): boolean {
        return URL_SCHEMES.some((scheme) => source.startsWith(scheme));
    }

    /**
     * Checks if a string is an absolute file path.
     * Supports both Unix (/path) and Windows (C:\path) absolute paths.
     * @param path - Path to check
     * @returns True if path is absolute
     */
    public static isAbsolutePath(path: string): boolean {
        // Unix absolute path
        if (path.startsWith('/')) return true;
        // Windows absolute path (C:\, D:\, etc.)
        if (WINDOWS_ABSOLUTE_PATH_REGEX.test(path)) return true;
        return false;
    }

    /**
     * Checks if a source is a local file path (not a URL).
     * @param source - Source to check
     * @returns True if source is a local file path
     */
    public static isLocalPath(source: string): boolean {
        return !PathUtils.isUrl(source);
    }

    /**
     * Resolves a relative path against a base URL or file path.
     * Handles both URL resolution and file path resolution.
     * @param includePath - Path to resolve
     * @param basePath - Base path/URL to resolve against
     * @returns Resolved absolute path/URL
     */
    public static resolveIncludePath(includePath: string, basePath: string): string {
        // If include path is already absolute, use it directly
        if (PathUtils.isAbsolutePath(includePath) || PathUtils.isUrl(includePath)) {
            return includePath;
        }

        if (PathUtils.isUrl(basePath)) {
            // Resolve relative URL
            try {
                const baseUrl = new URL(basePath);
                return new URL(includePath, baseUrl).toString();
            } catch {
                // If URL parsing fails, return the include path as-is
                return includePath;
            }
        } else {
            // Resolve relative file path
            const lastSeparatorIndex = Math.max(
                basePath.lastIndexOf('/'),
                basePath.lastIndexOf('\\'),
            );
            const baseDir = lastSeparatorIndex >= 0
                ? basePath.substring(0, lastSeparatorIndex + 1)
                : '';
            return baseDir + includePath;
        }
    }

    /**
     * Gets the directory portion of a path.
     * @param path - Full path to a file
     * @returns Directory path (with trailing separator)
     */
    public static getDirectory(path: string): string {
        const lastSlash = path.lastIndexOf('/');
        const lastBackslash = path.lastIndexOf('\\');
        const lastSeparator = Math.max(lastSlash, lastBackslash);

        if (lastSeparator < 0) {
            return '';
        }

        return path.substring(0, lastSeparator + 1);
    }

    /**
     * Gets the filename from a path or URL.
     * @param path - Full path or URL
     * @returns Filename without directory
     */
    public static getFilename(path: string): string {
        if (PathUtils.isUrl(path)) {
            try {
                const url = new URL(path);
                const pathname = url.pathname;
                const lastSlash = pathname.lastIndexOf('/');
                return lastSlash >= 0 ? pathname.substring(lastSlash + 1) : pathname;
            } catch {
                return path;
            }
        }

        const lastSlash = path.lastIndexOf('/');
        const lastBackslash = path.lastIndexOf('\\');
        const lastSeparator = Math.max(lastSlash, lastBackslash);

        return lastSeparator >= 0 ? path.substring(lastSeparator + 1) : path;
    }

    /**
     * Normalizes a path by converting backslashes to forward slashes.
     * @param path - Path to normalize
     * @returns Normalized path with forward slashes
     */
    public static normalize(path: string): string {
        return path.replace(/\\/g, '/');
    }

    /**
     * Joins path segments together with the appropriate separator.
     * @param segments - Path segments to join
     * @returns Joined path
     */
    public static join(...segments: string[]): string {
        return segments
            .filter((s) => s.length > 0)
            .join('/')
            .replace(/\/+/g, '/');
    }

    /**
     * Gets the host from a URL, or null if not a URL.
     * @param source - Source to extract host from
     * @returns Host string or null
     */
    public static getHost(source: string): string | null {
        if (!PathUtils.isUrl(source)) {
            return null;
        }

        try {
            const url = new URL(source);
            return url.host;
        } catch {
            return null;
        }
    }

    /**
     * Sanitizes a URL by removing sensitive query parameters.
     * Useful for logging without exposing secrets.
     * @param url - URL to sanitize
     * @returns Sanitized URL string
     */
    public static sanitizeUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            // Remove query parameters that might contain sensitive data
            if (urlObj.search) {
                urlObj.search = '[QUERY]';
            }
            return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${urlObj.search}`;
        } catch {
            // If URL parsing fails, return a generic indicator
            return '[INVALID_URL]';
        }
    }
}
