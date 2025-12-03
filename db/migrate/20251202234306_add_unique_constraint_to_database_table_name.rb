class AddUniqueConstraintToDatabaseTableName < ActiveRecord::Migration[8.0]
  def change
    # Remove the existing non-unique index
    remove_index :foundations, :database_table_name, if_exists: true

    # Add a unique index - database_table_name is now a natural key
    add_index :foundations, :database_table_name, unique: true
  end
end
