# frozen_string_literal: true

# SSoT Cleanup: Drop legacy Microsoft credential tables
#
# These tables have been superseded by the unified MicrosoftCredential model.
# Data was migrated via MigrateMicrosoftCredentialsJob.
#
# DELETED:
# - organization_microsoft_app_credentials (292 lines of model code)
# - organization_one_drive_credentials (154 lines of model code)  
# - user_microsoft_tokens (221 lines of model code)
#
# THE ONE: MicrosoftCredential (unified model for all Microsoft auth)
#
class DropLegacyMicrosoftCredentialTables < ActiveRecord::Migration[8.0]
  def up
    # Remove foreign keys first
    if foreign_key_exists?(:attachments, :organization_microsoft_app_credentials)
      remove_foreign_key :attachments, :organization_microsoft_app_credentials
    end

    # Drop the legacy tables
    drop_table :organization_microsoft_app_credentials, if_exists: true
    drop_table :organization_one_drive_credentials, if_exists: true
    drop_table :user_microsoft_tokens, if_exists: true

    Rails.logger.info "[SSoT] Dropped 3 legacy Microsoft credential tables - ~667 lines of model code deleted"
  end

  def down
    # These tables are gone - recreating them would require the full schema
    # which is not worth maintaining. Data lives in MicrosoftCredential now.
    raise ActiveRecord::IrreversibleMigration, "Legacy Microsoft tables cannot be restored. Use MicrosoftCredential instead."
  end
end
