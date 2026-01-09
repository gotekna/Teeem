class AddIndexesToSmTemplateRowsBooleanFields < ActiveRecord::Migration[8.0]
  def change
    # Add indexes for boolean fields frequently used in queries and filtering
    add_index :sm_template_rows, :manually_positioned, where: "manually_positioned = true"
    add_index :sm_template_rows, :dependency_broken, where: "dependency_broken = true"
    add_index :sm_template_rows, :require_supervisor_check, where: "require_supervisor_check = true"
    add_index :sm_template_rows, :require_supplier_confirm, where: "require_supplier_confirm = true"
  end
end
