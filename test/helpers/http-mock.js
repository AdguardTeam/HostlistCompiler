/**
 * Minimal HTTP mocking helper for tests, backed by undici's MockAgent.
 *
 * The library under test downloads sources with the global `fetch`. The
 * `undici` package installed in this project is a different copy than the one
 * bundled into Node.js, so set the project's fetch implementation together
 * with its MockAgent dispatcher.
 */
const {
    MockAgent,
    setGlobalDispatcher,
    fetch: undiciFetch,
} = require('undici');

const originalFetch = global.fetch;
const mockAgent = new MockAgent();

setGlobalDispatcher(mockAgent);
mockAgent.disableNetConnect();
global.fetch = undiciFetch;

afterAll(async () => {
    global.fetch = originalFetch;
    await mockAgent.close();
});

/**
 * Creates a mock scope for one origin.
 *
 * @param {string} origin - origin to mock, e.g. `https://example.org`.
 * @returns {object} scope with `get()` and `done()` methods.
 */
function mockHttp(origin) {
    const pool = mockAgent.get(origin);

    const scope = {
        /**
         * Adds an expected GET request.
         *
         * @param {string} requestPath - request path.
         * @returns {object} interceptor with a `reply()` method.
         */
        get(requestPath) {
            const interceptor = pool.intercept({
                path: requestPath,
                method: 'GET',
            });

            return {
                /**
                 * Sets the response for the expected request.
                 *
                 * @param {number} statusCode - response status code.
                 * @param {string} body - response body.
                 * @param {object} [headers] - response headers.
                 * @returns {object} the same scope, to allow chaining.
                 */
                reply(statusCode, body, headers = {}) {
                    interceptor.reply(statusCode, body, { headers });
                    return scope;
                },
            };
        },

        /**
         * Asserts that all expected requests were made.
         */
        done() {
            mockAgent.assertNoPendingInterceptors();
        },
    };

    return scope;
}

module.exports = mockHttp;
