import { assertEquals } from '@std/assert';
import { ArgumentParser } from './ArgumentParser.ts';

Deno.test('ArgumentParser - should parse config argument', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-c', 'config.json']);
    assertEquals(result.config, 'config.json');
});

Deno.test('ArgumentParser - should parse long form config argument', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--config', 'myconfig.json']);
    assertEquals(result.config, 'myconfig.json');
});

Deno.test('ArgumentParser - should parse output argument', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-o', 'output.txt']);
    assertEquals(result.output, 'output.txt');
});

Deno.test('ArgumentParser - should parse long form output argument', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--output', 'myoutput.txt']);
    assertEquals(result.output, 'myoutput.txt');
});

Deno.test('ArgumentParser - should parse single input argument', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-i', 'source.txt']);
    assertEquals(result.input, ['source.txt']);
});

Deno.test('ArgumentParser - should parse multiple input arguments', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-i', 'source1.txt', '-i', 'source2.txt']);
    assertEquals(result.input, ['source1.txt', 'source2.txt']);
});

Deno.test('ArgumentParser - should parse input-type argument', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-t', 'hosts']);
    assertEquals(result.inputType, 'hosts');
});

Deno.test('ArgumentParser - should parse long form input-type argument', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--input-type', 'adblock']);
    assertEquals(result.inputType, 'adblock');
});

Deno.test('ArgumentParser - should parse verbose flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-v']);
    assertEquals(result.verbose, true);
});

Deno.test('ArgumentParser - should parse long form verbose flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--verbose']);
    assertEquals(result.verbose, true);
});

Deno.test('ArgumentParser - should parse benchmark flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-b']);
    assertEquals(result.benchmark, true);
});

Deno.test('ArgumentParser - should parse long form benchmark flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--benchmark']);
    assertEquals(result.benchmark, true);
});

Deno.test('ArgumentParser - should parse help flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-h']);
    assertEquals(result.help, true);
});

Deno.test('ArgumentParser - should parse long form help flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--help']);
    assertEquals(result.help, true);
});

Deno.test('ArgumentParser - should parse version flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--version']);
    assertEquals(result.version, true);
});

Deno.test('ArgumentParser - should parse combined arguments', () => {
    const parser = new ArgumentParser();
    const result = parser.parse([
        '-c',
        'config.json',
        '-o',
        'output.txt',
        '-v',
        '-b',
    ]);
    assertEquals(result.config, 'config.json');
    assertEquals(result.output, 'output.txt');
    assertEquals(result.verbose, true);
    assertEquals(result.benchmark, true);
});

Deno.test('ArgumentParser - validate should pass for help flag', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-h']);
    const error = parser.validate(args);
    assertEquals(error, null);
});

Deno.test('ArgumentParser - validate should pass for version flag', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['--version']);
    const error = parser.validate(args);
    assertEquals(error, null);
});

Deno.test('ArgumentParser - validate should fail without output', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-c', 'config.json']);
    const error = parser.validate(args);
    assertEquals(error, '--output is required');
});

Deno.test('ArgumentParser - validate should fail without config or input', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-o', 'output.txt']);
    const error = parser.validate(args);
    assertEquals(error, 'Either --input or --config must be specified (or --help/--version)');
});

Deno.test('ArgumentParser - validate should fail with both config and input', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-c', 'config.json', '-i', 'source.txt', '-o', 'output.txt']);
    const error = parser.validate(args);
    assertEquals(error, 'Cannot specify both config file (-c) and input sources (-i)');
});

Deno.test('ArgumentParser - validate should pass with config and output', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-c', 'config.json', '-o', 'output.txt']);
    const error = parser.validate(args);
    assertEquals(error, null);
});

Deno.test('ArgumentParser - validate should pass with input and output', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-i', 'source.txt', '-o', 'output.txt']);
    const error = parser.validate(args);
    assertEquals(error, null);
});

