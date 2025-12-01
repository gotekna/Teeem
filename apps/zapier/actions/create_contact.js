const { makeRequest } = require('../lib/api');

/**
 * Create Contact Action
 * Creates a new contact (customer or supplier) in Teeem
 */
module.exports = {
  key: 'create_contact',
  noun: 'Contact',

  display: {
    label: 'Create Contact',
    description: 'Creates a new contact (customer or supplier) in Teeem.',
    important: true,
  },

  operation: {
    inputFields: [
      {
        key: 'name',
        label: 'Name',
        type: 'string',
        required: true,
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
        required: true,
        choices: [
          { value: 'customer', label: 'Customer', sample: 'customer' },
          { value: 'supplier', label: 'Supplier', sample: 'supplier' },
          { value: 'both', label: 'Both (Customer & Supplier)', sample: 'both' },
        ],
        default: 'customer',
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
      const contact = await makeRequest(z, bundle, {
        path: '/api/v1/zapier/contacts',
        method: 'POST',
        body: {
          contact: {
            name: bundle.inputData.name,
            email: bundle.inputData.email,
            phone: bundle.inputData.phone,
            mobile: bundle.inputData.mobile,
            company: bundle.inputData.company,
            type: bundle.inputData.type,
            abn: bundle.inputData.abn,
            address: bundle.inputData.address,
            notes: bundle.inputData.notes,
          },
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
