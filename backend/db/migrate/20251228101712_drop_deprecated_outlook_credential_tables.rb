# frozen_string_literal: true

# Drop deprecated credential tables that were replaced by MicrosoftCredential (SSoT)
#
# These models were deleted in Dec 2024 cleanup:
# - UserOutlookCredential → MicrosoftCredential (delegated, owner: User)
# - OrganizationOutlookCredential → MicrosoftCredential (delegated, owner: nil)
#
# Data should have been migrated via MigrateMicrosoftCredentialsJob before this runs.
#
class DropDeprecatedOutlookCredentialTables < ActiveRecord::Migration[8.0]
  def up
    drop_table :user_outlook_credentials, if_exists: true
    drop_table :organization_outlook_credentials, if_exists: true
  end

  def down
    # Tables were deprecated and data migrated to microsoft_credentials
    # Rollback would require re-running MigrateMicrosoftCredentialsJob in reverse
    raise ActiveRecord::IrreversibleMigration, "Cannot restore deprecated credential tables"
  end
end
