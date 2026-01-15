/**
 * Cloudflare Workflows for the Adblock Compiler.
 *
 * This module exports all workflow implementations and types for durable
 * execution of compilation, batch processing, cache warming, and health monitoring.
 *
 * Benefits of using Workflows:
 * - Automatic state persistence between steps
 * - Crash recovery - resumes from last successful step
 * - Built-in retry with configurable policies
 * - Observable step-by-step progress
 * - Reliable scheduled execution with cron triggers
 */

// Export workflow classes
export { CompilationWorkflow } from './CompilationWorkflow.ts';
export { BatchCompilationWorkflow } from './BatchCompilationWorkflow.ts';
export { CacheWarmingWorkflow } from './CacheWarmingWorkflow.ts';
export { HealthMonitoringWorkflow } from './HealthMonitoringWorkflow.ts';

// Export all types
export type {
    // Workflow parameters
    CompilationParams,
    BatchCompilationParams,
    CacheWarmingParams,
    HealthMonitoringParams,
    // Result types
    SourceFetchResult,
    TransformationResult,
    WorkflowCompilationResult,
    BatchWorkflowResult,
    CacheWarmingResult,
    SourceHealthResult,
    HealthMonitoringResult,
    // Status types
    WorkflowStatus,
    WorkflowInstanceInfo,
} from './types.ts';
