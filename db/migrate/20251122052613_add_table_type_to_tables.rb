class AddTableTypeToTables < ActiveRecord::Migration[8.0]
  def change
    add_column :tables, :table_type, :string, default: 'user'
    add_column :tables, :model_class, :string
    add_column :tables, :api_endpoint, :string
    add_column :tables, :file_location, :string
    add_column :tables, :has_saved_views, :boolean, default: true

    add_index :tables, :table_type
    add_index :tables, :model_class
  end
end
