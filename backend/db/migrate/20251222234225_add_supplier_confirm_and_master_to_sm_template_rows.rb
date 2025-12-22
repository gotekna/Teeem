class AddSupplierConfirmAndMasterToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    # Supplier confirmation - task needs supplier to confirm via email/text
    add_column :sm_template_rows, :require_supplier_confirm, :boolean, default: false

    # Master task - completing this auto-completes all prior tasks
    add_column :sm_template_rows, :is_master, :boolean, default: false
  end
end
