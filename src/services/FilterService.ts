import { FilterDownloader } from '../downloader/index.ts';
import { ILogger } from '../types/index.ts';
import { RuleUtils, Wildcard } from '../utils/index.ts';

/**
 * Service for downloading and preparing filter wildcards.
 * Uses fully asynchronous operations for optimal performance.
 */
export class FilterService {
    private readonly logger: ILogger;

    /**
     * Creates a new FilterService
     * @param logger - Logger instance for output
     */
    constructor(logger: ILogger) {
        this.logger = logger;
    }

    /**
     * Downloads all specified files and returns non-empty, non-comment lines.
     * Processes sources in parallel for optimal performance.
     *
     * @param sources - Array of source URLs or paths
     * @returns Promise resolving to array of filtered rules
     */
    public async downloadAll(sources: readonly string[]): Promise<readonly string[]> {
        if (!sources?.length) {
            return [];
        }

        // Download all sources in parallel and flatten results
        const results = await Promise.all(
            sources.map(async (source) => {
                try {
                    const rulesStr = await FilterDownloader.download(
                        source,
                        {},
                        { allowEmptyResponse: true },
                    );
                    return rulesStr.filter((el) => el.trim().length > 0 && !RuleUtils.isComment(el));
                } catch (error) {
                    this.logger.warn(`Failed to download source ${source}: ${error}`);
                    return [];
                }
            }),
        );

        return results.flat();
    }

    /**
     * Prepares a list of Wildcard patterns from rules and sources.
     * Downloads sources asynchronously and deduplicates the results.
     *
     * @param rules - Optional array of rule patterns
     * @param sources - Optional array of source URLs or paths
     * @returns Promise resolving to array of Wildcard objects
     */
    public async prepareWildcards(
        rules?: readonly string[],
        sources?: readonly string[],
    ): Promise<readonly Wildcard[]> {
        const rulesList = rules ?? [];
        const downloadedList = sources?.length ? await this.downloadAll(sources) : [];

        // Combine, deduplicate, filter empty, and convert to Wildcards
        const uniqueRules = [...new Set([...rulesList, ...downloadedList])]
            .filter(Boolean);

        return uniqueRules.map((str) => new Wildcard(str));
    }
}
