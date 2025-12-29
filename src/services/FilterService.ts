import { FiltersDownloader } from '@adguard/filters-downloader';
import { ILogger } from '../types';
import { RuleUtils, Wildcard } from '../utils/index';

/**
 * Service for downloading and preparing filter wildcards.
 */
export class FilterService {
    constructor(_logger: ILogger) {
        // Logger reserved for future debugging purposes
    }

    /**
     * Downloads all specified files and returns non-empty, non-comment lines.
     */
    public async downloadAll(sources: string[]): Promise<string[]> {
        let list: string[] = [];

        if (!sources || sources.length === 0) {
            return list;
        }

        await Promise.all(sources.map(async (source) => {
            const rulesStr = await FiltersDownloader.download(source, {}, { allowEmptyResponse: true });
            const rules = rulesStr.filter((el: string) =>
                el.trim().length > 0 && !RuleUtils.isComment(el));
            list = list.concat(rules);
        }));

        return list;
    }

    /**
     * Prepares a list of Wildcard patterns from rules and sources.
     */
    public async prepareWildcards(
        rules?: string[],
        sources?: string[],
    ): Promise<Wildcard[]> {
        let list: string[] = [];

        if (rules && rules.length > 0) {
            list = list.concat(rules);
        }

        const loadedList = await this.downloadAll(sources || []);
        list = list.concat(loadedList);

        // Remove duplicates and empty values
        list = Array.from(new Set(list)).filter(Boolean);

        return list.map((str) => new Wildcard(str));
    }
}
