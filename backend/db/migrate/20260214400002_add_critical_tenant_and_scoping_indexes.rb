class AddCriticalTenantAndScopingIndexes < ActiveRecord::Migration[8.0]
  def change
    # ════════════════════════════════════════════════════════════════
    # TIER 1 - Critical tenant scoping indexes (every request)
    # ════════════════════════════════════════════════════════════════
    # These columns are used in multi-tenancy scoping and should be
    # indexed for performance on every tenant-filtered query.

    add_index :accounting_integrations, :organization_id, if_not_exists: true
    add_index :accounting_integrations, :tenant_id, if_not_exists: true
    add_index :gl_provider_credentials, :tenant_id, if_not_exists: true
    add_index :xero_sync_statuses, :tenant_id, if_not_exists: true

    # ════════════════════════════════════════════════════════════════
    # TIER 2 - High-traffic join columns
    # ════════════════════════════════════════════════════════════════
    # These FKs are frequently used in joins and lookups across the
    # application and should be indexed for query performance.

    add_index :contact_emails, :contact_id, if_not_exists: true
    add_index :email_recipients, :contact_id, if_not_exists: true
    add_index :email_recipients, :user_id, if_not_exists: true
    add_index :email_sync_statuses, :user_id, if_not_exists: true
  end
end
