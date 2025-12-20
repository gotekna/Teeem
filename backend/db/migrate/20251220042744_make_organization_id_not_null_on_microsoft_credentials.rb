# Final migration for SSoT org isolation
# Makes organization_id NOT NULL after backfill is complete
#
# Prerequisites:
# 1. organizations table exists (20251220034958)
# 2. organization_id column exists (20251220035033)
# 3. All credentials have been backfilled with organization_id
#
# Run verification before migrating:
# OrganizationMicrosoftAppCredential.where(organization_id: nil).count # Should be 0
# MicrosoftCredential.where(organization_id: nil).count # Should be 0

class MakeOrganizationIdNotNullOnMicrosoftCredentials < ActiveRecord::Migration[8.0]
  def up
    # Verify all records have organization_id before making NOT NULL
    orphan_legacy = execute("SELECT COUNT(*) FROM organization_microsoft_app_credentials WHERE organization_id IS NULL").first["count"]
    orphan_new = execute("SELECT COUNT(*) FROM microsoft_credentials WHERE organization_id IS NULL").first["count"]

    if orphan_legacy.to_i > 0 || orphan_new.to_i > 0
      raise "Cannot make organization_id NOT NULL: #{orphan_legacy} legacy credentials and #{orphan_new} new credentials have NULL organization_id. Run backfill first."
    end

    # Make organization_id NOT NULL on both tables
    change_column_null :organization_microsoft_app_credentials, :organization_id, false
    change_column_null :microsoft_credentials, :organization_id, false
  end

  def down
    # Revert to nullable
    change_column_null :organization_microsoft_app_credentials, :organization_id, true
    change_column_null :microsoft_credentials, :organization_id, true
  end
end
