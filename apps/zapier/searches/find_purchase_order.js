const { makeRequest } = require('../lib/api');

/**
 * Find Purchase Order Search
 * Finds a purchase order by PO number
 */
module.exports = {
  key: 'find_purchase_order',
  noun: 'Purchase Order',

  display: {
    label: 'Find Purchase Order',
    description: 'Finds an existing purchase order by PO number.',
  },

  operation: {
    inputFields: [
      {
        key: 'po_number',
        label: 'PO Number',
        type: 'string',
        required: false,
        helpText: 'Search by PO number (e.g., PO-2024-0123)',
      },
      {
        key: 'job_id',
        label: 'Job',
        type: 'integer',
        required: false,
        dynamic: 'jobResource.id.title',
        helpText: 'Filter by job',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'string',
        required: false,
        choices: [
          { value: 'draft', label: 'Draft', sample: 'draft' },
          { value: 'pending', label: 'Pending', sample: 'pending' },
          { value: 'approved', label: 'Approved', sample: 'approved' },
          { value: 'sent', label: 'Sent', sample: 'sent' },
          { value: 'received', label: 'Received', sample: 'received' },
        ],
        helpText: 'Filter by PO status',
      },
    ],

    perform: async (z, bundle) => {
      const params = {};
      if (bundle.inputData.po_number) params.po_number = bundle.inputData.po_number;
      if (bundle.inputData.job_id) params.job_id = bundle.inputData.job_id;
      if (bundle.inputData.status) params.status = bundle.inputData.status;

      const data = await makeRequest(z, bundle, {
        path: '/api/v1/zapier/purchase_orders',
        method: 'GET',
        params,
      });

      return Array.isArray(data) ? data : data.purchase_orders || [];
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
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
