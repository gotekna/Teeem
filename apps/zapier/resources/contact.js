const { makeRequest } = require('../lib/api');

/**
 * Contact Resource
 * Used for dynamic dropdowns in Zapier UI
 */
module.exports = {
  key: 'contactResource',
  noun: 'Contact',

  list: {
    display: {
      label: 'Contact List',
      description: 'Lists contacts for dropdown selection.',
      hidden: true,
    },

    operation: {
      perform: async (z, bundle) => {
        const data = await makeRequest(z, bundle, {
          path: '/api/v1/zapier/contacts',
          method: 'GET',
          params: {
            limit: 100,
          },
        });

        const contacts = Array.isArray(data) ? data : data.contacts || [];

        // Return in format expected by Zapier dropdowns
        return contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          type: contact.type,
        }));
      },

      sample: {
        id: 12345,
        name: 'John Smith',
        email: 'john.smith@example.com',
        company: 'Acme Construction',
        type: 'customer',
      },

      outputFields: [
        { key: 'id', label: 'Contact ID', type: 'integer' },
        { key: 'name', label: 'Name', type: 'string' },
        { key: 'email', label: 'Email', type: 'string' },
        { key: 'company', label: 'Company', type: 'string' },
        { key: 'type', label: 'Type', type: 'string' },
      ],
    },
  },
};
