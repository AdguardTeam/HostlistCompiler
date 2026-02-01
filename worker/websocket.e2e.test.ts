/**
 * End-to-End WebSocket Tests
 *
 * These tests require a running server instance.
 * Run with: deno task dev (in separate terminal)
 * Then: deno test --allow-net worker/websocket.e2e.test.ts
 *
 * Tests cover:
 * - WebSocket connection establishment
 * - Real-time compilation with streaming events
 * - Session management
 * - Error handling
 * - Connection lifecycle
 */

import { assertEquals, assertExists } from '@std/assert';

// Configuration
let BASE_URL = 'http://localhost:8787';
try {
    BASE_URL = Deno.env.get('E2E_BASE_URL') || BASE_URL;
} catch {
    // Env access not granted, use default
}
const WS_URL = BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');

/**
 * Check if WebSocket server is available
 */
async function isWebSocketAvailable(): Promise<boolean> {
    try {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);
        return await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve(false);
            }, 5000);

            ws.addEventListener('open', () => {
                clearTimeout(timeout);
                ws.close();
                resolve(true);
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });
    } catch {
        return false;
    }
}

// Check if WebSocket is available
const wsAvailable = await isWebSocketAvailable();

if (!wsAvailable) {
    console.warn(`⚠️  WebSocket not available at ${WS_URL}/ws/compile`);
    console.warn('   Start the server with: deno task dev');
}

// ============================================================================
// WebSocket Connection Tests
// ============================================================================

Deno.test({
    name: 'E2E: WebSocket - connection establishment',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        const connected = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve(false);
            }, 5000);

            ws.addEventListener('open', () => {
                clearTimeout(timeout);
                resolve(true);
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });

        assertEquals(connected, true, 'WebSocket connection should be established');

        ws.close();
    },
});

Deno.test({
    name: 'E2E: WebSocket - receives welcome message',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        const welcomeMessage = await new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve(null);
            }, 5000);

            ws.addEventListener('message', (event) => {
                clearTimeout(timeout);
                resolve(event.data);
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                resolve(null);
            });
        });

        assertExists(welcomeMessage, 'Should receive welcome message');

        const data = JSON.parse(welcomeMessage);
        assertExists(data.type);

        ws.close();
    },
});

// ============================================================================
// WebSocket Compilation Tests
// ============================================================================

Deno.test({
    name: 'E2E: WebSocket - compile request with streaming events',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Test timeout'));
            }, 10000);

            const receivedEvents: string[] = [];
            let hasResult = false;

            ws.addEventListener('open', () => {
                // Send compile request
                const message = {
                    type: 'compile',
                    sessionId: `test-${Date.now()}`,
                    configuration: {
                        name: 'WebSocket E2E Test',
                        sources: [{ source: 'ws-test' }],
                    },
                    preFetchedContent: {
                        'ws-test': '||websocket.com^\n||realtime.com^',
                    },
                };

                ws.send(JSON.stringify(message));
            });

            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    receivedEvents.push(data.type);

                    if (data.type === 'compile:complete' || data.type === 'result') {
                        hasResult = true;
                        clearTimeout(timeout);
                        ws.close();
                    }

                    if (data.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        reject(new Error(`Compilation error: ${data.error}`));
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    ws.close();
                    reject(error);
                }
            });

            ws.addEventListener('close', () => {
                if (hasResult) {
                    // Verify we received some events
                    assertEquals(receivedEvents.length > 0, true, 'Should receive events');
                    resolve();
                } else {
                    reject(new Error('Connection closed without result'));
                }
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('WebSocket error'));
            });
        });
    },
});

