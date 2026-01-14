/**
 * WebSocket handler for real-time bidirectional compilation streaming.
 * Enables clients to send compilation requests and receive real-time events.
 */

/// <reference types="@cloudflare/workers-types" />

import { createTracingContext, WorkerCompiler } from '../src/index.ts';
import type { Env } from './worker.ts';
import type { ClientMessage, CompilationSession, ServerMessage, WebSocketConnectionState } from '../src/types/websocket.ts';

/**
 * WebSocket handler configuration
 */
const WS_CONFIG = {
    /** Maximum concurrent compilations per connection */
    MAX_CONCURRENT_COMPILATIONS: 3,
    /** Heartbeat interval in milliseconds */
    HEARTBEAT_INTERVAL: 30000,
    /** Connection timeout in milliseconds */
    CONNECTION_TIMEOUT: 300000, // 5 minutes
    /** Maximum message size in bytes */
    MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB
};

/**
 * Handle WebSocket upgrade request
 */
export async function handleWebSocketUpgrade(
    request: Request,
    env: Env,
): Promise<Response> {
    // Check if the request is a WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket upgrade request', { status: 426 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Initialize connection state
    const connectionId = generateConnectionId();
    const state: WebSocketConnectionState = {
        connectionId,
        sessions: new Map(),
        lastHeartbeat: Date.now(),
        connectedAt: Date.now(),
    };

    // Set up WebSocket event handlers
    setupWebSocketHandlers(server, state, env);

    // Send welcome message
    sendMessage(server, {
        type: 'welcome',
        version: env.COMPILER_VERSION || '2.0.0',
        connectionId,
        capabilities: {
            maxConcurrentCompilations: WS_CONFIG.MAX_CONCURRENT_COMPILATIONS,
            supportsPauseResume: false, // Future feature
            supportsStreaming: true,
        },
        timestamp: new Date().toISOString(),
    });

    // Return the client WebSocket
    return new Response(null, {
        status: 101,
        webSocket: client,
    });
}

/**
 * Set up WebSocket event handlers
 */
function setupWebSocketHandlers(
    ws: WebSocket,
    state: WebSocketConnectionState,
    env: Env,
): void {
    // Handle incoming messages
    ws.addEventListener('message', async (event) => {
        try {
            const data = typeof event.data === 'string' ? event.data : await event.data.text();

            // Check message size
            if (data.length > WS_CONFIG.MAX_MESSAGE_SIZE) {
                sendError(ws, 'Message too large', 'MESSAGE_TOO_LARGE');
                return;
            }

            const message = JSON.parse(data) as ClientMessage;
            await handleClientMessage(ws, message, state, env);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            sendError(ws, `Failed to process message: ${errorMessage}`, 'INVALID_MESSAGE');
        }
    });

    // Handle connection close
    ws.addEventListener('close', () => {
        // Cancel all active sessions
        for (const session of state.sessions.values()) {
            if (session.status === 'running' && session.abortController) {
                session.abortController.abort();
            }
        }
        state.sessions.clear();
        console.log(`[WebSocket] Connection closed: ${state.connectionId}`);
    });

    // Handle errors
    ws.addEventListener('error', (event) => {
        console.error(`[WebSocket] Error on connection ${state.connectionId}:`, event);
    });

    // Set up heartbeat
    setupHeartbeat(ws, state);
}

/**
 * Set up heartbeat interval
 */
