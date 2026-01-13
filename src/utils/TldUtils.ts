/**
 * TLD (Top-Level Domain) utilities for parsing and validating domain names.
 * This is a native implementation to replace the 'tldts' npm package.
 */

/**
 * Result of parsing a hostname.
 */
export interface ParsedHost {
    /** The normalized hostname, or null if invalid */
    hostname: string | null;
    /** Whether the hostname is an IP address */
    isIp: boolean;
    /** The public suffix (TLD) of the hostname */
    publicSuffix: string | null;
    /** The domain (registrable domain) */
    domain: string | null;
}

/**
 * Common public suffixes (TLDs).
 * This is a simplified list - a full implementation would use the Public Suffix List.
 * @see https://publicsuffix.org/list/
 */
const COMMON_PUBLIC_SUFFIXES = new Set([
    // Generic TLDs
    'com',
    'org',
    'net',
    'edu',
    'gov',
    'mil',
    'int',
    'info',
    'biz',
    'name',
    'pro',
    'aero',
    'coop',
    'museum',
    'app',
    'dev',
    'io',
    'co',
    'me',
    'tv',
    'cc',
    'ws',
    'mobi',
    'asia',
    'tel',
    'jobs',
    'travel',
    'xxx',
    'cat',

    // Country code TLDs (common ones)
    'uk',
    'us',
    'ca',
    'au',
    'de',
    'fr',
    'it',
    'es',
    'nl',
    'be',
    'ch',
    'at',
    'se',
    'no',
    'dk',
    'fi',
    'pl',
    'cz',
    'ru',
    'ua',
    'br',
    'mx',
    'ar',
    'cl',
    'co',
    'pe',
    've',
    'jp',
    'cn',
    'kr',
    'tw',
    'hk',
    'sg',
    'in',
    'id',
    'my',
    'th',
    'vn',
    'ph',
    'za',
    'eg',
    'ng',
    'ke',
    'nz',
    'il',
    'ae',
    'sa',
    'tr',
    'gr',
    'pt',
    'ie',
    'hu',
    'ro',

    // New gTLDs (common ones)
    'xyz',
    'online',
    'site',
    'tech',
    'store',
    'blog',
    'cloud',
    'club',
    'shop',
    'live',
    'news',
    'world',
    'network',
    'digital',
    'media',
    'global',
    'email',
    'support',
    'solutions',
    'services',
    'agency',
    'company',
    'systems',
    'technology',
    'marketing',
    'consulting',
]);

/**
 * Multi-part public suffixes (e.g., co.uk, com.au).
 * These are treated as a single public suffix.
 */
const MULTI_PART_SUFFIXES = new Set([
    // UK
    'co.uk',
    'org.uk',
    'me.uk',
    'ac.uk',
    'gov.uk',
    'net.uk',
    'sch.uk',
    // Australia
    'com.au',
    'net.au',
    'org.au',
    'edu.au',
    'gov.au',
    'asn.au',
    'id.au',
    // Brazil
    'com.br',
    'net.br',
    'org.br',
    'gov.br',
    'edu.br',
    // Japan
    'co.jp',
    'or.jp',
    'ne.jp',
    'ac.jp',
    'go.jp',
    // India
    'co.in',
    'net.in',
    'org.in',
    'gen.in',
    'firm.in',
    'ind.in',
    // South Africa
    'co.za',
    'org.za',
    'net.za',
    'gov.za',
    'edu.za',
    // New Zealand
    'co.nz',
    'net.nz',
    'org.nz',
    'govt.nz',
    'ac.nz',
    // Germany
    'de.com',
    // European Union
    'eu.com',
    'eu.org',
    // Russia
    'com.ru',
    'net.ru',
    'org.ru',
    // China
    'com.cn',
    'net.cn',
    'org.cn',
    'gov.cn',
    'edu.cn',
    // Korea
    'co.kr',
    'or.kr',
    'ne.kr',
    'go.kr',
    'ac.kr',
    // Taiwan
    'com.tw',
    'net.tw',
    'org.tw',
    'gov.tw',
    'edu.tw',
    // Hong Kong
    'com.hk',
    'net.hk',
    'org.hk',
    'gov.hk',
    'edu.hk',
    // Singapore
    'com.sg',
    'net.sg',
    'org.sg',
    'gov.sg',
    'edu.sg',
    // Mexico
    'com.mx',
    'net.mx',
    'org.mx',
    'gob.mx',
    'edu.mx',
    // Argentina
    'com.ar',
    'net.ar',
    'org.ar',
    'gob.ar',
    'edu.ar',
    // Other common ones
    'co.id',
    'or.id',
    'web.id',
    'sch.id',
    'go.id',
    'com.my',
    'net.my',
    'org.my',
    'gov.my',
    'edu.my',
    'co.th',
    'or.th',
    'ac.th',
    'go.th',
    'in.th',
    'com.vn',
    'net.vn',
    'org.vn',
    'gov.vn',
    'edu.vn',
    'com.ph',
    'net.ph',
    'org.ph',
    'gov.ph',
    'edu.ph',
    'com.tr',
    'net.tr',
    'org.tr',
    'gov.tr',
    'edu.tr',
    'com.eg',
    'net.eg',
    'org.eg',
    'gov.eg',
    'edu.eg',
    'co.il',
    'net.il',
    'org.il',
    'gov.il',
    'ac.il',
    'com.sa',
    'net.sa',
    'org.sa',
    'gov.sa',
    'edu.sa',
    'ae.org',
    'com.ae',
    'net.ae',
    'org.ae',
    'gov.ae',
]);

