// Test setup file for Jest
import nock from 'nock';

// Disable real HTTP requests during tests
beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('localhost');
});

// Clean up nock after each test
afterEach(() => {
    nock.cleanAll();
});

// Re-enable network connections after all tests
afterAll(() => {
    nock.enableNetConnect();
});
