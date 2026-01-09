class RefactorDocumentationTabsToCategories < ActiveRecord::Migration[8.0]
  def change
    # Rename table
    rename_table :documentation_tabs, :documentation_categories

    # Remove construction_id foreign key and column
    remove_foreign_key :documentation_categories, :constructions
    remove_index :documentation_categories, [ :construction_id, :sequence_order ]
    remove_index :documentation_categories, [ :construction_id, :name ]
    remove_column :documentation_categories, :construction_id, :bigint

    # Add new index on name (globally unique)
    add_index :documentation_categories, :name, unique: true

    # Rename column in schedule_template_rows for clarity
    rename_column :schedule_template_rows, :documentation_tab_ids, :documentation_category_ids
  end
end
