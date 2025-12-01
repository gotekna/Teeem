const { makeRequest } = require('../lib/api');

/**
 * Create Job Action
 * Creates a new job/project in Teeem
 */
module.exports = {
  key: 'create_job',
  noun: 'Job',

  display: {
    label: 'Create Job',
    description: 'Creates a new job/project in Teeem.',
    important: true,
  },

  operation: {
    inputFields: [
      {
        key: 'title',
        label: 'Job Title',
        type: 'string',
        required: true,
        helpText: 'Name/title of the job or project',
      },
      {
        key: 'job_number',
        label: 'Job Number',
        type: 'string',
        required: false,
        helpText: 'Custom job number (auto-generated if not provided)',
      },
      {
        key: 'client_id',
        label: 'Client',
        type: 'integer',
        required: false,
        dynamic: 'contactResource.id.name',
        helpText: 'Select the client for this job',
      },
      {
        key: 'client_name',
        label: 'Client Name',
        type: 'string',
        required: false,
        helpText: 'Client name (used if client not selected from dropdown)',
      },
      {
        key: 'address',
        label: 'Site Address',
        type: 'string',
        required: false,
        helpText: 'Full address of the job site',
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
        default: 'draft',
        helpText: 'Initial status of the job',
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
        default: 'planning',
        helpText: 'Current construction stage',
      },
      {
        key: 'contract_value',
        label: 'Contract Value',
        type: 'number',
        required: false,
        helpText: 'Total contract value in dollars',
      },
      {
        key: 'start_date',
        label: 'Start Date',
        type: 'datetime',
        required: false,
        helpText: 'Planned start date',
      },
      {
        key: 'end_date',
        label: 'End Date',
        type: 'datetime',
        required: false,
        helpText: 'Planned end/completion date',
      },
      {
        key: 'site_supervisor_name',
        label: 'Site Supervisor',
        type: 'string',
        required: false,
        helpText: 'Name of the site supervisor',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        required: false,
        helpText: 'Additional description or notes about the job',
      },
    ],

    perform: async (z, bundle) => {
      const job = await makeRequest(z, bundle, {
        path: '/api/v1/zapier/jobs',
        method: 'POST',
        body: {
          job: {
            title: bundle.inputData.title,
            job_number: bundle.inputData.job_number,
            client_id: bundle.inputData.client_id,
            client_name: bundle.inputData.client_name,
            address: bundle.inputData.address,
            status: bundle.inputData.status,
            stage: bundle.inputData.stage,
            contract_value: bundle.inputData.contract_value,
            start_date: bundle.inputData.start_date,
            end_date: bundle.inputData.end_date,
            site_supervisor_name: bundle.inputData.site_supervisor_name,
            description: bundle.inputData.description,
          },
        },
      });

      return job;
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
