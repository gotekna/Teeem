const { subscribeHook, unsubscribeHook, pollForResources } = require('../lib/api');

/**
 * PO Approved Trigger
 * Fires when a purchase order is approved in Teeem
 */
module.exports = {
  key: 'po_approved',
  noun: 'Purchase Order',

  display: {
    label: 'Purchase Order Approved',
    description: 'Triggers when a purchase order is approved in Teeem.',
    important: true,
  },

  operation: {
    type: 'hook',

    performSubscribe: async (z, bundle) => {
      return subscribeHook(z, bundle, 'purchase_order.approved');
    },

    performUnsubscribe: async (z, bundle) => {
      return unsubscribeHook(z, bundle);
    },

    perform: async (z, bundle) => {
      const po = bundle.cleanedRequest.data || bundle.cleanedRequest;
      return [po];
    },

    performList: async (z, bundle) => {
      // Filter for approved POs only
      return pollForResources(z, bundle, 'purchase_orders', { status: 'approved' });
    },

    sample: {
      id: 11111,
      po_number: 'PO-2024-0123',
      status: 'approved',
      supplier_id: 54321,
      supplier_name: 'Steel Supply Co',
      job_id: 67890,
      job_title: 'Residential Build - 123 Main Street',
      job_number: 'JOB-2024-001',
      subtotal: 5000.00,
      tax: 500.00,
      total: 5500.00,
      approved_at: '2024-01-16T14:00:00Z',
      approved_by: 'admin@teeem.com.au',
      approved_by_name: 'Admin User',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-16T14:00:00Z',
    },

    outputFields: [
      { key: 'id', label: 'PO ID', type: 'integer' },
      { key: 'po_number', label: 'PO Number', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'supplier_id', label: 'Supplier ID', type: 'integer' },
      { key: 'supplier_name', label: 'Supplier Name', type: 'string' },
      { key: 'job_id', label: 'Job ID', type: 'integer' },
      { key: 'job_title', label: 'Job Title', type: 'string' },
      { key: 'job_number', label: 'Job Number', type: 'string' },
      { key: 'subtotal', label: 'Subtotal', type: 'number' },
      { key: 'tax', label: 'Tax', type: 'number' },
      { key: 'total', label: 'Total', type: 'number' },
      { key: 'approved_at', label: 'Approved At', type: 'datetime' },
      { key: 'approved_by', label: 'Approved By (Email)', type: 'string' },
      { key: 'approved_by_name', label: 'Approved By (Name)', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
