# frozen_string_literal: true

# Drop deprecated organization_id columns from tables that now use tenant_id directly.
#
# SSoT (Feb 2026): Organization → Tenant consolidation Phase 2
#
# Tables that DROP organization_id (now use tenant_id as primary):
#   - cloudflare_credentials
#   - desktop_clients
#   - email_drafts
#   - email_subscriptions
#   - performance_requests
#   - polaris_credentials
#   - stripe_configurations
#   - sync_exclusion_rules
#   - storage_blobs (optional org association, not needed)
#
# Tables that KEEP organization_id (Organization has_* relationships):
#   - microsoft_credentials (Organization has_many for credential isolation)
#   - s3_compatible_credentials (Organization has_many for credential isolation)
#   - warehouse_providers (Organization has_one)
#   - backup_configurations (Organization has_one)
#   - organization_microsoft_app_credentials (Organization has_many)
#
class DropDeprecatedOrganizationIdColumns < ActiveRecord::Migration[8.0]
  def change
    # Tables where organization_id is deprecated and tenant_id is now SSoT
    tables_to_update = %i[
      cloudflare_credentials
      desktop_clients
      email_drafts
      email_subscriptions
      performance_requests
      polaris_credentials
      stripe_configurations
      sync_exclusion_rules
      storage_blobs
    ]

    tables_to_update.each do |table|
      if column_exists?(table, :organization_id)
        # Remove foreign key if exists
        if foreign_key_exists?(table, :organizations)
          remove_foreign_key table, :organizations
        end
        # Remove index if exists
        if index_exists?(table, :organization_id)
          remove_index table, :organization_id
        end
        # Remove the column
        remove_column table, :organization_id, :bigint
      end
    end
  end
end
