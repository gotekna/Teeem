# SSoT: Email configuration - previously hardcoded in services/jobs
# These settings define monitored mailboxes and internal email domains
class AddEmailConfigToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    # Internal email domains for detecting internal vs external emails
    # Default includes common Tekna/TEEEM domains
    add_column :corporate_settings, :internal_email_domains, :string,
               default: "tekna.com.au,teeem.au,teeem.com",
               comment: "Comma-separated list of internal email domains"

    # Monitored mailboxes for automated email processing
    add_column :corporate_settings, :monitored_mailbox_pay, :string,
               default: "Pay@tekna.com.au",
               comment: "Mailbox for incoming invoices/bills"

    add_column :corporate_settings, :monitored_mailbox_newtask, :string,
               default: "newtask@tekna.com.au",
               comment: "Mailbox for creating new tasks from emails"

    add_column :corporate_settings, :monitored_mailbox_newjob, :string,
               default: "newjob@tekna.com.au",
               comment: "Mailbox for creating new jobs from emails"

    add_column :corporate_settings, :monitored_mailbox_newcase, :string,
               default: "newcase@tekna.com.au",
               comment: "Mailbox for creating new cases from emails"
  end
end