Deno.test('ArgumentParser - validate should pass with multiple inputs and output', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-i', 'source1.txt', '-i', 'source2.txt', '-o', 'output.txt']);
    const error = parser.validate(args);
    assertEquals(error, null);
});

// Transformation control flags
Deno.test('ArgumentParser - should parse --no-deduplicate flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--no-deduplicate']);
    assertEquals(result.noDeduplicate, true);
});

Deno.test('ArgumentParser - should parse --no-validate flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--no-validate']);
    assertEquals(result.noValidate, true);
});

Deno.test('ArgumentParser - should parse --no-compress flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--no-compress']);
    assertEquals(result.noCompress, true);
});

Deno.test('ArgumentParser - should parse --no-comments flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--no-comments']);
    assertEquals(result.noComments, true);
});

Deno.test('ArgumentParser - should parse --invert-allow flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--invert-allow']);
    assertEquals(result.invertAllow, true);
});

Deno.test('ArgumentParser - should parse --remove-modifiers flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--remove-modifiers']);
    assertEquals(result.removeModifiers, true);
});

Deno.test('ArgumentParser - should parse --allow-ip flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--allow-ip']);
    assertEquals(result.allowIp, true);
});

Deno.test('ArgumentParser - should parse --convert-to-ascii flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--convert-to-ascii']);
    assertEquals(result.convertToAscii, true);
});

Deno.test('ArgumentParser - should parse --transformation flag (single)', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--transformation', 'Deduplicate']);
    assertEquals(result.transformation, ['Deduplicate']);
});

Deno.test('ArgumentParser - should parse --transformation flag (multiple)', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--transformation', 'RemoveComments', '--transformation', 'Deduplicate']);
    assertEquals(result.transformation, ['RemoveComments', 'Deduplicate']);
});

// Filtering flags
Deno.test('ArgumentParser - should parse --exclude flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--exclude', '*.example.com']);
    assertEquals(result.exclude, ['*.example.com']);
});

Deno.test('ArgumentParser - should parse multiple --exclude flags', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--exclude', '*.example.com', '--exclude', 'ads.example.org']);
    assertEquals(result.exclude, ['*.example.com', 'ads.example.org']);
});

Deno.test('ArgumentParser - should parse --exclude-from flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--exclude-from', 'exclusions.txt']);
    assertEquals(result.excludeFrom, ['exclusions.txt']);
});

Deno.test('ArgumentParser - should parse --include flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--include', '*.good.example.com']);
    assertEquals(result.include, ['*.good.example.com']);
});

Deno.test('ArgumentParser - should parse --include-from flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--include-from', 'inclusions.txt']);
    assertEquals(result.includeFrom, ['inclusions.txt']);
});

Deno.test('ArgumentParser - should return undefined for --include when not provided', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-c', 'config.json']);
    assertEquals(result.include, undefined);
    assertEquals(result.includeFrom, undefined);
});

// Numeric flag validation tests
Deno.test('ArgumentParser - should throw on non-integer --timeout value', () => {
    const parser = new ArgumentParser();
    let threw = false;
    try {
        parser.parse(['--timeout', 'abc']);
    } catch (e) {
        threw = true;
        assertEquals(e instanceof Error, true);
        assertEquals((e as Error).message.includes('--timeout'), true);
    }
    assertEquals(threw, true);
});

Deno.test('ArgumentParser - should throw on non-integer --retries value', () => {
    const parser = new ArgumentParser();
    let threw = false;
    try {
        parser.parse(['--retries', 'foo']);
    } catch (e) {
        threw = true;
        assertEquals(e instanceof Error, true);
        assertEquals((e as Error).message.includes('--retries'), true);
    }
    assertEquals(threw, true);
});

Deno.test('ArgumentParser - should throw on non-integer --max-rules value', () => {
    const parser = new ArgumentParser();
    let threw = false;
    try {
        parser.parse(['--max-rules', '3.5']);
    } catch (e) {
        threw = true;
        assertEquals(e instanceof Error, true);
        assertEquals((e as Error).message.includes('--max-rules'), true);
    }
    assertEquals(threw, true);
});

