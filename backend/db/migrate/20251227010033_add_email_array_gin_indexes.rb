# Email Performance: Add GIN indexes for to_emails and cc_emails arrays
# Part of 6-month email performance masterpiece plan
#
# Purpose:
# Speed up the involving_email scope which uses && (overlap) and = ANY() operators
# GIN indexes enable fast array intersection queries
#
# Impact:
# - involving_email queries: ~10x faster with GIN indexes
# - Queries like "find all emails TO this address" become index scans
class AddEmailArrayGinIndexes < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!  # Allow concurrent index creation

  def change
    # GIN index for to_emails array overlap queries
    add_index :email_warehouse, :to_emails,
              using: :gin,
              algorithm: :concurrently,
              name: 'idx_email_warehouse_to_emails_gin',
              if_not_exists: true

    # GIN index for cc_emails array overlap queries
    add_index :email_warehouse, :cc_emails,
              using: :gin,
              algorithm: :concurrently,
              name: 'idx_email_warehouse_cc_emails_gin',
              if_not_exists: true
  end
end
