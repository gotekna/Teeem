const { makeRequest } = require('../lib/api');

/**
 * Update Job Status Action
 * Updates the status or stage of an existing job in Teeem
 */
module.exports = {
  key: 'update_job_status',
  noun: 'Job',

  display: {
    label: 'Update Job Status',
    description: 'Updates the status or construction stage of a job in Teeem.',
  },

  operation: {
    inputFields: [
      {
        key: 'id',
        label: 'Job',
        type: 'integer',
        required: true,
        dynamic: 'jobResource.id.title',
        helpText: 'Select the job to update',
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
          { value: 'cancelled', label: 'Cancelled', sample: 'cancelled' },
        ],
        helpText: 'New status for the job',
      },
      {
        key: 'stage',
        label: 'Construction Stage',
        type: 'string',
        required: false,
        choices: [
          { value: 'planning', label: 'Planning', sample: 'planning' },
          { value: 'design', label: 'Design', sample: 'design' },
          { value: 'permits', label: 'Permits', sample: 'permits' },
          { value: 'framing', label: 'Framing', sample: 'framing' },
          { value: 'construction', label: 'Construction', sample: 'construction' },
          { value: 'fitout', label: 'Fit-out', sample: 'fitout' },
          { value: 'handover', label: 'Handover', sample: 'handover' },
        ],
        helpText: 'New construction stage',
      },
      {
        key: 'notes',
        label: 'Status Update Notes',
        type: 'text',
        required: false,
        helpText: 'Optional notes about this status change',
      },
    ],

    perform: async (z, bundle) => {
      const updateData = {};

      if (bundle.inputData.status) {
        updateData.status = bundle.inputData.status;
      }
      if (bundle.inputData.stage) {
        updateData.stage = bundle.inputData.stage;
      }
      if (bundle.inputData.notes) {
        updateData.status_notes = bundle.inputData.notes;
      }

      if (Object.keys(updateData).length === 0) {
        throw new z.errors.Error(
          'Please provide at least a status or stage to update.',
          'InputError',
          400
        );
      }

      const job = await makeRequest(z, bundle, {
        path: `/api/v1/zapier/jobs/${bundle.inputData.id}`,
        method: 'PATCH',
        body: {
          job: updateData,
        },
      });

      return job;
    },

    sample: {
      id: 67890,
      title: 'Residential Build - 123 Main Street',
      job_number: 'JOB-2024-001',
      status: 'in_progress',
      previous_status: 'active',
      stage: 'Construction',
      previous_stage: 'Planning',
      client_name: 'Acme Corporation',
      address: '123 Main Street, Sydney NSW 2000',
      contract_value: 450000.00,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-16T09:00:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Job ID', type: 'integer' },
      { key: 'title', label: 'Job Title', type: 'string' },
      { key: 'job_number', label: 'Job Number', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'previous_status', label: 'Previous Status', type: 'string' },
      { key: 'stage', label: 'Construction Stage', type: 'string' },
      { key: 'previous_stage', label: 'Previous Stage', type: 'string' },
      { key: 'client_name', label: 'Client Name', type: 'string' },
      { key: 'address', label: 'Site Address', type: 'string' },
      { key: 'contract_value', label: 'Contract Value', type: 'number' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
