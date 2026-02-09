/**
 * Queue abstraction layer exports.
 * Provides a unified interface for different queue backends.
 */

// Core interface and types
export {
    type IQueueProvider,
    type QueueMessage,
    type QueueMessageType,
    type QueuePriority,
    type CompileMessage,
    type BatchCompileMessage,
    type CacheWarmMessage,
    type HealthCheckMessage,
    type AnyQueueMessage,
    type SendResult,
    type ReceiveResult,
    type ReceivedMessage,
    type QueueProviderOptions,
    createMessageId,
    createCompileMessage,
    createBatchCompileMessage,
    createCacheWarmMessage,
} from './IQueueProvider.ts';

// Cloudflare implementation
export {
    CloudflareQueueProvider,
    createCloudflareQueueProvider,
} from './CloudflareQueueProvider.ts';
