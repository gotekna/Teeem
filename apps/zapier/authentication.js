/**
 * OAuth 2.0 Authentication for Teeem Zapier Integration
 *
 * This handles the OAuth flow between Zapier and Teeem's API.
 * Users will be redirected to Teeem to authorize, then back to Zapier.
 */

const getAccessToken = async (z, bundle) => {
  const response = await z.request({
    url: `${process.env.API_BASE_URL}/api/v1/zapier/oauth/token`,
    method: 'POST',
    body: {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: bundle.inputData.code,
      redirect_uri: bundle.inputData.redirect_uri,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status !== 200) {
    throw new z.errors.Error(
      'Unable to fetch access token: ' + response.content,
      'AuthenticationError',
      response.status
    );
  }

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token,
    expires_in: response.data.expires_in,
  };
};

const refreshAccessToken = async (z, bundle) => {
  const response = await z.request({
    url: `${process.env.API_BASE_URL}/api/v1/zapier/oauth/token`,
    method: 'POST',
    body: {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: bundle.authData.refresh_token,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status !== 200) {
    throw new z.errors.Error(
      'Unable to refresh access token: ' + response.content,
      'AuthenticationError',
      response.status
    );
  }

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token || bundle.authData.refresh_token,
    expires_in: response.data.expires_in,
  };
};

const testAuth = async (z, bundle) => {
  const response = await z.request({
    url: `${process.env.API_BASE_URL}/api/v1/zapier/me`,
    method: 'GET',
  });

  if (response.status !== 200) {
    throw new z.errors.Error(
      'The access token you provided is invalid.',
      'AuthenticationError',
      response.status
    );
  }

  return response.data;
};

module.exports = {
  type: 'oauth2',

  oauth2Config: {
    authorizeUrl: {
      url: `{{process.env.API_BASE_URL}}/api/v1/zapier/oauth/authorize`,
      params: {
        client_id: '{{process.env.CLIENT_ID}}',
        redirect_uri: '{{bundle.inputData.redirect_uri}}',
        response_type: 'code',
        scope: 'contacts:read contacts:write jobs:read jobs:write purchase_orders:read purchase_orders:write estimates:read estimates:write documents:read webhooks:manage',
        state: '{{bundle.inputData.state}}',
      },
    },

    getAccessToken,
    refreshAccessToken,
    autoRefresh: true,

    scope: 'contacts:read contacts:write jobs:read jobs:write purchase_orders:read purchase_orders:write estimates:read estimates:write documents:read webhooks:manage',
  },

  // Test the authentication
  test: testAuth,

  // Connection label shown in Zapier UI
  connectionLabel: '{{bundle.authData.organization_name}} ({{bundle.authData.user_email}})',

  // Add auth headers to all requests
  befores: [],
  afters: [],
};

// Middleware to add auth header to all requests
const addAuthHeader = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.access_token) {
    request.headers = request.headers || {};
    request.headers['Authorization'] = `Bearer ${bundle.authData.access_token}`;
  }
  return request;
};

// Export middleware for use in other files
module.exports.addAuthHeader = addAuthHeader;
