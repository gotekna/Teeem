/**
 * API Client for Teeem
 * Fetch-based API client with authentication headers, timeouts, retry logic, and request deduplication
 *
 * SSoT: API URL Selection
 * - Production backend is the "router" - it stores all companies' environment preferences
 * - On login, production backend returns api_url for the company's chosen environment
 * - Frontend stores this in localStorage and uses it for all subsequent requests
 * - LOGIN ALWAYS uses PRODUCTION_API_URL (to get the routing info)
 */

import { API_TIMEOUT_DEFAULT, API_RETRY_DELAY_BASE } from './constants/timeout-constants';

// Production backend is always the "router" for login
const PRODUCTION_API_URL = 'https://teeem-production-121159e1ff9d.herokuapp.com';

// Default API URL (production) - used if no stored api_url
const DEFAULT_API_URL = (process.env.NEXT_PUBLIC_API_URL || PRODUCTION_API_URL).trim();

/**
 * Get the current API base URL
 * - Returns stored api_url from localStorage if available (set during login)
 * - Falls back to DEFAULT_API_URL
 */
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const storedUrl = localStorage.getItem('api_url');
    if (storedUrl) {
      return storedUrl;
    }
  }
  return DEFAULT_API_URL;
};

/**
 * Get the API URL to use for the current request
 * This is computed fresh for each request to support environment switching
 */
const getApiUrl = () => getApiBaseUrl();

/**
 * Get the production API URL (used for login only)
 * Production backend is the "router" - it stores all companies' env preferences
 */
export const getProductionApiUrl = () => PRODUCTION_API_URL;

/**
 * Store the API URL returned from login
 * Called by AuthContext after successful login
 */
export const setApiUrl = (url: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('api_url', url);
  }
};

/**
 * Clear the stored API URL (called on logout)
 */
export const clearApiUrl = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('api_url');
  }
};

/**
 * Get the current environment name from localStorage
 */
export const getCurrentEnvironment = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('api_environment') || 'production';
  }
  return 'production';
};

/**
 * Store the environment name returned from login
 */
export const setEnvironment = (env: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('api_environment', env);
  }
};

/**
 * Clear the stored environment (called on logout)
 */
export const clearEnvironment = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('api_environment');
  }
};

// Configuration
// SSoT: Timeout constants from timeout-constants.ts
const DEFAULT_TIMEOUT = API_TIMEOUT_DEFAULT;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = API_RETRY_DELAY_BASE;
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
  skipAuthRedirect?: boolean; // Skip redirect to login on 401 (for optional integrations like SharePoint)
}

interface GetOptions extends RequestOptions {
  params?: Record<string, string | number | boolean>;
  onDownloadProgress?: (event: DownloadProgressEvent) => void;
  signal?: AbortSignal; // For request cancellation
}

interface DeleteOptions extends RequestOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
}

type PostOptions = RequestOptions;

// Request deduplication cache
const pendingRequests = new Map<string, Promise<unknown>>();

const getAuthHeaders = (includeContentType = true): HeadersInit => {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  // Add JWT token if available (client-side only)
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

// Helper to clear auth token (mirrors AuthContext's clearAuthToken)
const clearAuthToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    document.cookie = 'auth_token=; path=/; max-age=0';
  }
};

