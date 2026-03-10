/**
 * Handler exports for the Cloudflare Worker.
 */

// Admin handlers
export { handleAdminClearCache, handleAdminClearExpired, handleAdminExport, handleAdminListTables, handleAdminQuery, handleAdminStorageStats, handleAdminVacuum } from './admin.ts';

// Browser Rendering handlers
export { handleMonitorLatest } from './monitor-latest.ts';
export { handleResolveUrl } from './url-resolver.ts';
export { handleSourceMonitor } from './source-monitor.ts';

// Compile handlers
export { handleASTParseRequest, handleCompileAsync, handleCompileBatch, handleCompileBatchAsync, handleCompileJson, handleCompileStream } from './compile.ts';

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

// Rule validation handler (POST /api/validate-rule)
export { handleValidateRule } from './validate-rule.ts';

// Rule management handlers (POST/GET/PUT/DELETE /api/rules)
export { handleRulesCreate, handleRulesDelete, handleRulesGet, handleRulesList, handleRulesUpdate } from './rules.ts';

// Webhook / notification handler (POST /api/notify)
export { handleNotify } from './webhook.ts';
