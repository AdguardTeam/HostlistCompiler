/**
 * CLI error output tests.
 *
 * `cli.test.js` mocks `consola`, so it cannot catch the output that the real
 * reporter produces. This suite uses the real `consola` and captures its
 * `stderr` stream.
 */
const consola = require('consola');

jest.mock('../src/index', () => jest.fn());

describe('CLI error output', () => {
    const originalArgv = process.argv;
    let exitSpy;
    let stderrSpy;
    let stderrOutput;

    beforeEach(() => {
        jest.resetModules();
        process.argv = ['node', 'cli', '-i', 'https://example.org/hosts.txt', '-o', 'output.txt'];
        stderrOutput = '';
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        stderrSpy = jest.spyOn(consola.stderr, 'write').mockImplementation((chunk) => {
            stderrOutput += chunk.toString();
            return true;
        });
    });

    afterEach(() => {
        process.argv = originalArgv;
        exitSpy.mockRestore();
        stderrSpy.mockRestore();
    });

    it('does not print source credentials in the verbose configuration dump', async () => {
        process.argv = [
            'node',
            'cli',
            '-v',
            '-i',
            'https://user:secret@example.org/hosts.txt',
            '-o',
            'output.txt',
        ];

        let stdoutOutput = '';
        const originalLevel = consola.level;
        const stdoutSpy = jest.spyOn(consola.stdout, 'write').mockImplementation((chunk) => {
            stdoutOutput += chunk.toString();
            return true;
        });

        try {
            // eslint-disable-next-line global-require
            require('../src/index').mockRejectedValue(new Error('compile failed'));

            // eslint-disable-next-line global-require
            require('../src/cli');
            await new Promise((resolve) => { setImmediate(resolve); });

            expect(stdoutOutput).toContain('https://example.org/hosts.txt');
            expect(stdoutOutput).not.toContain('secret');
        } finally {
            stdoutSpy.mockRestore();
            consola.level = originalLevel;
        }
    });

    it('prints every error in the cause chain', async () => {
        const networkError = new Error('connect ECONNREFUSED 127.0.0.1:443');
        const fetchError = new TypeError('fetch failed');
        fetchError.cause = networkError;
        const error = new Error("Failed to request url 'https://example.org/hosts.txt'");
        error.cause = fetchError;

        // eslint-disable-next-line global-require
        require('../src/index').mockRejectedValue(error);

        // Loading the module runs main() with the process.argv prepared above.
        // eslint-disable-next-line global-require
        require('../src/cli');
        // Let main() settle before asserting on the logged errors.
        await new Promise((resolve) => { setImmediate(resolve); });

        expect(stderrOutput).toContain("Failed to request url 'https://example.org/hosts.txt'");
        expect(stderrOutput).toContain('Caused by: fetch failed');
        expect(stderrOutput).toContain('Caused by: connect ECONNREFUSED 127.0.0.1:443');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('prints every message from an aggregate cause', async () => {
        const ipv6Error = new Error('connect ECONNREFUSED ::1:443');
        const ipv4Error = new Error('connect ECONNREFUSED 127.0.0.1:443');
        // A dual-stack connection failure has an empty message, so the useful
        // messages are in the `errors` array.
        const aggregateError = new global.AggregateError([ipv6Error, ipv4Error]);
        const fetchError = new TypeError('fetch failed');
        fetchError.cause = aggregateError;
        const error = new Error("Failed to request url 'https://example.org/hosts.txt'");
        error.cause = fetchError;

        // eslint-disable-next-line global-require
        require('../src/index').mockRejectedValue(error);

        // eslint-disable-next-line global-require
        require('../src/cli');
        await new Promise((resolve) => { setImmediate(resolve); });

        expect(stderrOutput).toContain("Failed to request url 'https://example.org/hosts.txt'");
        expect(stderrOutput).toContain('Caused by: fetch failed');
        expect(stderrOutput).toContain('Caused by: connect ECONNREFUSED ::1:443');
        expect(stderrOutput).toContain('Caused by: connect ECONNREFUSED 127.0.0.1:443');
        expect(stderrOutput).not.toContain('Caused by: AggregateError');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('prints a cause that is not an error object', async () => {
        const error = new Error('Failed to request url https://example.org/hosts.txt');
        error.cause = 'connection reset';

        // eslint-disable-next-line global-require
        require('../src/index').mockRejectedValue(error);

        // eslint-disable-next-line global-require
        require('../src/cli');
        await new Promise((resolve) => { setImmediate(resolve); });

        expect(stderrOutput).toContain('Caused by: connection reset');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
