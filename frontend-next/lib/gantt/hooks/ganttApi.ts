/**
 * Gantt API Abstraction Layer
 *
 * SSoT: This file defines the ONLY difference between template and job Gantt modes.
 * All handlers use these configs - same logic, different endpoints.
 *
 * Template mode: /sm_schedule_master_templates/{id}/rows
 * Job mode: /jobs/{id}/sm_tasks
 */

export type GanttMode = 'template' | 'job';

export interface GanttApiConfig {
  /** Fetch all tasks/rows */
  fetchUrl: string;
  /** Update a single task/row */
  updateUrl: (taskId: string | number) => string;
  /** Validate/rollover dates endpoint (template only) */
  validateDatesUrl?: string;
  /** Payload wrapper key: 'row' for templates, 'sm_task' for jobs */
  payloadWrapper: 'row' | 'sm_task';
  /** API response key for rows array */
  responseKey: 'rows' | 'tasks';
}

/**
 * Get API configuration for a given mode
 */
export function getGanttApiConfig(
  mode: GanttMode,
  options: { templateId?: number; jobId?: number }
): GanttApiConfig {
  if (mode === 'template') {
    if (!options.templateId) {
      throw new Error('templateId required for template mode');
    }
    const baseUrl = `/api/v1/sm_schedule_master_templates/${options.templateId}`;
    return {
      fetchUrl: `${baseUrl}/rows?for=gantt`,
      updateUrl: (taskId) => `${baseUrl}/rows/${taskId}`,
      validateDatesUrl: `${baseUrl}/validate_dates`,
      payloadWrapper: 'row',
      responseKey: 'rows',
    };
  } else {
    if (!options.jobId) {
      throw new Error('jobId required for job mode');
    }
    return {
      fetchUrl: `/api/v1/jobs/${options.jobId}/sm_tasks/gantt_data`,
      updateUrl: (taskId) => `/api/v1/sm_tasks/${taskId}`,
      payloadWrapper: 'sm_task',
      responseKey: 'tasks',
    };
  }
}

/**
 * Wrap payload with the correct key for the API
 */
export function wrapPayload(
  config: GanttApiConfig,
  data: Record<string, unknown>
): Record<string, Record<string, unknown>> {
  return { [config.payloadWrapper]: data };
}
