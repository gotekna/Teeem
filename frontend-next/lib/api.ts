/**
 * API Client for Teeem
 * Fetch-based API client with authentication headers, timeouts, retry logic, and request deduplication
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').trim();

// Configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second, doubles with each retry
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

interface ApiError extends Error {
  status?: number;
  data?: unknown;
  isTimeout?: boolean;
  isRetryable?: boolean;
}

interface DownloadProgressEvent {
  loaded: number;
  total: number;
  progress: number;
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  dedupe?: boolean;
}

interface GetOptions extends RequestOptions {
  params?: Record<string, string | number | boolean>;
  onDownloadProgress?: (event: DownloadProgressEvent) => void;
}

interface DeleteOptions extends RequestOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
}

interface PostOptions extends RequestOptions {}

// Request deduplication cache
const pendingRequests = new Map<string, Promise<unknown>>();

const getAuthHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add JWT token if available (client-side only)
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

const handleErrorResponse = async (response: Response): Promise<never> => {
  const errorData = await response.json().catch(() => ({}));

  let errorMessage: string;
  if (errorData.errors && Array.isArray(errorData.errors)) {
    // Properly format error objects
    errorMessage = errorData.errors.map((err: any) => {
      if (typeof err === 'string') return err;
      if (err.email && err.error) return `${err.email}: ${err.error}`;
      if (err.error) return err.error;
      return JSON.stringify(err);
    }).join('; ');
  } else {
    errorMessage = errorData.error || `API request failed with status ${response.status}`;
  }

  const error: ApiError = new Error(errorMessage);
  error.status = response.status;
  error.data = errorData;
  error.isRetryable = RETRYABLE_STATUS_CODES.includes(response.status);
  throw error;
};

/**
 * Creates a fetch request with timeout
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError: ApiError = new Error(`Request timeout after ${timeout}ms`);
      timeoutError.isTimeout = true;
      timeoutError.isRetryable = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Retry logic with exponential backoff
 */
const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const apiError = error as ApiError;

      // Don't retry if it's not a retryable error
      if (!apiError.isRetryable && !apiError.isTimeout) {
        throw error;
      }

      // Don't retry if we've exhausted retries
      if (attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));

      console.warn(`API retry attempt ${attempt + 1}/${maxRetries} after error:`, apiError.message);
    }
  }

  throw lastError;
};

/**
 * Request deduplication - prevents duplicate concurrent requests
 */
const withDeduplication = async <T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> => {
  // Check if there's already a pending request for this key
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  // Create the request and store it
  const promise = fn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
};

/**
 * Generate a unique key for request deduplication
 */
const getRequestKey = (method: string, url: string, body?: unknown): string => {
  const bodyHash = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyHash}`;
};

export const api = {
  async get<T = unknown>(endpoint: string, options: GetOptions = {}): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, dedupe = true, ...restOptions } = options;

    let url = `${API_URL}${endpoint}`;

    if (restOptions.params) {
      const queryString = new URLSearchParams(
        Object.entries(restOptions.params).map(([k, v]) => [k, String(v)])
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const requestKey = getRequestKey('GET', url);

    const doRequest = async () => {
      const response = await withRetry(
        () => fetchWithTimeout(url, {
          method: 'GET',
          headers: getAuthHeaders(),
          credentials: 'include',
        }, timeout),
        retries
      );

      if (!response.ok) {
        await handleErrorResponse(response);
      }

      // If onDownloadProgress callback is provided, use streaming to track progress
      if (restOptions.onDownloadProgress && response.body) {
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          loaded += value.length;

          restOptions.onDownloadProgress({
            loaded,
            total,
            progress: total ? loaded / total : 0
          });
        }

        // Combine chunks and parse JSON
        const chunksAll = new Uint8Array(loaded);
        let position = 0;
        for (const chunk of chunks) {
          chunksAll.set(chunk, position);
          position += chunk.length;
        }

        const text = new TextDecoder('utf-8').decode(chunksAll);
        return JSON.parse(text) as T;
      }

      return response.json() as Promise<T>;
    };

    // Use deduplication for GET requests by default
    if (dedupe) {
      return withDeduplication(requestKey, doRequest);
    }

    return doRequest();
  },

  async post<T = unknown>(endpoint: string, data?: unknown, options: PostOptions = {}): Promise<T | null> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options;

    const response = await withRetry(
      () => fetchWithTimeout(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data),
      }, timeout),
      retries
    );

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }

    return response.json() as Promise<T>;
  },

  async postFormData<T = unknown>(endpoint: string, formData: FormData, options: PostOptions = {}): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options;

    const headers: Record<string, string> = {};

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await withRetry(
      () => fetchWithTimeout(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      }, timeout),
      retries
    );

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  },

  async put<T = unknown>(endpoint: string, data?: unknown, options: PostOptions = {}): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options;

    const response = await withRetry(
      () => fetchWithTimeout(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data),
      }, timeout),
      retries
    );

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  },

  async putFormData<T = unknown>(endpoint: string, formData: FormData, options: PostOptions = {}): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options;

    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    const response = await withRetry(
      () => fetchWithTimeout(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: formData,
      }, timeout),
      retries
    );
    if (!response.ok) {
      await handleErrorResponse(response);
    }
    return response.json() as Promise<T>;
  },

  async patch<T = unknown>(endpoint: string, data?: unknown, options: PostOptions = {}): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options;

    const response = await withRetry(
      () => fetchWithTimeout(`${API_URL}${endpoint}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data),
      }, timeout),
      retries
    );

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  },

  async delete<T = unknown>(endpoint: string, options: DeleteOptions = {}): Promise<T | null> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, ...restOptions } = options;

    let url = `${API_URL}${endpoint}`;

    if (restOptions.params) {
      const queryString = new URLSearchParams(
        Object.entries(restOptions.params).map(([k, v]) => [k, String(v)])
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await withRetry(
      () => fetchWithTimeout(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: restOptions.data ? JSON.stringify(restOptions.data) : undefined,
      }, timeout),
      retries
    );

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }

    // Try to parse JSON, return null if empty
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : null;
  },

  // Xero Integration APIs
  xero: {
    getAuthUrl: () => api.get<{ success: boolean; auth_url: string; url?: string }>('/api/v1/xero/auth_url'),
    callback: (code: string) => api.post('/api/v1/xero/callback', { code }),
    getStatus: () => api.get<{ success: boolean; data: { connected: boolean; organization_name?: string; tenant_name?: string; tenant_id?: string; connected_at?: string; expires_at?: string; expired?: boolean } }>('/api/v1/xero/status'),
    disconnect: () => api.delete('/api/v1/xero/disconnect'),
  },

  // Utility to clear pending requests (useful for testing or cleanup)
  clearPendingRequests: () => {
    pendingRequests.clear();
  },
};

export default api;
