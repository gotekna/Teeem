class AddPoTemplateFieldsToSmTemplateRows < ActiveRecord::Migration[7.2]
  def change
    unless column_exists?(:sm_template_rows, :po_supplier_id)
      add_column :sm_template_rows, :po_supplier_id, :bigint
      add_index :sm_template_rows, :po_supplier_id
    end
    
    unless column_exists?(:sm_template_rows, :po_price_history_ids)
      add_column :sm_template_rows, :po_price_history_ids, :integer, array: true, default: []
    end
  end
end
