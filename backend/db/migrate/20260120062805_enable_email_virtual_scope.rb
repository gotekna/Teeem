# frozen_string_literal: true

# Enable virtual_scopes for email in StorageConfiguration
#
# Phase 4: Virtual File Warehouse
# This enables the File Warehouse to render email folders from database
# (WarehouseDocument.folder) instead of listing S3 paths directly.
#
# Benefits:
# - Instant folder reorganization (just update DB, no S3 copy)
# - Virtual folder structure: {{Mailbox}}/Email Body/{{Year}}/{{Month}}
# - Emails appear in /documents page under organized hierarchy
#
class EnableEmailVirtualScope < ActiveRecord::Migration[7.1]
  def up
    StorageConfiguration.find_each do |config|
      current_scopes = config.virtual_scopes || {}

      # Enable virtual scopes for email and email_attachments
      new_scopes = current_scopes.merge(
        "email" => true,
        "email_attachments" => true
      )

      config.update!(virtual_scopes: new_scopes)

      Rails.logger.info "[Migration] Enabled email virtual_scopes for organization #{config.organization_id}"
    end
  end

  def down
    StorageConfiguration.find_each do |config|
      current_scopes = config.virtual_scopes || {}

      # Remove email scopes
      current_scopes.delete("email")
      current_scopes.delete("email_attachments")

      config.update!(virtual_scopes: current_scopes)
    end
  end
end
