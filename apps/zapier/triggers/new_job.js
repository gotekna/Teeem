const { subscribeHook, unsubscribeHook, pollForResources } = require('../lib/api');

/**
 * New Job Trigger
 * Fires when a new job/project is created in Teeem
 */
module.exports = {
  key: 'new_job',
  noun: 'Job',

  display: {
    label: 'New Job',
    description: 'Triggers when a new job/project is created in Teeem.',
    important: true,
  },

  operation: {
    type: 'hook',

    performSubscribe: async (z, bundle) => {
      return subscribeHook(z, bundle, 'job.created');
    },

    performUnsubscribe: async (z, bundle) => {
      return unsubscribeHook(z, bundle);
    },

    perform: async (z, bundle) => {
      const job = bundle.cleanedRequest.data || bundle.cleanedRequest;
      return [job];
    },

    performList: async (z, bundle) => {
      return pollForResources(z, bundle, 'jobs');
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
      site_supervisor_name: 'Mike Johnson',
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
      { key: 'site_supervisor_name', label: 'Site Supervisor', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