const handleErrorResponse = async (response: Response, skipAuthRedirect = false): Promise<never> => {
  const errorData = await response.json().catch(() => ({}));

  // Handle 401 Unauthorized - session expired
  if (response.status === 401) {
    const error: ApiError = new Error('Session expired - please log in again');
    error.status = 401;
    error.data = errorData;
    error.isRetryable = false;

    // Only clear token and redirect if skipAuthRedirect is false
    // skipAuthRedirect is used for optional integrations like SharePoint that may not be connected
    // In those cases, a 401 means "not connected" not "session expired"
    if (!skipAuthRedirect && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      clearAuthToken();
      // Use setTimeout to allow the error to be thrown first
      setTimeout(() => {
        window.location.href = '/login?expired=true';
      }, 100);
    }

    throw error;
  }

  let errorMessage: string;
  if (errorData.errors && Array.isArray(errorData.errors)) {
    // Properly format error objects
    errorMessage = errorData.errors.map((err: string | { email?: string; error?: string }) => {
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
 * Creates a fetch request with timeout and optional external abort signal
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number,
  externalSignal?: AbortSignal
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // If external signal is provided, abort when it aborts
  const externalAbortHandler = () => controller.abort();
  if (externalSignal) {
    externalSignal.addEventListener('abort', externalAbortHandler);
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Distinguish between timeout abort and external abort
      if (externalSignal?.aborted) {
        // Re-throw as AbortError so caller can identify it
        throw error;
      }
      const timeoutError: ApiError = new Error(`Request timeout after ${timeout}ms`);
      timeoutError.isTimeout = true;
      timeoutError.isRetryable = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', externalAbortHandler);
    }
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
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, dedupe = true, signal, skipAuthRedirect = false, ...restOptions } = options;

    let url = `${getApiUrl()}${endpoint}`;

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
      const headers = {
        ...getAuthHeaders(),
        // Add cache control headers when dedupe is disabled
        ...(dedupe === false && {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        })
      };

      const response = await withRetry(
        () => fetchWithTimeout(url, {
          method: 'GET',
          headers,
          credentials: 'include',
        }, timeout, signal),
        signal ? 0 : retries  // Don't retry if caller wants to control cancellation
      );

      if (!response.ok) {
        await handleErrorResponse(response, skipAuthRedirect);
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
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, skipAuthRedirect = false } = options;

    const response = await withRetry(
      () => fetchWithTimeout(`${getApiUrl()}${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data),
      }, timeout),
      retries
    );

    if (!response.ok) {
      await handleErrorResponse(response, skipAuthRedirect);
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
      () => fetchWithTimeout(`${getApiUrl()}${endpoint}`, {
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
      () => fetchWithTimeout(`${getApiUrl()}${endpoint}`, {
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
      () => fetchWithTimeout(`${getApiUrl()}${endpoint}`, {
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
    const isFormData = data instanceof FormData;

    const response = await withRetry(
      () => fetchWithTimeout(`${getApiUrl()}${endpoint}`, {
        method: 'PATCH',
        headers: getAuthHeaders(!isFormData), // Don't set Content-Type for FormData
        credentials: 'include',
        body: isFormData ? data : JSON.stringify(data),
      }, timeout),
      retries
    );

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  },

  async postBlob(endpoint: string, data?: unknown, options: PostOptions = {}): Promise<Blob> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options;

    const response = await withRetry(
      () => fetchWithTimeout(`${getApiUrl()}${endpoint}`, {
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

    return response.blob();
  },

  /**
   * GET request returning a Blob (for images, PDFs, file downloads)
   */
  async getBlob(endpoint: string, options: GetOptions = {}): Promise<Blob> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, dedupe = false, signal, skipAuthRedirect = false, ...restOptions } = options;

    let url = `${getApiUrl()}${endpoint}`;

    if (restOptions.params) {
      const queryString = new URLSearchParams(
        Object.entries(restOptions.params).map(([k, v]) => [k, String(v)])
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const doRequest = async () => {
      const response = await withRetry(
        () => fetchWithTimeout(url, {
          method: 'GET',
          headers: getAuthHeaders(false), // No Content-Type for blob requests
          credentials: 'include',
        }, timeout, signal),
        signal ? 0 : retries
      );

      if (!response.ok) {
        await handleErrorResponse(response, skipAuthRedirect);
      }

      return response.blob();
    };

    // Blob requests typically shouldn't be deduplicated (different uses of same URL)
    return doRequest();
  },

  /**
   * GET request returning text (for HTML previews, templates)
   */
  async getText(endpoint: string, options: GetOptions = {}): Promise<string> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, dedupe = true, signal, skipAuthRedirect = false, ...restOptions } = options;

    let url = `${getApiUrl()}${endpoint}`;

    if (restOptions.params) {
      const queryString = new URLSearchParams(
        Object.entries(restOptions.params).map(([k, v]) => [k, String(v)])
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const requestKey = getRequestKey('GET_TEXT', url);

    const doRequest = async () => {
      const response = await withRetry(
        () => fetchWithTimeout(url, {
          method: 'GET',
          headers: getAuthHeaders(false), // No Content-Type needed
          credentials: 'include',
        }, timeout, signal),
        signal ? 0 : retries
      );

      if (!response.ok) {
        await handleErrorResponse(response, skipAuthRedirect);
      }

      return response.text();
    };

    if (dedupe) {
      return withDeduplication(requestKey, doRequest);
    }

    return doRequest();
  },

  /**
   * GET request returning raw Response (for streaming, custom handling)
   */
  async getRaw(endpoint: string, options: GetOptions = {}): Promise<Response> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, signal, skipAuthRedirect = false, ...restOptions } = options;

    let url = `${getApiUrl()}${endpoint}`;

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
        method: 'GET',
        headers: getAuthHeaders(false),
        credentials: 'include',
      }, timeout, signal),
      signal ? 0 : retries
    );

    if (!response.ok) {
      await handleErrorResponse(response, skipAuthRedirect);
    }

    return response;
  },

  async delete<T = unknown>(endpoint: string, options: DeleteOptions = {}): Promise<T | null> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, ...restOptions } = options;

    let url = `${getApiUrl()}${endpoint}`;

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

  /**
   * Login endpoint that ALWAYS uses production backend
   * Production backend is the "router" - it returns api_url for the company's chosen environment
   *
   * Response includes:
   * - token: JWT token
   * - api_url: The API URL to use for this company's chosen environment
   * - environment: The environment name ('production', 'beta', 'staging')
   * - user: User data
   */
  async loginToProduction<T = unknown>(data: { user: { email: string; password: string } }): Promise<T | null> {
    const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = {};

    // ALWAYS use production URL for login - it's the "router"
    const response = await withRetry(
      () => fetchWithTimeout(`${PRODUCTION_API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data),
      }, timeout),
      retries
    );

    if (!response.ok) {
      await handleErrorResponse(response, false);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }

    return response.json() as Promise<T>;
  },

  // Utility to clear pending requests (useful for testing or cleanup)
  clearPendingRequests: () => {
    pendingRequests.clear();
  },
};

export default api;
