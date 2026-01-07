/**
 * Gantt API Response Schemas
 *
 * SSoT: Zod schemas for runtime validation of Gantt API responses.
 * These catch API contract mismatches that TypeScript can't detect at runtime.
 *
 * Why Zod?
 * - TypeScript types are compile-time only - they can't validate runtime data
 * - API responses may not match expected shapes (wrong keys, missing fields)
 * - Zod validates at runtime and provides clear error messages
 *
 * Usage:
 *   const deps = GanttDependencySchema.array().parse(apiResponse.dependencies);
 *   // Throws ZodError if shape doesn't match - fails fast, easy to debug
 */

import { z } from 'zod';

// =============================================================================
// Dependency Schema
// =============================================================================

/**
 * SSoT: Backend returns camelCase keys (fromId, toId)
 * @see backend/app/services/gantt_data_service.rb - build_dependencies method
 */
export const GanttDependencySchema = z.object({
  id: z.string(),
  fromId: z.string(),  // NOT from_id - backend uses camelCase
  toId: z.string(),    // NOT to_id - backend uses camelCase
  type: z.enum(['FS', 'SS', 'FF', 'SF']),
  lag: z.number().optional(),
});

export type GanttDependencyValidated = z.infer<typeof GanttDependencySchema>;

// =============================================================================
// Task Schema (partial - key fields for validation)
// =============================================================================

/**
 * Validates critical task fields that affect Gantt rendering.
 * Not exhaustive - focuses on fields that have caused bugs.
 */
export const GanttTaskSchema = z.object({
  id: z.number(),
  task_number: z.number(),
  name: z.string(),
  sequence_order: z.number().nullable().optional(),
  duration_days: z.number().nullable().optional(),
  predecessor_ids: z.array(z.object({
    id: z.number(),
    type: z.enum(['FS', 'SS', 'FF', 'SF']).optional(),
    lag: z.number().optional(),
  })).nullable().optional(),
}).passthrough(); // Allow additional fields

export type GanttTaskValidated = z.infer<typeof GanttTaskSchema>;

// =============================================================================
// Full Response Schemas
// =============================================================================

/**
 * Job Gantt Data response (from /api/v1/jobs/:id/sm_tasks/gantt_data)
 */
export const JobGanttDataResponseSchema = z.object({
  success: z.boolean(),
  gantt_data: z.object({
    tasks: z.array(GanttTaskSchema),
    dependencies: z.array(GanttDependencySchema),
  }),
});

/**
 * Template rows response (from /api/v1/sm_schedule_master_templates/:id/rows)
 */
export const TemplateRowsResponseSchema = z.object({
  success: z.boolean(),
  rows: z.array(GanttTaskSchema),
});

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate dependencies array with helpful error messages.
 * Use this instead of raw .parse() for better debugging.
 */
export function validateDependencies(deps: unknown[]): GanttDependencyValidated[] {
  try {
    return GanttDependencySchema.array().parse(deps);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Gantt Schema] Dependency validation failed:', {
        issues: error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
        hint: 'Check backend key names (should be camelCase: fromId, toId)',
        sampleData: deps.slice(0, 2), // Show first 2 items for debugging
      });
    }
    throw error;
  }
}

/**
 * Safe parse that returns null instead of throwing.
 * Useful for optional validation where you want to continue with raw data.
 */
export function safeParseDependencies(deps: unknown[]): GanttDependencyValidated[] | null {
  const result = GanttDependencySchema.array().safeParse(deps);
  if (!result.success) {
    console.warn('[Gantt Schema] Dependency validation failed (continuing with raw data):', {
      issues: result.error.issues.slice(0, 3), // First 3 issues
    });
    return null;
  }
  return result.data;
}
