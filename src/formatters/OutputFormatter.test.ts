import { assertEquals, assertExists } from '@std/assert';
import { DnsmasqFormatter, formatOutput, HostsFormatter, JsonFormatter, PiHoleFormatter, UnboundFormatter } from './OutputFormatter.ts';
import { OutputFormat } from '../config/defaults.ts';

const sampleRules = [
    '! Title: Test List',
    '||ads.example.com^',
    '||tracking.example.org^',
    '||analytics.test.net^',
    '@@||allowed.example.com^',
    '! Comment line',
];

Deno.test('HostsFormatter - converts adblock rules to hosts format', () => {
    const formatter = new HostsFormatter({ includeHeader: false });
    const result = formatter.format(sampleRules);

    assertEquals(result.format, OutputFormat.Hosts);
    assertEquals(result.ruleCount, 3); // Only blocking rules
    assertEquals(result.content.includes('0.0.0.0 ads.example.com'), true);
    assertEquals(result.content.includes('0.0.0.0 tracking.example.org'), true);
    assertEquals(result.content.includes('0.0.0.0 analytics.test.net'), true);
    // Should not include exception rules
    assertEquals(result.content.includes('allowed.example.com'), false);
});

Deno.test('HostsFormatter - supports custom IP address', () => {
    const formatter = new HostsFormatter({
        includeHeader: false,
        hostsIp: '127.0.0.1',
    });
    const result = formatter.format(['||example.com^']);

    assertEquals(result.content.includes('127.0.0.1 example.com'), true);
});

Deno.test('DnsmasqFormatter - converts to dnsmasq format', () => {
    const formatter = new DnsmasqFormatter({ includeHeader: false });
    const result = formatter.format(sampleRules);

    assertEquals(result.format, OutputFormat.Dnsmasq);
    assertEquals(result.ruleCount, 3);
    assertEquals(result.content.includes('address=/ads.example.com/'), true);
    assertEquals(result.content.includes('address=/tracking.example.org/'), true);
});

Deno.test('PiHoleFormatter - converts to Pi-hole format', () => {
    const formatter = new PiHoleFormatter({ includeHeader: false });
    const result = formatter.format(sampleRules);

    assertEquals(result.format, OutputFormat.PiHole);
    assertEquals(result.ruleCount, 3);
    // Pi-hole format is just domains, one per line
    assertEquals(result.content.includes('ads.example.com'), true);
    assertEquals(result.content.includes('0.0.0.0'), false); // No IP prefix
});

Deno.test('UnboundFormatter - converts to Unbound format', () => {
    const formatter = new UnboundFormatter({ includeHeader: false });
    const result = formatter.format(sampleRules);

    assertEquals(result.format, OutputFormat.Unbound);
    assertEquals(result.ruleCount, 3);
    assertEquals(result.content.includes('server:'), true);
    assertEquals(result.content.includes('local-zone: "ads.example.com" always_nxdomain'), true);
});

Deno.test('JsonFormatter - converts to JSON format', () => {
    const formatter = new JsonFormatter({
        listName: 'Test List',
    });
    const result = formatter.format(sampleRules);

    assertEquals(result.format, OutputFormat.JSON);
    assertEquals(result.ruleCount, 3);

    const parsed = JSON.parse(result.content);
    assertEquals(parsed.name, 'Test List');
    assertExists(parsed.generated);
    assertExists(parsed.generator);
    assertEquals(parsed.stats.uniqueHostnames, 3);
    assertEquals(parsed.hostnames.includes('ads.example.com'), true);
});

Deno.test('formatOutput - convenience function works', () => {
    const result = formatOutput(sampleRules, OutputFormat.Hosts, { includeHeader: false });

    assertEquals(result.format, OutputFormat.Hosts);
    assertEquals(result.ruleCount, 3);
});

Deno.test('formatOutput - handles empty rules', () => {
    const result = formatOutput([], OutputFormat.Hosts);

    assertEquals(result.ruleCount, 0);
});

Deno.test('formatOutput - deduplicates hostnames', () => {
    const duplicateRules = [
        '||example.com^',
        '||example.com^',
        '||example.com^',
    ];
    const result = formatOutput(duplicateRules, OutputFormat.Hosts, { includeHeader: false });

    assertEquals(result.ruleCount, 1);
});

Deno.test('formatOutput - handles plain domain format', () => {
    const plainDomains = [
        'example.com',
        'test.org',
    ];
    const result = formatOutput(plainDomains, OutputFormat.Hosts, { includeHeader: false });

    assertEquals(result.ruleCount, 2);
    assertEquals(result.content.includes('0.0.0.0 example.com'), true);
    assertEquals(result.content.includes('0.0.0.0 test.org'), true);
});
