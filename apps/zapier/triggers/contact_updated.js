const { subscribeHook, unsubscribeHook, pollForResources } = require('../lib/api');

/**
 * Contact Updated Trigger
 * Fires when an existing contact is updated in Teeem
 */
module.exports = {
  key: 'contact_updated',
  noun: 'Contact',

  display: {
    label: 'Contact Updated',
    description: 'Triggers when a contact is updated in Teeem.',
  },

  operation: {
    type: 'hook',

    performSubscribe: async (z, bundle) => {
      return subscribeHook(z, bundle, 'contact.updated');
    },

    performUnsubscribe: async (z, bundle) => {
      return unsubscribeHook(z, bundle);
    },

    perform: async (z, bundle) => {
      const contact = bundle.cleanedRequest.data || bundle.cleanedRequest;
      return [contact];
    },

    performList: async (z, bundle) => {
      return pollForResources(z, bundle, 'contacts');
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
      changed_fields: ['email', 'phone'],
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-16T14:45:00Z',
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
      { key: 'changed_fields', label: 'Changed Fields', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
