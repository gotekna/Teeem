class RenameTableToFoundation < ActiveRecord::Migration[8.0]
  def change
    # 1. Rename the main table
    rename_table :tables, :foundations

    # 2. Rename table_id to foundation_id in columns table
    rename_column :columns, :table_id, :foundation_id
    rename_column :columns, :lookup_table_id, :lookup_foundation_id

    # 3. Rename table_id to foundation_id in table_views (also rename the table itself)
    rename_table :table_views, :foundation_views
    rename_column :foundation_views, :table_id, :foundation_id

    # 4. Rename table_id to foundation_id in import_sessions
    rename_column :import_sessions, :table_id, :foundation_id

    # 5. Rename indexes (Rails handles this automatically for column renames,
    #    but we need to handle the composite index names)

    # Remove old indexes with explicit names
    remove_index :columns, name: "index_columns_on_table_id_and_column_name" if index_exists?(:columns, [ :foundation_id, :column_name ], name: "index_columns_on_table_id_and_column_name")
    remove_index :columns, name: "index_columns_on_table_id" if index_exists?(:columns, :foundation_id, name: "index_columns_on_table_id")
    remove_index :columns, name: "index_columns_on_lookup_table_id" if index_exists?(:columns, :lookup_foundation_id, name: "index_columns_on_lookup_table_id")

    # Add new indexes with correct names
    add_index :columns, [ :foundation_id, :column_name ], unique: true, name: "index_columns_on_foundation_id_and_column_name" unless index_exists?(:columns, [ :foundation_id, :column_name ])
    add_index :columns, :foundation_id, name: "index_columns_on_foundation_id" unless index_exists?(:columns, :foundation_id)
    add_index :columns, :lookup_foundation_id, name: "index_columns_on_lookup_foundation_id" unless index_exists?(:columns, :lookup_foundation_id)

    # Foundation views indexes
    remove_index :foundation_views, name: "index_table_views_on_table_id" if index_exists?(:foundation_views, :foundation_id, name: "index_table_views_on_table_id")
    remove_index :foundation_views, name: "index_table_views_on_table_id_and_user_id" if index_exists?(:foundation_views, [ :foundation_id, :user_id ], name: "index_table_views_on_table_id_and_user_id")
    remove_index :foundation_views, name: "index_table_views_on_table_user_order" if index_exists?(:foundation_views, [ :foundation_id, :user_id, :display_order ], name: "index_table_views_on_table_user_order")

    add_index :foundation_views, :foundation_id, name: "index_foundation_views_on_foundation_id" unless index_exists?(:foundation_views, :foundation_id)
    add_index :foundation_views, [ :foundation_id, :user_id ], name: "index_foundation_views_on_foundation_id_and_user_id" unless index_exists?(:foundation_views, [ :foundation_id, :user_id ])
    add_index :foundation_views, [ :foundation_id, :user_id, :display_order ], name: "index_foundation_views_on_foundation_user_order" unless index_exists?(:foundation_views, [ :foundation_id, :user_id, :display_order ])

    # Import sessions index
    remove_index :import_sessions, name: "index_import_sessions_on_table_id" if index_exists?(:import_sessions, :foundation_id, name: "index_import_sessions_on_table_id")
    add_index :import_sessions, :foundation_id, name: "index_import_sessions_on_foundation_id" unless index_exists?(:import_sessions, :foundation_id)

    # 6. Rename indexes on the foundations table itself
    remove_index :foundations, name: "index_tables_on_database_table_name" if index_exists?(:foundations, :database_table_name, name: "index_tables_on_database_table_name")
    remove_index :foundations, name: "index_tables_on_model_class" if index_exists?(:foundations, :model_class, name: "index_tables_on_model_class")
    remove_index :foundations, name: "index_tables_on_slug" if index_exists?(:foundations, :slug, name: "index_tables_on_slug")
    remove_index :foundations, name: "index_tables_on_table_type" if index_exists?(:foundations, :table_type, name: "index_tables_on_table_type")

    add_index :foundations, :database_table_name, name: "index_foundations_on_database_table_name" unless index_exists?(:foundations, :database_table_name)
    add_index :foundations, :model_class, name: "index_foundations_on_model_class" unless index_exists?(:foundations, :model_class)
    add_index :foundations, :slug, unique: true, name: "index_foundations_on_slug" unless index_exists?(:foundations, :slug)
    add_index :foundations, :table_type, name: "index_foundations_on_table_type" unless index_exists?(:foundations, :table_type)
  end
end
