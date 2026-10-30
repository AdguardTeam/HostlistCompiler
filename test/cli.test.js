const consola = require('consola');
const compile = require('../src/index');

jest.mock('consola', () => ({
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
}));
jest.mock('../src/index', () => jest.fn());

describe('CLI', () => {
    const originalArgv = process.argv;
    let exitSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        process.argv = ['node', 'cli', '-i', 'https://example.org/hosts.txt', '-o', 'output.txt'];
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        process.argv = originalArgv;
        exitSpy.mockRestore();
    });

    it('prints the error cause when compilation fails', async () => {
        const cause = new Error('connect ECONNREFUSED 127.0.0.1:80');
        const error = new Error('Failed to request url https://example.org/hosts.txt');
        error.cause = cause;
        compile.mockRejectedValue(error);

        // Loading the module runs main() with the process.argv prepared above.
        // eslint-disable-next-line global-require
        require('../src/cli');
        // Let main() settle before asserting on the logged errors.
        await new Promise((resolve) => { setImmediate(resolve); });

        expect(consola.error.mock.calls).toEqual([[error], [cause]]);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
