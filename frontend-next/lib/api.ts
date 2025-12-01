/**
 * API Client for Teeem
 * Fetch-based API client with authentication headers
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').trim();

interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

interface DownloadProgressEvent {
  loaded: number;
  total: number;
  progress: number;
}

interface GetOptions {
  params?: Record<string, string | number | boolean>;
  onDownloadProgress?: (event: DownloadProgressEvent) => void;
}

interface DeleteOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
}

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
    errorMessage = errorData.errors.join(', ');
  } else {
    errorMessage = errorData.error || `API request failed with status ${response.status}`;
  }

  const error: ApiError = new Error(errorMessage);
  error.status = response.status;
  error.data = errorData;
  throw error;
};

export const api = {
  async get<T = unknown>(endpoint: string, options: GetOptions = {}): Promise<T> {
    let url = `${API_URL}${endpoint}`;

    if (options.params) {
      const queryString = new URLSearchParams(
        Object.entries(options.params).map(([k, v]) => [k, String(v)])
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    // If onDownloadProgress callback is provided, use streaming to track progress
    if (options.onDownloadProgress && response.body) {
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

        options.onDownloadProgress({
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
  },

  async post<T = unknown>(endpoint: string, data?: unknown): Promise<T | null> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }

    return response.json() as Promise<T>;
  },

  async postFormData<T = unknown>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  },

  async put<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  },

  async patch<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  },

  async delete<T = unknown>(endpoint: string, options: DeleteOptions = {}): Promise<T | null> {
    let url = `${API_URL}${endpoint}`;

    if (options.params) {
      const queryString = new URLSearchParams(
        Object.entries(options.params).map(([k, v]) => [k, String(v)])
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: options.data ? JSON.stringify(options.data) : undefined,
    });

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
    getAuthUrl: () => api.get<{ url: string }>('/api/v1/xero/auth_url'),
    callback: (code: string) => api.post('/api/v1/xero/callback', { code }),
    getStatus: () => api.get<{ connected: boolean }>('/api/v1/xero/status'),
    disconnect: () => api.delete('/api/v1/xero/disconnect'),
  },
};

export default api;
