const { makeRequest } = require('../lib/api');

/**
 * Find Contact Search
 * Finds a contact by email or name
 */
module.exports = {
  key: 'find_contact',
  noun: 'Contact',

  display: {
    label: 'Find Contact',
    description: 'Finds an existing contact by email or name.',
  },

  operation: {
    inputFields: [
      {
        key: 'email',
        label: 'Email',
        type: 'string',
        required: false,
        helpText: 'Search by email address (exact match)',
      },
      {
        key: 'name',
        label: 'Name',
        type: 'string',
        required: false,
        helpText: 'Search by name (partial match)',
      },
      {
        key: 'type',
        label: 'Contact Type',
        type: 'string',
        required: false,
        choices: [
          { value: 'customer', label: 'Customer', sample: 'customer' },
          { value: 'supplier', label: 'Supplier', sample: 'supplier' },
          { value: 'both', label: 'Both', sample: 'both' },
        ],
        helpText: 'Filter by contact type',
      },
    ],

    perform: async (z, bundle) => {
      if (!bundle.inputData.email && !bundle.inputData.name) {
        throw new z.errors.Error(
          'Please provide either an email or name to search.',
          'InputError',
          400
        );
      }

      const params = {};
      if (bundle.inputData.email) params.email = bundle.inputData.email;
      if (bundle.inputData.name) params.name = bundle.inputData.name;
      if (bundle.inputData.type) params.type = bundle.inputData.type;

      const data = await makeRequest(z, bundle, {
        path: '/api/v1/zapier/contacts',
        method: 'GET',
        params,
      });

      // Return array of matching contacts
      return Array.isArray(data) ? data : data.contacts || [];
    },

    sample: {
      id: 12345,
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+61 412 345 678',
      mobile: '+61 412 345 678',
      company: 'Acme Construction',
      type: 'customer',
      abn: '12 345 678 901',
      status: 'active',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Contact ID', type: 'integer' },
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'email', label: 'Email', type: 'string' },
      { key: 'phone', label: 'Phone', type: 'string' },
      { key: 'mobile', label: 'Mobile', type: 'string' },
      { key: 'company', label: 'Company', type: 'string' },
      { key: 'type', label: 'Contact Type', type: 'string' },
      { key: 'abn', label: 'ABN', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
