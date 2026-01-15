/**
 * Output formatters module
 */

export {
    AdblockFormatter,
    BaseFormatter,
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
