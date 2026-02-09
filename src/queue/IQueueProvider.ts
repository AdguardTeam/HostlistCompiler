/**
 * Queue abstraction layer for different queue backends.
 * Enables swapping between Cloudflare Queues, Redis, SQS, etc.
 */

import type { IConfiguration } from '../types/index.ts';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Priority levels for queue messages
 */
export type QueuePriority = 'standard' | 'high' | 'low';

/**
 * Message types for compilation jobs
 */
export type QueueMessageType = 'compile' | 'batch-compile' | 'cache-warm' | 'health-check';

/**
 * Base message structure for all queue messages
 */
export interface QueueMessage {
    /** Unique message ID */
    id: string;
    /** Message type */
    type: QueueMessageType;
    /** Priority level */
    priority: QueuePriority;
    /** Unix timestamp when message was created */
    createdAt: number;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Message for single compilation jobs
 */
export interface CompileMessage extends QueueMessage {
    type: 'compile';
    /** Compilation configuration */
    configuration: IConfiguration;
    /** Pre-fetched content (optional) */
    preFetchedContent?: Record<string, string>;
    /** Whether to collect benchmark metrics */
    benchmark?: boolean;
}

/**
 * Message for batch compilation jobs
 */
export interface BatchCompileMessage extends QueueMessage {
    type: 'batch-compile';
    /** List of compilation requests */
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
}

/**
 * Message for cache warming jobs
 */
export interface CacheWarmMessage extends QueueMessage {
    type: 'cache-warm';
    /** Configurations to warm cache for */
    configurations: IConfiguration[];
}

/**
 * Message for health check jobs
 */
export interface HealthCheckMessage extends QueueMessage {
    type: 'health-check';
    /** Sources to check */
    sources: Array<{
        name: string;
        url: string;
        expectedMinRules?: number;
    }>;
}

/**
 * Union type of all message types
 */
export type AnyQueueMessage =
    | CompileMessage
    | BatchCompileMessage
    | CacheWarmMessage
    | HealthCheckMessage;

// ============================================================================
// Queue Provider Interface
// ============================================================================

/**
 * Result of sending a message to the queue
 */
export interface SendResult {
    /** Whether the send was successful */
    success: boolean;
    /** Message ID assigned by the queue */
    messageId: string;
    /** Error message if failed */
    error?: string;
}

/**
 * Result of receiving messages from the queue
 */
export interface ReceiveResult<T extends QueueMessage> {
    /** Received messages */
    messages: Array<ReceivedMessage<T>>;
    /** Whether there are more messages available */
    hasMore: boolean;
}

/**
 * Wrapper around a received message with acknowledgement methods
 */
export interface ReceivedMessage<T extends QueueMessage> {
    /** The message body */
    body: T;
    /** Acknowledge successful processing */
    ack(): Promise<void>;
    /** Return message to queue for retry */
    retry(delaySeconds?: number): Promise<void>;
    /** Move message to dead letter queue */
    fail(reason: string): Promise<void>;
}

/**
 * Queue provider options
 */
export interface QueueProviderOptions {
    /** Maximum number of messages to receive at once */
    maxBatchSize?: number;
    /** Visibility timeout in seconds */
    visibilityTimeoutSeconds?: number;
    /** Maximum retries before moving to DLQ */
    maxRetries?: number;
    /** Optional dead letter queue name */
    deadLetterQueue?: string;
}

/**
 * Abstract interface for queue providers.
 * Implement this to support different queue backends.
 */
export interface IQueueProvider {
    /** Provider name (e.g., 'cloudflare', 'redis', 'sqs') */
    readonly name: string;

    /**
     * Send a message to the queue
     * @param message - Message to send
     * @returns Send result with message ID
     */
    send<T extends AnyQueueMessage>(message: T): Promise<SendResult>;

    /**
     * Send multiple messages to the queue
     * @param messages - Messages to send
     * @returns Array of send results
     */
    sendBatch<T extends AnyQueueMessage>(messages: T[]): Promise<SendResult[]>;

    /**
     * Receive messages from the queue
     * @param maxMessages - Maximum number of messages to receive
     * @returns Receive result with messages
     */
    receive<T extends AnyQueueMessage>(maxMessages?: number): Promise<ReceiveResult<T>>;

    /**
     * Get approximate message count in queue
     * @returns Message count (-1 if not supported)
     */
    getMessageCount(): Promise<number>;

    /**
     * Check if the queue is healthy and accessible
     * @returns True if healthy
     */
    healthCheck(): Promise<boolean>;

    /**
     * Purge all messages from the queue (use with caution)
     * @returns Number of messages purged
     */
    purge(): Promise<number>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a message ID
 */
export function createMessageId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a compile message
 */
export function createCompileMessage(
    configuration: IConfiguration,
    options?: {
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
        priority?: QueuePriority;
        metadata?: Record<string, unknown>;
    },
): CompileMessage {
    return {
        id: createMessageId('compile'),
        type: 'compile',
        priority: options?.priority ?? 'standard',
        createdAt: Date.now(),
        configuration,
        preFetchedContent: options?.preFetchedContent,
        benchmark: options?.benchmark,
        metadata: options?.metadata,
    };
}

/**
 * Create a batch compile message
 */
export function createBatchCompileMessage(
    requests: BatchCompileMessage['requests'],
    options?: {
        priority?: QueuePriority;
        metadata?: Record<string, unknown>;
    },
): BatchCompileMessage {
    return {
        id: createMessageId('batch'),
        type: 'batch-compile',
        priority: options?.priority ?? 'standard',
        createdAt: Date.now(),
        requests,
        metadata: options?.metadata,
    };
}

/**
 * Create a cache warm message
 */
export function createCacheWarmMessage(
    configurations: IConfiguration[],
    options?: {
        priority?: QueuePriority;
        metadata?: Record<string, unknown>;
    },
): CacheWarmMessage {
    return {
        id: createMessageId('cache-warm'),
        type: 'cache-warm',
        priority: options?.priority ?? 'low',
        createdAt: Date.now(),
        configurations,
        metadata: options?.metadata,
    };
}
