/**
 * Queue abstraction layer exports.
 * Provides a unified interface for different queue backends.
 */

// Core interface and types
export {
    type AnyQueueMessage,
    type BatchCompileMessage,
    type CacheWarmMessage,
    type CompileMessage,
    createBatchCompileMessage,
    createCacheWarmMessage,
    createCompileMessage,
    createMessageId,
    type HealthCheckMessage,
    type IQueueProvider,
    type QueueMessage,
    type QueueMessageType,
    type QueuePriority,
    type QueueProviderOptions,
    type ReceivedMessage,
    type ReceiveResult,
    type SendResult,
} from './IQueueProvider.ts';

// Cloudflare implementation
export { CloudflareQueueProvider, createCloudflareQueueProvider } from './CloudflareQueueProvider.ts';
