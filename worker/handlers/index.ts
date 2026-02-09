/**
 * Handler exports for the Cloudflare Worker.
 */

// Admin handlers
export {
    handleAdminClearCache,
    handleAdminClearExpired,
    handleAdminExport,
    handleAdminListTables,
    handleAdminQuery,
    handleAdminStorageStats,
    handleAdminVacuum,
} from './admin.ts';

// Compile handlers
export {
    handleASTParseRequest,
    handleCompileAsync,
    handleCompileBatch,
    handleCompileBatchAsync,
    handleCompileJson,
    handleCompileStream,
} from './compile.ts';

// Metrics handlers
export { handleMetrics, recordMetric } from './metrics.ts';

// Queue handlers
export {
    compress,
    decompress,
    emitDiagnosticsToTailWorker,
    getCacheKey,
    handleQueue,
    handleQueueCancel,
    handleQueueHistory,
    handleQueueResults,
    handleQueueStats,
    processCompileMessage,
    QUEUE_BINDINGS_NOT_AVAILABLE_ERROR,
    updateQueueStats,
} from './queue.ts';
