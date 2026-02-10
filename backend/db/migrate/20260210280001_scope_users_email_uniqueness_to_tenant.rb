# frozen_string_literal: true

# Fix: Users email uniqueness should be scoped to tenant_id for multi-tenancy.
# The global unique index on email prevents the same person from having accounts
# on multiple tenants (e.g., robert@tekna.com.au on both Tekna and TEEEM).
#
# Before: index_users_on_email (email) UNIQUE - global
# After:  index_users_on_email_and_tenant (email, tenant_id) UNIQUE - per tenant
class ScopeUsersEmailUniquenessToTenant < ActiveRecord::Migration[7.1]
  def change
    # Remove old global unique index
    remove_index :users, name: "index_users_on_email"

    # Add tenant-scoped unique index (same email allowed on different tenants)
    add_index :users, [:email, :tenant_id], unique: true, name: "index_users_on_email_and_tenant"
  end
end
