# frozen_string_literal: true

# Performance Fix: Add missing indexes to email_warehouses table
#
# Problem: 269 slow queries (247ms avg) on email_warehouses causing "Slow Query Surge" anomalies
#
# Root cause analysis:
# 1. involving_email scope queries from_email without index (full table scan)
# 2. involving_email scope queries cc_emails without GIN index
# 3. spam scope queries JSONB email_classification->>'email_type' without index
# 4. unassigned scope queries job_id=nil without dedicated index
#
# Expected improvement: 60-80% reduction in slow queries
class AddMissingEmailWarehouseIndexes < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    # Index on from_email for involving_email scope
    # Used in: EmailWarehouse.involving_email(emails)
    # Query: from_email = ANY(ARRAY[?]::text[])
    add_index :email_warehouses, :from_email,
              name: "idx_email_warehouse_from_email",
              algorithm: :concurrently,
              if_not_exists: true

    # GIN index on cc_emails for array overlap queries
    # Used in: EmailWarehouse.involving_email(emails)
    # Query: cc_emails && ARRAY[?]::text[]
    add_index :email_warehouses, :cc_emails,
              name: "idx_email_warehouse_cc_emails_gin",
              using: :gin,
              algorithm: :concurrently,
              if_not_exists: true

    # Index on JSONB email_classification->>'email_type' for spam queries
    # Used in: EmailWarehouse.spam, EmailWarehouse.not_spam
    # Query: email_classification->>'email_type' = 'spam'
    add_index :email_warehouses,
              "(email_classification->>'email_type')",
              name: "idx_email_warehouse_email_type",
              algorithm: :concurrently,
              if_not_exists: true

    # Partial index on job_id for unassigned emails (where job_id IS NULL)
    # Used in: EmailWarehouse.unassigned
    # Query: WHERE job_id IS NULL
    # Partial index is more efficient than full index for this use case
    add_index :email_warehouses, :id,
              name: "idx_email_warehouse_unassigned",
              where: "job_id IS NULL",
              algorithm: :concurrently,
              if_not_exists: true

    # Index on is_latest_in_thread for thread filtering
    # Used in: EmailWarehouse.latest_in_thread
    # Query: WHERE is_latest_in_thread = true
    add_index :email_warehouses, :is_latest_in_thread,
              name: "idx_email_warehouse_latest_in_thread",
              where: "is_latest_in_thread = true",
              algorithm: :concurrently,
              if_not_exists: true
  end
end