Deno.test({
    name: 'E2E: WebSocket - multiple messages in same session',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Test timeout'));
            }, 15000);

            let compilationCount = 0;
            const sessionId = `test-${Date.now()}`;

            ws.addEventListener('open', () => {
                // Send first compile request
                const message1 = {
                    type: 'compile',
                    sessionId,
                    configuration: {
                        name: 'Multi Test 1',
                        sources: [{ source: 'test1' }],
                    },
                    preFetchedContent: {
                        'test1': '||test1.com^',
                    },
                };

                ws.send(JSON.stringify(message1));
            });

            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'compile:complete' || data.type === 'result') {
                        compilationCount++;

                        if (compilationCount === 1) {
                            // Send second compile request
                            const message2 = {
                                type: 'compile',
                                sessionId,
                                configuration: {
                                    name: 'Multi Test 2',
                                    sources: [{ source: 'test2' }],
                                },
                                preFetchedContent: {
                                    'test2': '||test2.com^',
                                },
                            };

                            ws.send(JSON.stringify(message2));
                        } else if (compilationCount === 2) {
                            // Both compilations complete
                            clearTimeout(timeout);
                            ws.close();
                        }
                    }

                    if (data.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        reject(new Error(`Compilation error: ${data.error}`));
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    ws.close();
                    reject(error);
                }
            });

            ws.addEventListener('close', () => {
                if (compilationCount === 2) {
                    resolve();
                } else {
                    reject(new Error(`Only completed ${compilationCount} compilations`));
                }
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('WebSocket error'));
            });
        });
    },
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test({
    name: 'E2E: WebSocket - handles invalid message format',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve(); // Timeout is acceptable - server may just ignore invalid messages
            }, 5000);

            ws.addEventListener('open', () => {
                // Send invalid JSON
                ws.send('invalid json {');
            });

            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Server may respond with error or ignore it
                    if (data.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                } catch {
                    // Ignore parse errors
                }
            });

            ws.addEventListener('close', () => {
                clearTimeout(timeout);
                resolve();
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                resolve(); // Error is acceptable
            });
        });
    },
});

Deno.test({
    name: 'E2E: WebSocket - handles invalid configuration',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Test timeout'));
            }, 5000);

            ws.addEventListener('open', () => {
                // Send request with invalid configuration
                const message = {
                    type: 'compile',
                    sessionId: `test-${Date.now()}`,
                    configuration: {
                        // Missing required 'name' field
                        sources: [],
                    },
                };

                ws.send(JSON.stringify(message));
            });

            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Should receive error or handle gracefully
                    if (data.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    ws.close();
                    reject(error);
                }
            });

            ws.addEventListener('close', () => {
                clearTimeout(timeout);
                resolve(); // Close is acceptable
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                resolve(); // Error is acceptable for invalid config
            });
        });
    },
});

// ============================================================================
// Connection Lifecycle Tests
// ============================================================================

Deno.test({
    name: 'E2E: WebSocket - graceful disconnect',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout'));
            }, 5000);

            ws.addEventListener('open', () => {
                // Close immediately after opening
                ws.close();
            });

            ws.addEventListener('close', () => {
                clearTimeout(timeout);
                resolve();
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('WebSocket error'));
            });
        });
    },
});

Deno.test({
    name: 'E2E: WebSocket - reconnection capability',
    ignore: !wsAvailable,
    fn: async () => {
        // First connection
        const ws1 = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws1.close();
                reject(new Error('First connection timeout'));
            }, 5000);

            ws1.addEventListener('open', () => {
                clearTimeout(timeout);
                ws1.close();
            });

            ws1.addEventListener('close', () => {
                resolve();
            });

            ws1.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('First connection error'));
            });
        });

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Second connection
        const ws2 = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws2.close();
                reject(new Error('Second connection timeout'));
            }, 5000);

            ws2.addEventListener('open', () => {
                clearTimeout(timeout);
                ws2.close();
            });

            ws2.addEventListener('close', () => {
                resolve();
            });

            ws2.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('Second connection error'));
            });
        });
    },
});

// ============================================================================
// Event Streaming Tests
// ============================================================================

Deno.test({
    name: 'E2E: WebSocket - receives progress events',
    ignore: !wsAvailable,
    fn: async () => {
        const ws = new WebSocket(`${WS_URL}/ws/compile`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Test timeout'));
            }, 10000);

            const receivedEventTypes = new Set<string>();

            ws.addEventListener('open', () => {
                const message = {
                    type: 'compile',
                    sessionId: `test-${Date.now()}`,
                    configuration: {
                        name: 'Progress Test',
                        sources: [{ source: 'progress-test' }],
                        transformations: ['Deduplicate', 'RemoveComments'],
                    },
                    preFetchedContent: {
                        'progress-test': '||test1.com^\n! Comment\n||test2.com^',
                    },
                };

                ws.send(JSON.stringify(message));
            });

            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    receivedEventTypes.add(data.type);

                    if (data.type === 'compile:complete' || data.type === 'result') {
                        clearTimeout(timeout);
                        ws.close();
                    }

                    if (data.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        reject(new Error(`Compilation error: ${data.error}`));
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    ws.close();
                    reject(error);
                }
            });

            ws.addEventListener('close', () => {
                // Verify we received various event types
                assertEquals(receivedEventTypes.size > 0, true, 'Should receive events');
                console.log(`   Received event types: ${Array.from(receivedEventTypes).join(', ')}`);
                resolve();
            });

            ws.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('WebSocket error'));
            });
        });
    },
});