Deno.test('ArgumentParser - should return undefined for absent numeric flags', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-c', 'config.json', '-o', 'out.txt']);
    assertEquals(result.timeout, undefined);
    assertEquals(result.retries, undefined);
    assertEquals(result.maxRules, undefined);
});

// Output flags
Deno.test('ArgumentParser - should parse --stdout flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--stdout']);
    assertEquals(result.stdout, true);
});

Deno.test('ArgumentParser - should parse --append flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--append']);
    assertEquals(result.append, true);
});

Deno.test('ArgumentParser - should parse --format flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--format', 'adblock']);
    assertEquals(result.format, 'adblock');
});

Deno.test('ArgumentParser - should parse --name flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--name', 'existing.txt']);
    assertEquals(result.name, 'existing.txt');
});

Deno.test('ArgumentParser - should parse --max-rules flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--max-rules', '1000']);
    assertEquals(result.maxRules, 1000);
});

// Networking flags
Deno.test('ArgumentParser - should parse --timeout flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--timeout', '5000']);
    assertEquals(result.timeout, 5000);
});

Deno.test('ArgumentParser - should parse --retries flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--retries', '3']);
    assertEquals(result.retries, 3);
});

Deno.test('ArgumentParser - should parse --user-agent flag', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--user-agent', 'MyBot/1.0']);
    assertEquals(result.userAgent, 'MyBot/1.0');
});

// Validation tests for new flags
Deno.test('ArgumentParser - validate should pass with --stdout and input', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-i', 'source.txt', '--stdout']);
    const error = parser.validate(args);
    assertEquals(error, null);
});

Deno.test('ArgumentParser - validate should fail with both --stdout and --output', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-i', 'source.txt', '--stdout', '-o', 'out.txt']);
    const error = parser.validate(args);
    assertEquals(error, 'Cannot specify both --stdout and --output');
});

// ============================================================================
// Authentication Flag Tests
// ============================================================================

Deno.test('ArgumentParser - should parse --api-key', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--api-key', 'abc_test123']);
    assertEquals(result.apiKey, 'abc_test123');
});

Deno.test('ArgumentParser - should parse --bearer-token', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--bearer-token', 'eyJhbGci...']);
    assertEquals(result.bearerToken, 'eyJhbGci...');
});

Deno.test('ArgumentParser - should parse --api-url', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['--api-url', 'https://api.example.com']);
    assertEquals(result.apiUrl, 'https://api.example.com');
});

Deno.test('ArgumentParser - should parse all auth flags together', () => {
    const parser = new ArgumentParser();
    const result = parser.parse([
        '--api-key', 'abc_mykey',
        '--bearer-token', 'my.jwt.token',
        '--api-url', 'https://custom.api.dev',
    ]);
    assertEquals(result.apiKey, 'abc_mykey');
    assertEquals(result.bearerToken, 'my.jwt.token');
    assertEquals(result.apiUrl, 'https://custom.api.dev');
});

Deno.test('ArgumentParser - auth flags default to undefined', () => {
    const parser = new ArgumentParser();
    const result = parser.parse(['-i', 'source.txt']);
    assertEquals(result.apiKey, undefined);
    assertEquals(result.bearerToken, undefined);
    assertEquals(result.apiUrl, undefined);
});

Deno.test('ArgumentParser - auth flags combined with other flags', () => {
    const parser = new ArgumentParser();
    const result = parser.parse([
        '-i', 'source.txt',
        '-o', 'output.txt',
        '--api-key', 'abc_test',
        '--use-queue',
    ]);
    assertEquals(result.input, ['source.txt']);
    assertEquals(result.output, 'output.txt');
    assertEquals(result.apiKey, 'abc_test');
    assertEquals(result.useQueue, true);
});
