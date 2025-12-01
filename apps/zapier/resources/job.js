const { makeRequest } = require('../lib/api');

/**
 * Job Resource
 * Used for dynamic dropdowns in Zapier UI
 */
module.exports = {
  key: 'jobResource',
  noun: 'Job',

  list: {
    display: {
      label: 'Job List',
      description: 'Lists jobs for dropdown selection.',
      hidden: true,
    },

    operation: {
      perform: async (z, bundle) => {
        const data = await makeRequest(z, bundle, {
          path: '/api/v1/zapier/jobs',
          method: 'GET',
          params: {
            limit: 100,
          },
        });

        const jobs = Array.isArray(data) ? data : data.jobs || [];

        // Return in format expected by Zapier dropdowns
        return jobs.map(job => ({
          id: job.id,
          title: `${job.job_number} - ${job.title}`,
          job_number: job.job_number,
          status: job.status,
          client_name: job.client_name,
        }));
      },

      sample: {
        id: 67890,
        title: 'JOB-2024-001 - Residential Build - 123 Main Street',
        job_number: 'JOB-2024-001',
        status: 'active',
        client_name: 'Acme Corporation',
      },

      outputFields: [
        { key: 'id', label: 'Job ID', type: 'integer' },
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'job_number', label: 'Job Number', type: 'string' },
        { key: 'status', label: 'Status', type: 'string' },
        { key: 'client_name', label: 'Client', type: 'string' },
      ],
    },
  },
};
