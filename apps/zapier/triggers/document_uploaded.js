const { subscribeHook, unsubscribeHook, pollForResources } = require('../lib/api');

/**
 * Document Uploaded Trigger
 * Fires when a new document is uploaded in Teeem
 */
module.exports = {
  key: 'document_uploaded',
  noun: 'Document',

  display: {
    label: 'Document Uploaded',
    description: 'Triggers when a new document is uploaded in Teeem.',
    important: true,
  },

  operation: {
    type: 'hook',

    performSubscribe: async (z, bundle) => {
      return subscribeHook(z, bundle, 'document.uploaded');
    },

    performUnsubscribe: async (z, bundle) => {
      return unsubscribeHook(z, bundle);
    },

    perform: async (z, bundle) => {
      const document = bundle.cleanedRequest.data || bundle.cleanedRequest;
      return [document];
    },

    performList: async (z, bundle) => {
      return pollForResources(z, bundle, 'documents');
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
      document_type_name: 'Building Permit',
      uploaded_by: 'admin@teeem.com.au',
      uploaded_by_name: 'Admin User',
      verified: false,
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
      { key: 'document_type_name', label: 'Document Type Name', type: 'string' },
      { key: 'uploaded_by', label: 'Uploaded By (Email)', type: 'string' },
      { key: 'uploaded_by_name', label: 'Uploaded By (Name)', type: 'string' },
      { key: 'verified', label: 'Verified', type: 'boolean' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
