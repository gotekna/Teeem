import useSWR from 'swr';
import { api } from '@/lib/api';

export interface OnboardingStep {
  key: string;
  name: string;
  description: string;
  category: 'required' | 'configuration' | 'data_import' | 'integrations';
  required: boolean;
  complete: boolean;
  status: 'not_started' | 'in_progress' | 'complete' | 'skipped';
  settings_path?: string;
  import_type?: string;
  template_available?: boolean;
  estimated_minutes?: number;
  assigned_user_id?: number;
  assigned_user_name?: string;
}

export interface OnboardingProgress {
  total_steps: number;
  completed_steps: number;
  percentage: number;
  required_total: number;
  required_complete: number;
  required_percentage: number;
}

export interface OnboardingCategory {
  total: number;
  complete: number;
  steps: OnboardingStep[];
}

export interface OnboardingStatus {
  tenant_id: number;
  started_at: string | null;
  completed_at: string | null;
  in_progress: boolean;
  progress: OnboardingProgress;
  steps: OnboardingStep[];
  categories: {
    required: OnboardingCategory;
    configuration: OnboardingCategory;
    data_import: OnboardingCategory;
    integrations: OnboardingCategory;
  };
}

interface ApiResponse {
  success: boolean;
  data?: OnboardingStatus;
  error?: string;
}

async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const response = await api.get('/api/v1/onboarding/status') as ApiResponse;
  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch onboarding status');
  }
  return response.data as OnboardingStatus;
}

export function useOnboardingStatus() {
  const { data, error, isLoading, mutate } = useSWR<OnboardingStatus>(
    '/api/v1/onboarding/status',
    fetchOnboardingStatus,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  return {
    status: data,
    isLoading,
    error,
    refresh: mutate,
    // Only consider complete if data is loaded AND completed_at is set
    isComplete: data !== undefined && data.completed_at !== null,
    progress: data?.progress,
    requiredComplete: data?.progress?.required_complete === data?.progress?.required_total,
  };
}

export async function assignStep(stepKey: string, userId: number): Promise<void> {
  const response = await api.post(`/api/v1/onboarding/steps/${stepKey}/assign`, { user_id: userId }) as ApiResponse;
  if (!response.success) {
    throw new Error(response.error || 'Failed to assign step');
  }
}

export async function skipStep(stepKey: string): Promise<void> {
  const response = await api.post(`/api/v1/onboarding/steps/${stepKey}/skip`) as ApiResponse;
  if (!response.success) {
    throw new Error(response.error || 'Failed to skip step');
  }
}

export async function completeOnboarding(): Promise<void> {
  const response = await api.post('/api/v1/onboarding/complete') as ApiResponse;
  if (!response.success) {
    throw new Error(response.error || 'Failed to complete onboarding');
  }
}

export async function downloadTemplate(type: string): Promise<Blob> {
  const response = await fetch(`/api/v1/onboarding/templates/${type}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to download template');
  }
  return response.blob();
}

export interface ImportPreviewResult {
  valid: boolean;
  errors: Array<{
    row: number;
    column?: string;
    value?: string;
    message: string;
  }>;
  warnings: Array<{
    row: number;
    column?: string;
    value?: string;
    message: string;
  }>;
  preview: Array<{
    row: number;
    status: 'valid' | 'error' | 'warning';
    errors: Array<{ message: string }>;
    warnings: Array<{ message: string }>;
    [key: string]: unknown;
  }>;
  total_rows: number;
}

export async function previewImport(
  type: string,
  file: File,
  options: Record<string, boolean> = {}
): Promise<ImportPreviewResult> {
  const formData = new FormData();
  formData.append('type', type);
  formData.append('file', file);
  Object.entries(options).forEach(([key, value]) => {
    formData.append(key, String(value));
  });

  const response = await api.postFormData('/api/v1/onboarding/import/preview', formData) as { success: boolean; data?: ImportPreviewResult; error?: string };
  if (!response.success) {
    throw new Error(response.error || 'Failed to preview import');
  }
  return response.data as ImportPreviewResult;
}

export interface ImportResult {
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  errors_count: number;
  audit_log_id: number;
}

export async function executeImport(
  type: string,
  file: File,
  options: Record<string, boolean> = {}
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('type', type);
  formData.append('file', file);
  Object.entries(options).forEach(([key, value]) => {
    formData.append(key, String(value));
  });

  const response = await api.postFormData('/api/v1/onboarding/import/execute', formData) as { success: boolean; data?: ImportResult; error?: string };
  if (!response.success) {
    throw new Error(response.error || 'Failed to execute import');
  }
  return response.data as ImportResult;
}
