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
    assertEquals(error, 'Output file path is required (use -o or --output)');
});

Deno.test('ArgumentParser - validate should fail without config or input', () => {
    const parser = new ArgumentParser();
    const args = parser.parse(['-o', 'output.txt']);
    const error = parser.validate(args);
    assertEquals(error, 'Either config file (-c) or input sources (-i) must be provided');
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