/**
 * IPv4 address pattern.
 */
const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * IPv6 address pattern (simplified - handles most common formats).
 */
const IPV6_PATTERN = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{0,4}$|^[0-9a-fA-F]{1,4}::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{0,4}$/;

/**
 * Valid hostname label pattern (DNS label).
 */
const HOSTNAME_LABEL_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

/**
 * TLD utilities for parsing and validating domain names.
 */
export class TldUtils {
    /**
     * Checks if a string is a valid IPv4 address.
     */
    public static isIPv4(str: string): boolean {
        if (!IPV4_PATTERN.test(str)) {
            return false;
        }
        const parts = str.split('.');
        return parts.every((part) => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }

    /**
     * Checks if a string is a valid IPv6 address.
     */
    public static isIPv6(str: string): boolean {
        return IPV6_PATTERN.test(str);
    }

    /**
     * Checks if a string is an IP address (IPv4 or IPv6).
     */
    public static isIP(str: string): boolean {
        return TldUtils.isIPv4(str) || TldUtils.isIPv6(str);
    }

    /**
     * Validates a hostname label (single part between dots).
     */
    public static isValidLabel(label: string): boolean {
        if (label.length === 0 || label.length > 63) {
            return false;
        }
        return HOSTNAME_LABEL_PATTERN.test(label);
    }

    /**
     * Validates a hostname.
     */
    public static isValidHostname(hostname: string): boolean {
        if (!hostname || hostname.length > 253) {
            return false;
        }

        // Remove trailing dot if present
        const normalized = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;

        if (normalized.length === 0) {
            return false;
        }

        const labels = normalized.split('.');
        return labels.every((label) => TldUtils.isValidLabel(label));
    }

    /**
     * Gets the public suffix of a domain.
     * Returns the TLD or multi-part suffix (e.g., 'co.uk').
     */
    public static getPublicSuffix(domain: string): string | null {
        if (!domain) {
            return null;
        }

        const normalized = domain.toLowerCase().replace(/\.+$/, '');
        const parts = normalized.split('.');

        if (parts.length === 0) {
            return null;
        }

        // Check for multi-part suffixes first (e.g., co.uk)
        if (parts.length >= 2) {
            const twoPartSuffix = parts.slice(-2).join('.');
            if (MULTI_PART_SUFFIXES.has(twoPartSuffix)) {
                return twoPartSuffix;
            }
        }

        // Check for three-part suffixes (rare but exist)
        if (parts.length >= 3) {
            const threePartSuffix = parts.slice(-3).join('.');
            if (MULTI_PART_SUFFIXES.has(threePartSuffix)) {
                return threePartSuffix;
            }
        }

        // Return the single TLD
        const tld = parts[parts.length - 1];

        // Check if it's a known TLD
        if (COMMON_PUBLIC_SUFFIXES.has(tld)) {
            return tld;
        }

        // For unknown TLDs, still return it (it might be valid)
        // This allows for new TLDs that aren't in our list
        if (TldUtils.isValidLabel(tld)) {
            return tld;
        }

        return null;
    }

    /**
     * Gets the registrable domain (domain + public suffix).
     */
    public static getDomain(hostname: string): string | null {
        if (!hostname) {
            return null;
        }

        const normalized = hostname.toLowerCase().replace(/\.+$/, '');

        if (TldUtils.isIP(normalized)) {
            return null;
        }

        const publicSuffix = TldUtils.getPublicSuffix(normalized);
        if (!publicSuffix) {
            return null;
        }

        const parts = normalized.split('.');
        const suffixParts = publicSuffix.split('.');

        // Need at least one more part than the suffix for a registrable domain
        if (parts.length <= suffixParts.length) {
            return null;
        }

        // Return domain + public suffix
        return parts.slice(-(suffixParts.length + 1)).join('.');
    }

    /**
     * Parses a hostname and returns detailed information.
     * This is the main replacement for tldts.parse().
     */
    public static parse(hostname: string): ParsedHost {
        const result: ParsedHost = {
            hostname: null,
            isIp: false,
            publicSuffix: null,
            domain: null,
        };

        if (!hostname) {
            return result;
        }

        // Normalize the hostname
        let normalized = hostname.toLowerCase().trim();

        // Remove trailing dot if present
        if (normalized.endsWith('.')) {
            normalized = normalized.slice(0, -1);
        }

        // Check if it's an IP address
        if (TldUtils.isIP(normalized)) {
            result.hostname = normalized;
            result.isIp = true;
            return result;
        }

        // Validate as hostname
        if (!TldUtils.isValidHostname(normalized)) {
            return result;
        }

        result.hostname = normalized;
        result.publicSuffix = TldUtils.getPublicSuffix(normalized);
        result.domain = TldUtils.getDomain(normalized);

        return result;
    }
}
