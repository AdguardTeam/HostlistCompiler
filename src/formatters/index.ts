/**
 * Output formatters module
 */

export {
    formatOutput,
    createFormatter,
    HostsFormatter,
    DnsmasqFormatter,
    PiHoleFormatter,
    UnboundFormatter,
    JsonFormatter,
    DoHFormatter,
    AdblockFormatter,
} from './OutputFormatter.ts';

export type {
    FormatterOptions,
    FormatterResult,
} from './OutputFormatter.ts';
