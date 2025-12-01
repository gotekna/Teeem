const { subscribeHook, unsubscribeHook, pollForResources } = require('../lib/api');

/**
 * Estimate Approved Trigger
 * Fires when an estimate is approved in Teeem
 */
module.exports = {
  key: 'estimate_approved',
  noun: 'Estimate',

  display: {
    label: 'Estimate Approved',
    description: 'Triggers when an estimate/quote is approved in Teeem.',
  },

  operation: {
    type: 'hook',

    performSubscribe: async (z, bundle) => {
      return subscribeHook(z, bundle, 'estimate.approved');
    },

    performUnsubscribe: async (z, bundle) => {
      return unsubscribeHook(z, bundle);
    },

    perform: async (z, bundle) => {
      const estimate = bundle.cleanedRequest.data || bundle.cleanedRequest;
      return [estimate];
    },

    performList: async (z, bundle) => {
      return pollForResources(z, bundle, 'estimates', { status: 'approved' });
    },

    sample: {
      id: 22222,
      estimate_number: 'EST-2024-0045',
      name: 'Concrete Works Estimate',
      status: 'approved',
      job_id: 67890,
      job_title: 'Residential Build - 123 Main Street',
      job_number: 'JOB-2024-001',
      supplier_id: 54321,
      supplier_name: 'Concrete Works Inc',
      subtotal: 45000.00,
      tax: 4500.00,
      total: 49500.00,
      approved_at: '2024-01-16T11:00:00Z',
      approved_by: 'admin@teeem.com.au',
      approved_by_name: 'Admin User',
      po_generated: false,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-16T11:00:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Estimate ID', type: 'integer' },
      { key: 'estimate_number', label: 'Estimate Number', type: 'string' },
      { key: 'name', label: 'Estimate Name', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'job_id', label: 'Job ID', type: 'integer' },
      { key: 'job_title', label: 'Job Title', type: 'string' },
      { key: 'job_number', label: 'Job Number', type: 'string' },
      { key: 'supplier_id', label: 'Supplier ID', type: 'integer' },
      { key: 'supplier_name', label: 'Supplier Name', type: 'string' },
      { key: 'subtotal', label: 'Subtotal', type: 'number' },
      { key: 'tax', label: 'Tax', type: 'number' },
      { key: 'total', label: 'Total', type: 'number' },
      { key: 'approved_at', label: 'Approved At', type: 'datetime' },
      { key: 'approved_by', label: 'Approved By (Email)', type: 'string' },
      { key: 'approved_by_name', label: 'Approved By (Name)', type: 'string' },
      { key: 'po_generated', label: 'PO Generated', type: 'boolean' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
