import { assertEquals } from '@std/assert';
import { TldUtils } from './TldUtils.ts';

// IPv4 tests
Deno.test('TldUtils - should recognize valid IPv4 addresses', () => {
    assertEquals(TldUtils.isIPv4('192.168.1.1'), true);
    assertEquals(TldUtils.isIPv4('127.0.0.1'), true);
    assertEquals(TldUtils.isIPv4('0.0.0.0'), true);
    assertEquals(TldUtils.isIPv4('255.255.255.255'), true);
    assertEquals(TldUtils.isIPv4('8.8.8.8'), true);
});

Deno.test('TldUtils - should reject invalid IPv4 addresses', () => {
    assertEquals(TldUtils.isIPv4('256.1.1.1'), false);
    assertEquals(TldUtils.isIPv4('1.1.1'), false);
    assertEquals(TldUtils.isIPv4('1.1.1.1.1'), false);
    assertEquals(TldUtils.isIPv4('abc.def.ghi.jkl'), false);
    assertEquals(TldUtils.isIPv4(''), false);
});

// IPv6 tests
Deno.test('TldUtils - should recognize valid IPv6 addresses', () => {
    assertEquals(TldUtils.isIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
    assertEquals(TldUtils.isIPv6('2001:db8:85a3::8a2e:370:7334'), true);
    assertEquals(TldUtils.isIPv6('::1'), true);
    assertEquals(TldUtils.isIPv6('::'), true);
    assertEquals(TldUtils.isIPv6('2001:db8::1'), true);
});

Deno.test('TldUtils - should reject invalid IPv6 addresses', () => {
    assertEquals(TldUtils.isIPv6('192.168.1.1'), false);
    assertEquals(TldUtils.isIPv6('not-an-ip'), false);
    assertEquals(TldUtils.isIPv6(''), false);
});

// IP detection
Deno.test('TldUtils - should detect IP addresses', () => {
    assertEquals(TldUtils.isIP('192.168.1.1'), true);
    assertEquals(TldUtils.isIP('::1'), true);
    assertEquals(TldUtils.isIP('example.com'), false);
});

// Hostname label validation
Deno.test('TldUtils - should validate hostname labels', () => {
    assertEquals(TldUtils.isValidLabel('example'), true);
    assertEquals(TldUtils.isValidLabel('test-site'), true);
    assertEquals(TldUtils.isValidLabel('a'), true);
    assertEquals(TldUtils.isValidLabel('abc123'), true);
});

Deno.test('TldUtils - should reject invalid hostname labels', () => {
    assertEquals(TldUtils.isValidLabel(''), false);
    assertEquals(TldUtils.isValidLabel('-invalid'), false);
    assertEquals(TldUtils.isValidLabel('invalid-'), false);
    assertEquals(TldUtils.isValidLabel('a'.repeat(64)), false); // too long
    assertEquals(TldUtils.isValidLabel('invalid_label'), false);
});

// Hostname validation
Deno.test('TldUtils - should validate hostnames', () => {
    assertEquals(TldUtils.isValidHostname('example.com'), true);
    assertEquals(TldUtils.isValidHostname('sub.example.com'), true);
    assertEquals(TldUtils.isValidHostname('test-site.org'), true);
    assertEquals(TldUtils.isValidHostname('example.co.uk'), true);
});

Deno.test('TldUtils - should reject invalid hostnames', () => {
    assertEquals(TldUtils.isValidHostname(''), false);
    assertEquals(TldUtils.isValidHostname('-invalid.com'), false);
    assertEquals(TldUtils.isValidHostname('invalid-.com'), false);
    assertEquals(TldUtils.isValidHostname('a'.repeat(254)), false); // too long
});

Deno.test('TldUtils - should handle trailing dots in hostnames', () => {
    assertEquals(TldUtils.isValidHostname('example.com.'), true);
    assertEquals(TldUtils.isValidHostname('sub.example.com.'), true);
});

// Public suffix extraction
Deno.test('TldUtils - should extract simple public suffixes', () => {
    assertEquals(TldUtils.getPublicSuffix('example.com'), 'com');
    assertEquals(TldUtils.getPublicSuffix('test.org'), 'org');
    assertEquals(TldUtils.getPublicSuffix('site.net'), 'net');
});

Deno.test('TldUtils - should extract multi-part public suffixes', () => {
    assertEquals(TldUtils.getPublicSuffix('example.co.uk'), 'co.uk');
    assertEquals(TldUtils.getPublicSuffix('test.com.au'), 'com.au');
    assertEquals(TldUtils.getPublicSuffix('site.org.uk'), 'org.uk');
});

Deno.test('TldUtils - should handle subdomains with public suffixes', () => {
    assertEquals(TldUtils.getPublicSuffix('sub.example.com'), 'com');
    assertEquals(TldUtils.getPublicSuffix('deep.sub.example.co.uk'), 'co.uk');
});

Deno.test('TldUtils - should return null for invalid inputs', () => {
    assertEquals(TldUtils.getPublicSuffix(''), null);
    assertEquals(TldUtils.getPublicSuffix('com'), null);
});

Deno.test('TldUtils - should handle case insensitivity', () => {
    assertEquals(TldUtils.getPublicSuffix('EXAMPLE.COM'), 'com');
    assertEquals(TldUtils.getPublicSuffix('Test.CO.UK'), 'co.uk');
});

// Domain extraction
Deno.test('TldUtils - should extract domains', () => {
    assertEquals(TldUtils.getDomain('example.com'), 'example.com');
    assertEquals(TldUtils.getDomain('sub.example.com'), 'example.com');
    assertEquals(TldUtils.getDomain('deep.sub.example.com'), 'example.com');
});

Deno.test('TldUtils - should extract domains with multi-part suffixes', () => {
    assertEquals(TldUtils.getDomain('example.co.uk'), 'example.co.uk');
    assertEquals(TldUtils.getDomain('sub.example.co.uk'), 'example.co.uk');
});

Deno.test('TldUtils - should return null for IPs', () => {
    assertEquals(TldUtils.getDomain('192.168.1.1'), null);
    assertEquals(TldUtils.getDomain('::1'), null);
});

Deno.test('TldUtils - should return null for TLDs only', () => {
    assertEquals(TldUtils.getDomain('com'), null);
    assertEquals(TldUtils.getDomain('co.uk'), null);
});

// Parse function
Deno.test('TldUtils - should parse valid hostnames', () => {
    const result = TldUtils.parse('example.com');
    assertEquals(result.hostname, 'example.com');
    assertEquals(result.isIp, false);
    assertEquals(result.publicSuffix, 'com');
    assertEquals(result.domain, 'example.com');
});

Deno.test('TldUtils - should parse subdomains', () => {
    const result = TldUtils.parse('sub.example.com');
    assertEquals(result.hostname, 'sub.example.com');
    assertEquals(result.isIp, false);
    assertEquals(result.publicSuffix, 'com');
    assertEquals(result.domain, 'example.com');
});

Deno.test('TldUtils - should parse multi-part suffixes', () => {
    const result = TldUtils.parse('example.co.uk');
    assertEquals(result.hostname, 'example.co.uk');
    assertEquals(result.isIp, false);
    assertEquals(result.publicSuffix, 'co.uk');
    assertEquals(result.domain, 'example.co.uk');
});

Deno.test('TldUtils - should parse IPv4 addresses', () => {
    const result = TldUtils.parse('192.168.1.1');
    assertEquals(result.hostname, '192.168.1.1');
    assertEquals(result.isIp, true);
    assertEquals(result.publicSuffix, null);
    assertEquals(result.domain, null);
});

Deno.test('TldUtils - should parse IPv6 addresses', () => {
    const result = TldUtils.parse('::1');
    assertEquals(result.hostname, '::1');
    assertEquals(result.isIp, true);
    assertEquals(result.publicSuffix, null);
    assertEquals(result.domain, null);
});

Deno.test('TldUtils - should handle invalid inputs', () => {
    const result = TldUtils.parse('');
    assertEquals(result.hostname, null);
    assertEquals(result.isIp, false);
    assertEquals(result.publicSuffix, null);
    assertEquals(result.domain, null);
});

Deno.test('TldUtils - should normalize hostnames', () => {
    const result1 = TldUtils.parse('EXAMPLE.COM');
    assertEquals(result1.hostname, 'example.com');
    
    const result2 = TldUtils.parse('example.com.');
    assertEquals(result2.hostname, 'example.com');
    
    const result3 = TldUtils.parse('  example.com  ');
    assertEquals(result3.hostname, 'example.com');
});

Deno.test('TldUtils - should handle edge cases', () => {
    // Single label (not a valid domain)
    const result1 = TldUtils.parse('localhost');
    assertEquals(result1.hostname, 'localhost');
    assertEquals(result1.domain, null);
    
    // Just TLD
    const result2 = TldUtils.parse('com');
    assertEquals(result2.hostname, 'com');
    assertEquals(result2.domain, null);
});
