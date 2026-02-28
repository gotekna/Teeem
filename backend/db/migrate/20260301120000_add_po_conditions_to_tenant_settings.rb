class AddPoConditionsToTenantSettings < ActiveRecord::Migration[7.1]
  def change
    add_column :tenant_settings, :po_conditions, :jsonb, comment: "Custom PO Conditions of Acceptance (array of strings)"
  end
end
