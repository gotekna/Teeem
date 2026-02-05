# frozen_string_literal: true

class AddMonitoredMailboxDocsort < ActiveRecord::Migration[8.0]
  def change
    add_column :tenant_settings, :monitored_mailbox_docsort, :string,
               comment: "SSoT: Email address for DocSort inbox (AI document classification)"
  end
end
