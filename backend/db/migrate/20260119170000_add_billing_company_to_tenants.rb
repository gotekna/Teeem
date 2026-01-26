# frozen_string_literal: true

# Add billing_company_id to Tenant
#
# Each Tenant has ONE billing company - the CorporateCompany we invoice for software usage.
# The billing company may or may not have credentials; it's simply who we bill.
#
# Example:
#   Tenant: "Tekna Homes"
#   └── billing_company: Tekna Admin Pty Ltd (id=4) ← 💳 INVOICED
#
class AddBillingCompanyToTenants < ActiveRecord::Migration[8.0]
  def up
    add_column :tenants, :billing_company_id, :bigint
    add_index :tenants, :billing_company_id
    add_foreign_key :tenants, :corporate_companies, column: :billing_company_id

    # Set Tekna Admin Pty Ltd (id=4) as billing company for Tekna Homes tenant (id=1)
    execute <<-SQL.squish
      UPDATE tenants
      SET billing_company_id = 4
      WHERE id = 1;
    SQL
  end

  def down
    remove_foreign_key :tenants, column: :billing_company_id
    remove_index :tenants, :billing_company_id
    remove_column :tenants, :billing_company_id
  end
end
