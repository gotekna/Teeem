class RemoveSupplierIdFromSmTemplateRows < ActiveRecord::Migration[7.2]
  def change
    if column_exists?(:sm_template_rows, :supplier_id)
      remove_column :sm_template_rows, :supplier_id, :bigint
    end
  end
end
