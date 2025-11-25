// Trim the API URL to remove any whitespace/newlines from environment variables
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').trim();

const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Add JWT token if available
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

export const api = {
  async get(endpoint, options = {}) {
    // Build query string from params if provided
    let url = `${API_URL}${endpoint}`;
    if (options.params) {
      const queryString = new URLSearchParams(options.params).toString();
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
      const errorData = await response.json().catch(() => ({}));
      // Handle both single error and array of errors
      let errorMessage;
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.join(', ');
      } else {
        errorMessage = errorData.error || `API request failed with status ${response.status}`;
      }
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    // If onDownloadProgress callback is provided, use streaming to track progress
    if (options.onDownloadProgress && response.body) {
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        // Call progress callback
        if (options.onDownloadProgress) {
          options.onDownloadProgress({
            loaded,
            total,
            progress: total ? loaded / total : 0
          });
        }
      }

      // Combine chunks and parse JSON
      const chunksAll = new Uint8Array(loaded);
      let position = 0;
      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      const text = new TextDecoder('utf-8').decode(chunksAll);
      return JSON.parse(text);
    }

    return response.json();
  },

  async post(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Handle both single error and array of errors
      let errorMessage;
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.join(', ');
      } else {
        errorMessage = errorData.error || `API request failed with status ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }
    return response.json();
  },

  async postFormData(endpoint, formData) {
    const token = localStorage.getItem('token');
    const headers = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Handle both single error and array of errors
      let errorMessage;
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.join(', ');
      } else {
        errorMessage = errorData.error || `API request failed with status ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  },

  async put(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Handle both single error and array of errors
      let errorMessage;
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.join(', ');
      } else {
        errorMessage = errorData.error || `API request failed with status ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  },

  async patch(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Handle both single error and array of errors
      let errorMessage;
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.join(', ');
      } else {
        errorMessage = errorData.error || `API request failed with status ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  },

  async delete(endpoint, options = {}) {
    // Build query string from params if provided
    let url = `${API_URL}${endpoint}`;
    if (options.params) {
      const queryString = new URLSearchParams(options.params).toString();
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
      const errorData = await response.json().catch(() => ({}));
      // Handle both single error and array of errors
      let errorMessage;
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.join(', ');
      } else {
        errorMessage = errorData.error || `API request failed with status ${response.status}`;
      }
      throw new Error(errorMessage);
    }
    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }
    // Try to parse JSON, return null if empty
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  },

  // Xero Integration APIs
  xero: {
    getAuthUrl: () => api.get('/api/v1/xero/auth_url'),
    callback: (code) => api.post('/api/v1/xero/callback', { code }),
    getStatus: () => api.get('/api/v1/xero/status'),
    disconnect: () => api.delete('/api/v1/xero/disconnect'),
  },
};

export default api;
