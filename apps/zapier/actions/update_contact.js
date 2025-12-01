const { makeRequest } = require('../lib/api');

/**
 * Update Contact Action
 * Updates an existing contact in Teeem
 */
module.exports = {
  key: 'update_contact',
  noun: 'Contact',

  display: {
    label: 'Update Contact',
    description: 'Updates an existing contact in Teeem.',
  },

  operation: {
    inputFields: [
      {
        key: 'id',
        label: 'Contact',
        type: 'integer',
        required: true,
        dynamic: 'contactResource.id.name',
        helpText: 'Select the contact to update',
      },
      {
        key: 'name',
        label: 'Name',
        type: 'string',
        required: false,
        helpText: 'Full name of the contact or company name',
      },
      {
        key: 'email',
        label: 'Email',
        type: 'string',
        required: false,
        helpText: 'Primary email address',
      },
      {
        key: 'phone',
        label: 'Phone',
        type: 'string',
        required: false,
        helpText: 'Primary phone number',
      },
      {
        key: 'mobile',
        label: 'Mobile',
        type: 'string',
        required: false,
        helpText: 'Mobile phone number',
      },
      {
        key: 'company',
        label: 'Company',
        type: 'string',
        required: false,
        helpText: 'Company or organization name',
      },
      {
        key: 'type',
        label: 'Contact Type',
        type: 'string',
        required: false,
        choices: [
          { value: 'customer', label: 'Customer', sample: 'customer' },
          { value: 'supplier', label: 'Supplier', sample: 'supplier' },
          { value: 'both', label: 'Both (Customer & Supplier)', sample: 'both' },
        ],
        helpText: 'Is this contact a customer, supplier, or both?',
      },
      {
        key: 'abn',
        label: 'ABN',
        type: 'string',
        required: false,
        helpText: 'Australian Business Number',
      },
      {
        key: 'address',
        label: 'Address',
        type: 'string',
        required: false,
        helpText: 'Street address',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        required: false,
        helpText: 'Additional notes about this contact',
      },
    ],

    perform: async (z, bundle) => {
      // Build update payload with only provided fields
      const updateData = {};
      const fields = ['name', 'email', 'phone', 'mobile', 'company', 'type', 'abn', 'address', 'notes'];

      fields.forEach(field => {
        if (bundle.inputData[field] !== undefined && bundle.inputData[field] !== '') {
          updateData[field] = bundle.inputData[field];
        }
      });

      const contact = await makeRequest(z, bundle, {
        path: `/api/v1/zapier/contacts/${bundle.inputData.id}`,
        method: 'PATCH',
        body: {
          contact: updateData,
        },
      });

      return contact;
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
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
