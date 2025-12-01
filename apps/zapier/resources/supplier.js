const { makeRequest } = require('../lib/api');

/**
 * Supplier Resource
 * Used for dynamic dropdowns in Zapier UI
 * Returns contacts that are suppliers (type = 'supplier' or 'both')
 */
module.exports = {
  key: 'supplierResource',
  noun: 'Supplier',

  list: {
    display: {
      label: 'Supplier List',
      description: 'Lists suppliers for dropdown selection.',
      hidden: true,
    },

    operation: {
      perform: async (z, bundle) => {
        const data = await makeRequest(z, bundle, {
          path: '/api/v1/zapier/contacts',
          method: 'GET',
          params: {
            type: 'supplier',  // This should return suppliers and 'both' types
            limit: 100,
          },
        });

        const contacts = Array.isArray(data) ? data : data.contacts || [];

        // Filter to only suppliers and return in dropdown format
        return contacts
          .filter(contact => contact.type === 'supplier' || contact.type === 'both')
          .map(contact => ({
            id: contact.id,
            name: contact.company ? `${contact.name} (${contact.company})` : contact.name,
            email: contact.email,
          }));
      },

      sample: {
        id: 54321,
        name: 'Steel Supply Co (John Supplier)',
        email: 'john@steelsupply.com.au',
      },

      outputFields: [
        { key: 'id', label: 'Supplier ID', type: 'integer' },
        { key: 'name', label: 'Name', type: 'string' },
        { key: 'email', label: 'Email', type: 'string' },
      ],
    },
  },
};
