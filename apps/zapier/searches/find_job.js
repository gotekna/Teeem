const { makeRequest } = require('../lib/api');

/**
 * Find Job Search
 * Finds a job by job number or title
 */
module.exports = {
  key: 'find_job',
  noun: 'Job',

  display: {
    label: 'Find Job',
    description: 'Finds an existing job by job number or title.',
  },

  operation: {
    inputFields: [
      {
        key: 'job_number',
        label: 'Job Number',
        type: 'string',
        required: false,
        helpText: 'Search by job number (e.g., JOB-2024-001)',
      },
      {
        key: 'title',
        label: 'Title',
        type: 'string',
        required: false,
        helpText: 'Search by job title (partial match)',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'string',
        required: false,
        choices: [
          { value: 'draft', label: 'Draft', sample: 'draft' },
          { value: 'active', label: 'Active', sample: 'active' },
          { value: 'in_progress', label: 'In Progress', sample: 'in_progress' },
          { value: 'on_hold', label: 'On Hold', sample: 'on_hold' },
          { value: 'completed', label: 'Completed', sample: 'completed' },
        ],
        helpText: 'Filter by job status',
      },
    ],

    perform: async (z, bundle) => {
      if (!bundle.inputData.job_number && !bundle.inputData.title) {
        throw new z.errors.Error(
          'Please provide either a job number or title to search.',
          'InputError',
          400
        );
      }

      const params = {};
      if (bundle.inputData.job_number) params.job_number = bundle.inputData.job_number;
      if (bundle.inputData.title) params.title = bundle.inputData.title;
      if (bundle.inputData.status) params.status = bundle.inputData.status;

      const data = await makeRequest(z, bundle, {
        path: '/api/v1/zapier/jobs',
        method: 'GET',
        params,
      });

      return Array.isArray(data) ? data : data.jobs || [];
    },

    sample: {
      id: 67890,
      title: 'Residential Build - 123 Main Street',
      job_number: 'JOB-2024-001',
      status: 'active',
      stage: 'Construction',
      client_name: 'Acme Corporation',
      client_id: 12345,
      address: '123 Main Street, Sydney NSW 2000',
      contract_value: 450000.00,
      start_date: '2024-02-01',
      end_date: '2024-08-01',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Job ID', type: 'integer' },
      { key: 'title', label: 'Job Title', type: 'string' },
      { key: 'job_number', label: 'Job Number', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'stage', label: 'Construction Stage', type: 'string' },
      { key: 'client_name', label: 'Client Name', type: 'string' },
      { key: 'client_id', label: 'Client ID', type: 'integer' },
      { key: 'address', label: 'Site Address', type: 'string' },
      { key: 'contract_value', label: 'Contract Value', type: 'number' },
      { key: 'start_date', label: 'Start Date', type: 'datetime' },
      { key: 'end_date', label: 'End Date', type: 'datetime' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
