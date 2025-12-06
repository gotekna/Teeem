class UpdateJobDocumentationTabsUniqueIndex < ActiveRecord::Migration[8.0]
  def change
    # Remove old unique index on just (job_id, name)
    remove_index :job_documentation_tabs, column: [ :job_id, :name ], if_exists: true

    # Add new unique index that includes parent_id to allow same name in different parent tabs
    add_index :job_documentation_tabs, [ :job_id, :name, :parent_id ], unique: true, name: 'index_job_doc_tabs_on_job_name_parent'
  end
end
