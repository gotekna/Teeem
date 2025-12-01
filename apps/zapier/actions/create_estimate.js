const { makeRequest } = require('../lib/api');

/**
 * Create Estimate Action
 * Creates a new estimate/quote in Teeem
 */
module.exports = {
  key: 'create_estimate',
  noun: 'Estimate',

  display: {
    label: 'Create Estimate',
    description: 'Creates a new estimate/quote in Teeem.',
  },

  operation: {
    inputFields: [
      {
        key: 'name',
        label: 'Estimate Name',
        type: 'string',
        required: true,
        helpText: 'Name or title for this estimate',
      },
      {
        key: 'job_id',
        label: 'Job',
        type: 'integer',
        required: true,
        dynamic: 'jobResource.id.title',
        helpText: 'Select the job for this estimate',
      },
      {
        key: 'supplier_id',
        label: 'Supplier',
        type: 'integer',
        required: false,
        dynamic: 'supplierResource.id.name',
        helpText: 'Select the supplier (optional)',
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
        key: 'source',
        label: 'Source',
        type: 'string',
        required: false,
        choices: [
          { value: 'email', label: 'Email', sample: 'email' },
          { value: 'upload', label: 'File Upload', sample: 'upload' },
          { value: 'manual', label: 'Manual Entry', sample: 'manual' },
          { value: 'api', label: 'API/Integration', sample: 'api' },
        ],
        default: 'api',
        helpText: 'How this estimate was received',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        required: false,
        helpText: 'Additional notes about this estimate',
      },
      {
        key: 'line_items_json',
        label: 'Line Items (JSON)',
        type: 'text',
        required: false,
        helpText: 'Optional: JSON array of line items. Example: [{"description": "Concrete work", "quantity": 1, "unit_price": 5000}]',
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

      const estimate = await makeRequest(z, bundle, {
        path: '/api/v1/zapier/estimates',
        method: 'POST',
        body: {
          estimate: {
            name: bundle.inputData.name,
            job_id: bundle.inputData.job_id,
            supplier_id: bundle.inputData.supplier_id,
            subtotal: subtotal,
            tax: tax,
            total: total,
            source: bundle.inputData.source || 'api',
            notes: bundle.inputData.notes,
            line_items: lineItems.length > 0 ? lineItems : undefined,
          },
        },
      });

      return estimate;
    },

    sample: {
      id: 22222,
      estimate_number: 'EST-2024-0045',
      name: 'Concrete Works Estimate',
      status: 'pending',
      job_id: 67890,
      job_title: 'Residential Build - 123 Main Street',
      job_number: 'JOB-2024-001',
      supplier_id: 54321,
      supplier_name: 'Concrete Works Inc',
      subtotal: 45000.00,
      tax: 4500.00,
      total: 49500.00,
      source: 'api',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
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
      { key: 'source', label: 'Source', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
