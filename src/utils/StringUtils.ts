/**
 * Utility class for string manipulation operations.
 */
export class StringUtils {
    /**
     * Extracts a substring between two tags.
     * @param str - Original string
     * @param startTag - Start tag to search for
     * @param endTag - End tag to search for
     * @returns The substring between tags, or null if not found
     */
    public static substringBetween(
        str: string | null | undefined,
        startTag: string,
        endTag: string,
    ): string | null {
        if (!str) {
            return null;
        }

        const start = str.indexOf(startTag) + startTag.length;
        const end = str.indexOf(endTag, start);

        if (end > start && start !== -1) {
            return str.substring(start, end);
        }

        return null;
    }

    /**
     * Splits a string by delimiter, respecting escape characters.
     * @param str - String to split
     * @param delimiter - Delimiter character
     * @param escapeCharacter - Escape character
     * @param preserveAllTokens - If true, preserve empty parts
     * @returns Array of string parts
     */
    public static splitByDelimiterWithEscapeCharacter(
        str: string | null | undefined,
        delimiter: string,
        escapeCharacter: string,
        preserveAllTokens: boolean,
    ): string[] {
        const parts: string[] = [];

        if (!str) {
            return parts;
        }

        let buffer: string[] = [];

        for (let i = 0; i < str.length; i += 1) {
            const c = str.charAt(i);

            if (c === delimiter) {
                if (i === 0) {
                    // Ignore leading delimiter
                } else if (str.charAt(i - 1) === escapeCharacter) {
                    // Remove escape char and add delimiter
                    buffer.splice(buffer.length - 1, 1);
                    buffer.push(c);
                } else if (preserveAllTokens || buffer.length > 0) {
                    parts.push(buffer.join(''));
                    buffer = [];
                }
            } else {
                buffer.push(c);
            }
        }

        if (preserveAllTokens || buffer.length > 0) {
            parts.push(buffer.join(''));
        }

        return parts;
    }

    /**
     * Escapes special regex characters in a string.
     * @param str - String to escape
     * @returns Escaped string safe for use in regex
     */
    public static escapeRegExp(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Checks if a string is empty or contains only whitespace.
     */
    public static isEmpty(str: string | null | undefined): boolean {
        return !str || str.trim().length === 0;
    }

    /**
     * Trims specified characters from both ends of a string.
     */
    public static trim(str: string, chars: string = ' \t'): string {
        const regex = new RegExp(`^[${chars}]+|[${chars}]+$`, 'g');
        return str.replace(regex, '');
    }
}
