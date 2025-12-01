/**
 * Shared API utilities for Teeem Zapier integration
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.teeem.com.au';

/**
 * Build full API URL
 */
const buildUrl = (path) => {
  return `${API_BASE_URL}${path}`;
};

/**
 * Standard request configuration with auth
 */
const makeRequest = async (z, bundle, options) => {
  const request = {
    url: buildUrl(options.path),
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bundle.authData.access_token}`,
    },
    params: options.params || {},
    body: options.body,
  };

  const response = await z.request(request);

  if (response.status >= 400) {
    const errorMessage = response.data?.error || response.data?.message || 'Unknown error';
    throw new z.errors.Error(
      `API Error: ${errorMessage}`,
      'ApiError',
      response.status
    );
  }

  return response.data;
};

/**
 * Subscribe to a webhook (REST Hook pattern)
 */
const subscribeHook = async (z, bundle, eventType) => {
  const response = await makeRequest(z, bundle, {
    path: '/api/v1/zapier/webhooks/subscribe',
    method: 'POST',
    body: {
      target_url: bundle.targetUrl,
      event: eventType,
    },
  });

  return response;
};

/**
 * Unsubscribe from a webhook
 */
const unsubscribeHook = async (z, bundle) => {
  await makeRequest(z, bundle, {
    path: `/api/v1/zapier/webhooks/${bundle.subscribeData.id}/unsubscribe`,
    method: 'DELETE',
  });

  return {};
};

/**
 * Get sample data for a resource
 */
const getSample = async (z, bundle, resourceType) => {
  return makeRequest(z, bundle, {
    path: `/api/v1/zapier/samples/${resourceType}`,
    method: 'GET',
  });
};

/**
 * Poll for new/updated resources
 */
const pollForResources = async (z, bundle, resourceType, params = {}) => {
  const data = await makeRequest(z, bundle, {
    path: `/api/v1/zapier/polling/${resourceType}`,
    method: 'GET',
    params: {
      limit: 100,
      ...params,
    },
  });

  // Zapier expects an array, sorted newest first
  return Array.isArray(data) ? data : data[resourceType] || [];
};

module.exports = {
  API_BASE_URL,
  buildUrl,
  makeRequest,
  subscribeHook,
  unsubscribeHook,
  getSample,
  pollForResources,
};
