const { makeRequest } = require('../lib/api');

/**
 * Find Document Search
 * Finds a document by name or job
 */
module.exports = {
  key: 'find_document',
  noun: 'Document',

  display: {
    label: 'Find Document',
    description: 'Finds an existing document by name or job.',
  },

  operation: {
    inputFields: [
      {
        key: 'name',
        label: 'Document Name',
        type: 'string',
        required: false,
        helpText: 'Search by document name (partial match)',
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
        key: 'document_type',
        label: 'Document Type',
        type: 'string',
        required: false,
        choices: [
          { value: 'permit', label: 'Permit', sample: 'permit' },
          { value: 'contract', label: 'Contract', sample: 'contract' },
          { value: 'invoice', label: 'Invoice', sample: 'invoice' },
          { value: 'quote', label: 'Quote', sample: 'quote' },
          { value: 'plan', label: 'Plan/Drawing', sample: 'plan' },
          { value: 'photo', label: 'Photo', sample: 'photo' },
          { value: 'other', label: 'Other', sample: 'other' },
        ],
        helpText: 'Filter by document type',
      },
      {
        key: 'verified',
        label: 'Verified Only',
        type: 'boolean',
        required: false,
        helpText: 'Only return verified documents',
      },
    ],

    perform: async (z, bundle) => {
      const params = {};
      if (bundle.inputData.name) params.name = bundle.inputData.name;
      if (bundle.inputData.job_id) params.job_id = bundle.inputData.job_id;
      if (bundle.inputData.document_type) params.document_type = bundle.inputData.document_type;
      if (bundle.inputData.verified) params.verified = bundle.inputData.verified;

      const data = await makeRequest(z, bundle, {
        path: '/api/v1/zapier/documents',
        method: 'GET',
        params,
      });

      return Array.isArray(data) ? data : data.documents || [];
    },

    sample: {
      id: 33333,
      name: 'Building_Permit_123MainSt.pdf',
      display_title: 'Building Permit - 123 Main Street',
      type: 'application/pdf',
      size: 2456789,
      url: 'https://storage.teeem.com.au/documents/abc123.pdf',
      job_id: 67890,
      job_title: 'Residential Build - 123 Main Street',
      job_number: 'JOB-2024-001',
      folder_path: '/Permits',
      document_type: 'permit',
      verified: true,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Document ID', type: 'integer' },
      { key: 'name', label: 'File Name', type: 'string' },
      { key: 'display_title', label: 'Display Title', type: 'string' },
      { key: 'type', label: 'MIME Type', type: 'string' },
      { key: 'size', label: 'File Size (bytes)', type: 'integer' },
      { key: 'url', label: 'Download URL', type: 'string' },
      { key: 'job_id', label: 'Job ID', type: 'integer' },
      { key: 'job_title', label: 'Job Title', type: 'string' },
      { key: 'job_number', label: 'Job Number', type: 'string' },
      { key: 'folder_path', label: 'Folder Path', type: 'string' },
      { key: 'document_type', label: 'Document Type', type: 'string' },
      { key: 'verified', label: 'Verified', type: 'boolean' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
