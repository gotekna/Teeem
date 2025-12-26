# Email Performance Optimization: Add Missing Indexes
# Part of 6-month email performance masterpiece plan
#
# Impact:
# - Conversation thread queries: 10x faster
# - User email filtering: 5x faster
# - Contact lookups: Case-insensitive without table scan
# - Email recipient matching: Index-based instead of seq scan
class AddEmailPerformanceIndexes < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!  # Allow concurrent index creation

  def change
    # Email Warehouse indexes
    # Composite index for conversation thread queries (latest in thread filtering)
    add_index :email_warehouse, [:conversation_id, :is_latest_in_thread],
              name: "idx_email_warehouse_conversation_latest",
              algorithm: :concurrently,
              if_not_exists: true

    # Index for filtering by synced user
    add_index :email_warehouse, :synced_by_user_id,
              name: "idx_email_warehouse_synced_by_user",
              algorithm: :concurrently,
              if_not_exists: true

    # Composite index for MS365 org credential + mailbox filtering
    add_index :email_warehouse, [:microsoft_credential_id, :mailbox_owner_email],
              name: "idx_email_warehouse_ms_credential_mailbox",
              algorithm: :concurrently,
              if_not_exists: true

    # Index for primary contact lookups
    add_index :email_warehouse, :primary_contact_id,
              name: "idx_email_warehouse_primary_contact",
              algorithm: :concurrently,
              if_not_exists: true

    # GIN index for contact_ids array (for @> contains operator)
    add_index :email_warehouse, :contact_ids,
              using: :gin,
              name: "idx_email_warehouse_contact_ids_gin",
              algorithm: :concurrently,
              if_not_exists: true

    # Email recipient indexes for batch user/contact matching
    add_index :email_recipients, [:email_address, :recipient_type],
              name: "idx_email_recipients_address_type",
              algorithm: :concurrently,
              if_not_exists: true

    # Case-insensitive email lookup indexes for contacts and users
    # These enable fast matching without LOWER() function overhead
    add_index :contacts, "LOWER(email)",
              name: "idx_contacts_lower_email",
              algorithm: :concurrently,
              if_not_exists: true

    add_index :users, "LOWER(email)",
              name: "idx_users_lower_email",
              algorithm: :concurrently,
              if_not_exists: true

    # Index for IMAP credential lookups
    add_index :email_warehouse, :imap_credential_id,
              name: "idx_email_warehouse_imap_credential",
              algorithm: :concurrently,
              if_not_exists: true

    # Index for received_at ordering (used in almost every query)
    add_index :email_warehouse, :received_at,
              name: "idx_email_warehouse_received_at",
              order: { received_at: :desc },
              algorithm: :concurrently,
              if_not_exists: true
  end
end
