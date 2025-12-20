class AddOrganizationIdToMicrosoftCredentials < ActiveRecord::Migration[8.0]
  def change
    # Add organization_id to new SSoT credentials table (nullable for backfill)
    add_reference :microsoft_credentials, :organization, foreign_key: true, null: true

    # Add organization_id to legacy credentials table (nullable for backfill)
    add_reference :organization_microsoft_app_credentials, :organization, foreign_key: true, null: true

    # Unique constraint: one active credential per org per type
    # Uses partial index to only enforce on active credentials with org_id set
    add_index :microsoft_credentials,
              [:organization_id, :credential_type, :is_active],
              unique: true,
              where: "is_active = true AND organization_id IS NOT NULL",
              name: "idx_ms_creds_org_type_active_unique"

    # Unique constraint for legacy table
    add_index :organization_microsoft_app_credentials,
              [:organization_id, :is_active],
              unique: true,
              where: "is_active = true AND organization_id IS NOT NULL",
              name: "idx_legacy_ms_creds_org_active_unique"
  end
end
