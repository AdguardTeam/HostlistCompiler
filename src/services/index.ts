/**
 * @module services
 * High-level service layer for the AdBlock Compiler.
 *
 * Exports:
 * - {@link FilterService} – wraps the compiler pipeline in a service-oriented
 *   interface suitable for use inside Cloudflare Workers or other HTTP handlers.
 * - {@link ASTViewerService} – parses individual adblock rules into their abstract
 *   syntax tree representation for inspection and debugging.
 * - {@link AnalyticsService} – records compilation, fetch, and API-request events
 *   to Cloudflare Analytics Engine datasets.
 * - {@link PipelineService} – bridges the compiler to Cloudflare Pipelines for
 *   streaming log/event delivery.
 */
export { FilterService } from './FilterService.ts';
export {
    type AnalyticsEngineDataPoint,
    type AnalyticsEngineDataset,
    type AnalyticsEventData,
    type AnalyticsEventType,
    AnalyticsService,
    type ApiRequestEventData,
    type CompilationEventData,
    type RateLimitEventData,
    type SourceFetchEventData,
    type WorkflowEventData,
} from './AnalyticsService.ts';
export { ASTViewerService, type ParsedRuleInfo, type RuleSummary } from './ASTViewerService.ts';
export { PipelineService } from './PipelineService.ts';
export type { PipelineBinding, PipelineEvent, PipelineEventType, PipelineMessage } from './PipelineService.ts';
