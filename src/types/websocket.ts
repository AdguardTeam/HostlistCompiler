/**
 * WebSocket message protocol types for real-time bidirectional communication.
 * Enables clients to send compilation requests and receive real-time events.
 */

import type { IConfiguration } from './index.ts';

/**
 * Base message type for all WebSocket messages
 */
export interface WebSocketMessage {
    /** Message type discriminator */
    type: string;
    /** Unique message ID for correlation */
    messageId?: string;
    /** Timestamp in ISO format */
    timestamp?: string;
}

/**
 * Client-to-Server: Request to compile filter lists
 */
export interface CompileRequestMessage extends WebSocketMessage {
    type: 'compile';
    /** Unique session ID for this compilation */
    sessionId: string;
    /** Filter list configuration */
    configuration: IConfiguration;
    /** Optional pre-fetched content */
    preFetchedContent?: Record<string, string>;
    /** Enable benchmarking metrics */
    benchmark?: boolean;
}

/**
 * Client-to-Server: Cancel a running compilation
 */
export interface CancelRequestMessage extends WebSocketMessage {
    type: 'cancel';
    /** Session ID to cancel */
    sessionId: string;
}

/**
 * Client-to-Server: Pause a running compilation (future)
 */
export interface PauseRequestMessage extends WebSocketMessage {
    type: 'pause';
    /** Session ID to pause */
    sessionId: string;
}

/**
 * Client-to-Server: Resume a paused compilation (future)
 */
export interface ResumeRequestMessage extends WebSocketMessage {
    type: 'resume';
    /** Session ID to resume */
    sessionId: string;
}

/**
 * Client-to-Server: Heartbeat ping
 */
export interface PingMessage extends WebSocketMessage {
    type: 'ping';
}

/**
 * Server-to-Client: Heartbeat pong
 */
export interface PongMessage extends WebSocketMessage {
    type: 'pong';
}

/**
 * Server-to-Client: Compilation started acknowledgment
 */
export interface CompileStartedMessage extends WebSocketMessage {
    type: 'compile:started';
    /** Session ID */
    sessionId: string;
    /** Configuration name */
    configurationName: string;
}

/**
 * Server-to-Client: Compilation event (SSE-style events)
 */
export interface EventMessage extends WebSocketMessage {
    type: 'event';
    /** Session ID this event belongs to */
    sessionId: string;
    /** Event type (matches SSE event names) */
    eventType:
        | 'log'
        | 'source:start'
        | 'source:complete'
        | 'source:error'
        | 'transformation:start'
        | 'transformation:complete'
        | 'progress'
        | 'result'
        | 'done'
        | 'error'
        | 'diagnostic'
        | 'cache'
        | 'network'
        | 'metric';
    /** Event data payload */
    data: unknown;
}

/**
 * Server-to-Client: Compilation completed successfully
 */
export interface CompileCompleteMessage extends WebSocketMessage {
    type: 'compile:complete';
    /** Session ID */
    sessionId: string;
    /** Compiled rules */
    rules: string[];
    /** Number of rules */
    ruleCount: number;
    /** Optional metrics */
    metrics?: unknown;
    /** Compilation timestamp */
    compiledAt: string;
}

/**
 * Server-to-Client: Compilation failed
 */
export interface CompileErrorMessage extends WebSocketMessage {
    type: 'compile:error';
    /** Session ID */
    sessionId: string;
    /** Error message */
    error: string;
    /** Optional error details */
    details?: unknown;
}

/**
 * Server-to-Client: Compilation cancelled
 */
export interface CompileCancelledMessage extends WebSocketMessage {
    type: 'compile:cancelled';
    /** Session ID */
    sessionId: string;
    /** Cancellation reason */
    reason?: string;
}

/**
 * Server-to-Client: Connection acknowledged
 */
export interface WelcomeMessage extends WebSocketMessage {
    type: 'welcome';
    /** Server version */
    version: string;
    /** Connection ID */
    connectionId: string;
    /** Server capabilities */
    capabilities: {
        maxConcurrentCompilations: number;
        supportsPauseResume: boolean;
        supportsStreaming: boolean;
    };
}

/**
 * Server-to-Client: Error message
 */
export interface ErrorMessage extends WebSocketMessage {
    type: 'error';
    /** Error message */
    error: string;
    /** Error code */
    code?: string;
    /** Related session ID if applicable */
    sessionId?: string;
}

/**
 * Union of all client-to-server messages
 */
export type ClientMessage =
    | CompileRequestMessage
    | CancelRequestMessage
    | PauseRequestMessage
    | ResumeRequestMessage
    | PingMessage;

/**
 * Union of all server-to-client messages
 */
export type ServerMessage =
    | WelcomeMessage
    | PongMessage
    | CompileStartedMessage
    | EventMessage
    | CompileCompleteMessage
    | CompileErrorMessage
    | CompileCancelledMessage
    | ErrorMessage;

/**
 * WebSocket connection state
 */
export interface WebSocketConnectionState {
    /** Unique connection ID */
    connectionId: string;
    /** Active compilation sessions */
    sessions: Map<string, CompilationSession>;
    /** Last heartbeat timestamp */
    lastHeartbeat: number;
    /** Connection start time */
    connectedAt: number;
}

/**
 * Compilation session state
 */
export interface CompilationSession {
    /** Session ID */
    sessionId: string;
    /** Configuration being compiled */
    configuration: IConfiguration;
    /** Start time */
    startedAt: number;
    /** Current status */
    status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    /** Abort controller for cancellation */
    abortController?: AbortController;
}
