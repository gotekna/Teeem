const { subscribeHook, unsubscribeHook, pollForResources } = require('../lib/api');

/**
 * New Purchase Order Trigger
 * Fires when a new purchase order is created in Teeem
 */
module.exports = {
  key: 'new_purchase_order',
  noun: 'Purchase Order',

  display: {
    label: 'New Purchase Order',
    description: 'Triggers when a new purchase order is created in Teeem.',
    important: true,
  },

  operation: {
    type: 'hook',

    performSubscribe: async (z, bundle) => {
      return subscribeHook(z, bundle, 'purchase_order.created');
    },

    performUnsubscribe: async (z, bundle) => {
      return unsubscribeHook(z, bundle);
    },

    perform: async (z, bundle) => {
      const po = bundle.cleanedRequest.data || bundle.cleanedRequest;
      return [po];
    },

    performList: async (z, bundle) => {
      return pollForResources(z, bundle, 'purchase_orders');
    },

    sample: {
      id: 11111,
      po_number: 'PO-2024-0123',
      status: 'draft',
      supplier_id: 54321,
      supplier_name: 'Steel Supply Co',
      job_id: 67890,
      job_title: 'Residential Build - 123 Main Street',
      job_number: 'JOB-2024-001',
      subtotal: 5000.00,
      tax: 500.00,
      total: 5500.00,
      description: 'Steel beams for framing',
      delivery_date: '2024-02-15',
      line_items_count: 5,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
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
      { key: 'description', label: 'Description', type: 'string' },
      { key: 'delivery_date', label: 'Delivery Date', type: 'datetime' },
      { key: 'line_items_count', label: 'Line Items Count', type: 'integer' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
