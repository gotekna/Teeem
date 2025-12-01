const { subscribeHook, unsubscribeHook, pollForResources } = require('../lib/api');

/**
 * Job Status Changed Trigger
 * Fires when a job's status or stage changes in Teeem
 */
module.exports = {
  key: 'job_status_changed',
  noun: 'Job',

  display: {
    label: 'Job Status Changed',
    description: 'Triggers when a job status or construction stage changes in Teeem.',
    important: true,
  },

  operation: {
    type: 'hook',

    performSubscribe: async (z, bundle) => {
      return subscribeHook(z, bundle, 'job.status_changed');
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
      previous_status: 'draft',
      stage: 'Construction',
      previous_stage: 'Planning',
      client_name: 'Acme Corporation',
      address: '123 Main Street, Sydney NSW 2000',
      contract_value: 450000.00,
      changed_at: '2024-01-16T09:00:00Z',
      changed_by: 'admin@teeem.com.au',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-16T09:00:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Job ID', type: 'integer' },
      { key: 'title', label: 'Job Title', type: 'string' },
      { key: 'job_number', label: 'Job Number', type: 'string' },
      { key: 'status', label: 'New Status', type: 'string' },
      { key: 'previous_status', label: 'Previous Status', type: 'string' },
      { key: 'stage', label: 'New Stage', type: 'string' },
      { key: 'previous_stage', label: 'Previous Stage', type: 'string' },
      { key: 'client_name', label: 'Client Name', type: 'string' },
      { key: 'address', label: 'Site Address', type: 'string' },
      { key: 'contract_value', label: 'Contract Value', type: 'number' },
      { key: 'changed_at', label: 'Changed At', type: 'datetime' },
      { key: 'changed_by', label: 'Changed By', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