function setupHeartbeat(ws: WebSocket, state: WebSocketConnectionState): void {
    const interval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastHeartbeat = now - state.lastHeartbeat;

        // Check if connection has timed out
        if (timeSinceLastHeartbeat > WS_CONFIG.CONNECTION_TIMEOUT) {
            console.log(`[WebSocket] Connection timeout: ${state.connectionId}`);
            ws.close(1000, 'Connection timeout');
            clearInterval(interval);
            return;
        }

        // Send ping
        try {
            sendMessage(ws, {
                type: 'pong',
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('[WebSocket] Failed to send heartbeat:', error);
            clearInterval(interval);
        }
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
}

/**
 * Handle incoming client message
 */
async function handleClientMessage(
    ws: WebSocket,
    message: ClientMessage,
    state: WebSocketConnectionState,
    env: Env,
): Promise<void> {
    switch (message.type) {
        case 'compile':
            await handleCompileRequest(ws, message, state, env);
            break;

        case 'cancel':
            await handleCancelRequest(ws, message, state);
            break;

        case 'ping':
            state.lastHeartbeat = Date.now();
            sendMessage(ws, {
                type: 'pong',
                timestamp: new Date().toISOString(),
            });
            break;

        case 'pause':
        case 'resume':
            sendError(
                ws,
                'Pause/resume not yet implemented',
                'NOT_IMPLEMENTED',
                message.sessionId,
            );
            break;

        default:
            sendError(ws, `Unknown message type: ${(message as any).type}`, 'UNKNOWN_MESSAGE_TYPE');
    }
}

/**
 * Handle compile request
 */
async function handleCompileRequest(
    ws: WebSocket,
    message: ClientMessage & { type: 'compile' },
    state: WebSocketConnectionState,
    _env: Env,
): Promise<void> {
    const { sessionId, configuration, preFetchedContent, benchmark } = message;

    // Check if session already exists
    if (state.sessions.has(sessionId)) {
        sendError(ws, 'Session ID already in use', 'DUPLICATE_SESSION', sessionId);
        return;
    }

    // Check concurrent compilation limit
    const runningCount = Array.from(state.sessions.values()).filter(
        (s) => s.status === 'running',
    ).length;

    if (runningCount >= WS_CONFIG.MAX_CONCURRENT_COMPILATIONS) {
        sendError(
            ws,
            'Maximum concurrent compilations reached',
            'TOO_MANY_COMPILATIONS',
            sessionId,
        );
        return;
    }

    // Create session
    const session: CompilationSession = {
        sessionId,
        configuration,
        startedAt: Date.now(),
        status: 'running',
        abortController: new AbortController(),
    };

    state.sessions.set(sessionId, session);

    // Send started acknowledgment
    sendMessage(ws, {
        type: 'compile:started',
        sessionId,
        configurationName: configuration.name,
        timestamp: new Date().toISOString(),
    });

    try {
        // Create tracing context
        const tracingContext = createTracingContext({
            metadata: {
                sessionId,
                connectionId: state.connectionId,
                configName: configuration.name,
            },
        });

        // Create compiler with event handlers
        const compiler = new WorkerCompiler({
            preFetchedContent,
            tracingContext,
            events: {
                onSourceStart: (event) => {
                    sendEvent(ws, sessionId, 'source:start', event);
                },
                onSourceComplete: (event) => {
                    sendEvent(ws, sessionId, 'source:complete', event);
                },
                onSourceError: (event) => {
                    sendEvent(ws, sessionId, 'source:error', {
                        ...event,
                        error: event.error.message,
                    });
                },
                onTransformationStart: (event) => {
                    sendEvent(ws, sessionId, 'transformation:start', event);
                },
                onTransformationComplete: (event) => {
                    sendEvent(ws, sessionId, 'transformation:complete', event);
                },
                onProgress: (event) => {
                    sendEvent(ws, sessionId, 'progress', event);
                },
                onCompilationComplete: (event) => {
                    sendEvent(ws, sessionId, 'done', event);
                },
            },
        });

        // Compile with metrics
        const result = await compiler.compileWithMetrics(configuration, benchmark);

        // Check if cancelled
        if (session.status === 'cancelled') {
            return;
        }

        // Update session status
        session.status = 'completed';

        // Send diagnostic events
        const diagnosticEvents = tracingContext.diagnostics.getEvents();
        for (const diagEvent of diagnosticEvents) {
            sendEvent(ws, sessionId, 'diagnostic', diagEvent);
        }

        // Send completion message
        sendMessage(ws, {
            type: 'compile:complete',
            sessionId,
            rules: result.rules,
            ruleCount: result.ruleCount,
            metrics: result.metrics,
            compiledAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
        });

        // Clean up session after a delay
        setTimeout(() => {
            state.sessions.delete(sessionId);
        }, 60000); // Keep for 1 minute for any late events
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Update session status
        session.status = 'failed';

        // Send error message
        sendMessage(ws, {
            type: 'compile:error',
            sessionId,
            error: errorMessage,
            details: error instanceof Error ? { stack: error.stack } : undefined,
            timestamp: new Date().toISOString(),
        });

        // Clean up session
        setTimeout(() => {
            state.sessions.delete(sessionId);
        }, 60000);
    }
}

/**
 * Handle cancel request
 */
async function handleCancelRequest(
    ws: WebSocket,
    message: ClientMessage & { type: 'cancel' },
    state: WebSocketConnectionState,
): Promise<void> {
    const { sessionId } = message;

    const session = state.sessions.get(sessionId);
    if (!session) {
        sendError(ws, 'Session not found', 'SESSION_NOT_FOUND', sessionId);
        return;
    }

    if (session.status !== 'running') {
        sendError(ws, 'Session is not running', 'INVALID_SESSION_STATE', sessionId);
        return;
    }

    // Abort the compilation
    if (session.abortController) {
        session.abortController.abort();
    }

    session.status = 'cancelled';

    // Send cancelled message
    sendMessage(ws, {
        type: 'compile:cancelled',
        sessionId,
        reason: 'Cancelled by client',
        timestamp: new Date().toISOString(),
    });

    // Clean up session
    setTimeout(() => {
        state.sessions.delete(sessionId);
    }, 5000);
}

/**
 * Send a message to the client
 */
function sendMessage(ws: WebSocket, message: ServerMessage): void {
    try {
        ws.send(JSON.stringify(message));
    } catch (error) {
        console.error('[WebSocket] Failed to send message:', error);
    }
}

/**
 * Send an event message to the client
 */
function sendEvent(
    ws: WebSocket,
    sessionId: string,
    eventType: string,
    data: unknown,
): void {
    sendMessage(ws, {
        type: 'event',
        sessionId,
        eventType: eventType as any,
        data,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Send an error message to the client
 */
function sendError(
    ws: WebSocket,
    error: string,
    code?: string,
    sessionId?: string,
): void {
    sendMessage(ws, {
        type: 'error',
        error,
        code,
        sessionId,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Generate a unique connection ID
 */
function generateConnectionId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
