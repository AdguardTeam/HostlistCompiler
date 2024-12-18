declare module '@adguard/hostlist-compiler' {
    export type SourceType = 'adblock' | 'hosts';

    export type Transformation =
        'RemoveComments' |
        'Compress' |
        'RemoveModifiers' |
        'Validate' |
        'Deduplicate' |
        'InvertAllow' |
        'RemoveEmptyLines' |
        'TrimLines' |
        'InsertFinalNewLine';

    /** A source for the filter list */
    export interface ISource {
        /** Name of the source */
        name?: string;
        /** Path to a file or a URL */
        source: string;
        /** Type of the source */
        type?: SourceType;
        /** A list of the transformations that will be applied */
        transformations?: Transformation[];
        /** A list of rules (or wildcards) to exclude from the source. */
        exclusions?: string[];
        /** An array of exclusions sources. */
        exclusions_sources?: string[];
        /** A list of wildcards to include from the source. All rules that don't match these wildcards won't be included. */
        inclusions?: string[];
        /** A list of files with inclusions. */
        inclusions_sources?: string[];
    }

    /** Configuration for the hostlist compiler */
    export interface IConfiguration {
        /** Filter list name */
        name: string;
        /** Filter list description */
        description?: string;
        /** Filter list homepage */
        homepage?: string;
        /** Filter list license */
        license?: string;
        /** Filter list version */
        version?: string;
        /** An array of the filter list sources */
        sources: ISource[];
        /** A list of the transformations that will be applied */
        transformations?: Transformation[];
        /** A list of rules (or wildcards) to exclude from the source. */
        exclusions?: string[];
        /** An array of exclusions sources. */
        exclusions_sources?: string[];
        /** A list of wildcards to include from the source. All rules that don't match these wildcards won't be included. */
        inclusions?: string[];
        /** A list of files with inclusions. */
        inclusions_sources?: string[];
    }

    /**
     * Compiles a filter list using the specified configuration.
     *
     * @param {*} configuration - compilation configuration.
     * See the repo README for the details on it.
     * @returns {Promise<Array<string>>} the array of rules.
     */
    declare async function compile(configuration: IConfiguration): Promise<string[]>;

    export default compile;
}