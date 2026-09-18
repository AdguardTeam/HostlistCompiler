/**
 * Source-type vocabulary.
 *
 * The single source of truth for the source `type` configuration values
 * ('adblock' | 'hosts'): the configuration schema and the CLI default are
 * derived from `SOURCE_TYPES`, so they cannot drift apart. The `SourceType`
 * union in `src/index.d.ts` is a type declaration and cannot consume runtime
 * values — keep it in sync with this module.
 */
const SOURCE_TYPES = Object.freeze({
    ADBLOCK: 'adblock',
    HOSTS: 'hosts',
});

module.exports = {
    SOURCE_TYPES,
};
