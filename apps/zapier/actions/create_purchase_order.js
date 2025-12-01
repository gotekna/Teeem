const { makeRequest } = require('../lib/api');

/**
 * Create Purchase Order Action
 * Creates a new purchase order in Teeem
 */
module.exports = {
  key: 'create_purchase_order',
  noun: 'Purchase Order',

  display: {
    label: 'Create Purchase Order',
    description: 'Creates a new purchase order in Teeem.',
    important: true,
  },

  operation: {
    inputFields: [
      {
        key: 'job_id',
        label: 'Job',
        type: 'integer',
        required: true,
        dynamic: 'jobResource.id.title',
        helpText: 'Select the job for this purchase order',
      },
      {
        key: 'supplier_id',
        label: 'Supplier',
        type: 'integer',
        required: true,
        dynamic: 'supplierResource.id.name',
        helpText: 'Select the supplier',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        required: false,
        helpText: 'Description of what is being ordered',
      },
      {
        key: 'subtotal',
        label: 'Subtotal',
        type: 'number',
        required: true,
        helpText: 'Subtotal amount before tax (in dollars)',
      },
      {
        key: 'tax',
        label: 'Tax (GST)',
        type: 'number',
        required: false,
        helpText: 'Tax amount (defaults to 10% of subtotal if not provided)',
      },
      {
        key: 'delivery_date',
        label: 'Delivery Date',
        type: 'datetime',
        required: false,
        helpText: 'Expected delivery date',
      },
      {
        key: 'delivery_address',
        label: 'Delivery Address',
        type: 'string',
        required: false,
        helpText: 'Delivery address (defaults to job site address)',
      },
      {
        key: 'notes',
        label: 'Internal Notes',
        type: 'text',
        required: false,
        helpText: 'Internal notes (not sent to supplier)',
      },
      {
        key: 'line_items_json',
        label: 'Line Items (JSON)',
        type: 'text',
        required: false,
        helpText: 'Optional: JSON array of line items. Example: [{"description": "Steel beams", "quantity": 10, "unit_price": 100}]',
      },
    ],

    perform: async (z, bundle) => {
      // Calculate total
      const subtotal = parseFloat(bundle.inputData.subtotal) || 0;
      const tax = bundle.inputData.tax !== undefined
        ? parseFloat(bundle.inputData.tax)
        : subtotal * 0.1; // Default 10% GST
      const total = subtotal + tax;

      // Parse line items if provided
      let lineItems = [];
      if (bundle.inputData.line_items_json) {
        try {
          lineItems = JSON.parse(bundle.inputData.line_items_json);
        } catch (e) {
          throw new z.errors.Error(
            'Invalid JSON format for line items. Please provide a valid JSON array.',
            'InputError',
            400
          );
        }
      }

      const po = await makeRequest(z, bundle, {
        path: '/api/v1/zapier/purchase_orders',
        method: 'POST',
        body: {
          purchase_order: {
            job_id: bundle.inputData.job_id,
            supplier_id: bundle.inputData.supplier_id,
            description: bundle.inputData.description,
            subtotal: subtotal,
            tax: tax,
            total: total,
            delivery_date: bundle.inputData.delivery_date,
            delivery_address: bundle.inputData.delivery_address,
            notes: bundle.inputData.notes,
            line_items: lineItems.length > 0 ? lineItems : undefined,
          },
        },
      });

      return po;
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
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
