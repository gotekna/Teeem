class AddDefaultTenantIdToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :default_tenant_id, :integer, null: true
    add_index :users, :default_tenant_id
    add_foreign_key :users, :tenants, column: :default_tenant_id, on_delete: :nullify
  end
end
