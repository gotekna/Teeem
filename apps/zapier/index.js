const authentication = require('./authentication');

// Triggers
const newContact = require('./triggers/new_contact');
const contactUpdated = require('./triggers/contact_updated');
const newJob = require('./triggers/new_job');
const jobStatusChanged = require('./triggers/job_status_changed');
const newPurchaseOrder = require('./triggers/new_purchase_order');
const poApproved = require('./triggers/po_approved');
const newEstimate = require('./triggers/new_estimate');
const estimateApproved = require('./triggers/estimate_approved');
const documentUploaded = require('./triggers/document_uploaded');
const documentVerified = require('./triggers/document_verified');

// Actions
const createContact = require('./actions/create_contact');
const updateContact = require('./actions/update_contact');
const createJob = require('./actions/create_job');
const updateJobStatus = require('./actions/update_job_status');
const createPurchaseOrder = require('./actions/create_purchase_order');
const createEstimate = require('./actions/create_estimate');

// Searches
const findContact = require('./searches/find_contact');
const findJob = require('./searches/find_job');
const findPurchaseOrder = require('./searches/find_purchase_order');
const findDocument = require('./searches/find_document');

// Resources (for dynamic dropdowns)
const contactResource = require('./resources/contact');
const jobResource = require('./resources/job');
const supplierResource = require('./resources/supplier');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication,

  // Triggers - events that start Zaps
  triggers: {
    [newContact.key]: newContact,
    [contactUpdated.key]: contactUpdated,
    [newJob.key]: newJob,
    [jobStatusChanged.key]: jobStatusChanged,
    [newPurchaseOrder.key]: newPurchaseOrder,
    [poApproved.key]: poApproved,
    [newEstimate.key]: newEstimate,
    [estimateApproved.key]: estimateApproved,
    [documentUploaded.key]: documentUploaded,
    [documentVerified.key]: documentVerified,
  },

  // Creates - actions that create/update data
  creates: {
    [createContact.key]: createContact,
    [updateContact.key]: updateContact,
    [createJob.key]: createJob,
    [updateJobStatus.key]: updateJobStatus,
    [createPurchaseOrder.key]: createPurchaseOrder,
    [createEstimate.key]: createEstimate,
  },

  // Searches - find existing records
  searches: {
    [findContact.key]: findContact,
    [findJob.key]: findJob,
    [findPurchaseOrder.key]: findPurchaseOrder,
    [findDocument.key]: findDocument,
  },

  // Resources - for dynamic dropdowns in Zapier UI
  resources: {
    [contactResource.key]: contactResource,
    [jobResource.key]: jobResource,
    [supplierResource.key]: supplierResource,
  },
};
