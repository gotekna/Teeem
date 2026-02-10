class AddTenantIdToPoTemplateLineItems < ActiveRecord::Migration[8.0]
  def change
    add_column :po_template_line_items, :tenant_id, :bigint
    add_index :po_template_line_items, :tenant_id
  end
end
