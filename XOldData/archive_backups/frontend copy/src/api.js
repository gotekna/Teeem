const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

export const api = {
  async get(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  },

  async post(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('API request failed');
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
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  },

  async put(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  },

  async patch(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  },

  async delete(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  },
};
