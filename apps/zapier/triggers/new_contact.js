const { subscribeHook, unsubscribeHook, pollForResources, getSample } = require('../lib/api');

/**
 * New Contact Trigger
 * Fires when a new contact is created in Teeem
 */
module.exports = {
  key: 'new_contact',
  noun: 'Contact',

  display: {
    label: 'New Contact',
    description: 'Triggers when a new contact is created in Teeem.',
    important: true,
  },

  operation: {
    type: 'hook',

    // REST Hook subscription
    performSubscribe: async (z, bundle) => {
      return subscribeHook(z, bundle, 'contact.created');
    },

    performUnsubscribe: async (z, bundle) => {
      return unsubscribeHook(z, bundle);
    },

    // Process incoming webhook data
    perform: async (z, bundle) => {
      // Webhook payload comes in bundle.cleanedRequest
      const contact = bundle.cleanedRequest.data || bundle.cleanedRequest;
      return [contact];
    },

    // Polling fallback for testing and initial setup
    performList: async (z, bundle) => {
      return pollForResources(z, bundle, 'contacts');
    },

    // Sample data for Zapier UI
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

    // Output field definitions
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
