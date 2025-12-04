class AddParentIdToJobDocumentationTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :job_documentation_tabs, :parent_id, :bigint
    add_index :job_documentation_tabs, :parent_id
    add_foreign_key :job_documentation_tabs, :job_documentation_tabs, column: :parent_id, on_delete: :cascade
  end
end
