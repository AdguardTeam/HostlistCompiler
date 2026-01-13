/**
 * Output formatters module
 */

export {
    AdblockFormatter,
    createFormatter,
    DnsmasqFormatter,
    DoHFormatter,
    formatOutput,
    HostsFormatter,
    JsonFormatter,
    PiHoleFormatter,
    UnboundFormatter,
} from './OutputFormatter.ts';

export type { FormatterOptions, FormatterResult } from './OutputFormatter.ts';
