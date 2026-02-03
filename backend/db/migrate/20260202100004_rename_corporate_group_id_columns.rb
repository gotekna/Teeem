# frozen_string_literal: true

# Rename corporate_group_id → company_group_id in tenant_settings
# Completes the CorporateGroup → CompanyGroup rename
#
# NOTE: users table has user_group_id (different purpose), not corporate_group_id
class RenameCorporateGroupIdColumns < ActiveRecord::Migration[8.0]
  def change
    # Rename column in tenant_settings table (only table with this column)
    if column_exists?(:tenant_settings, :corporate_group_id)
      rename_column :tenant_settings, :corporate_group_id, :company_group_id
    end

    # Rename indexes if they exist
    if index_exists?(:tenant_settings, :corporate_group_id, name: 'index_tenant_settings_on_corporate_group_id')
      rename_index :tenant_settings, 'index_tenant_settings_on_corporate_group_id', 'index_tenant_settings_on_company_group_id'
    end
  end
end
