class RemoveUniquenessFromTablesDatabaseTableName < ActiveRecord::Migration[7.2]
  def change
    # Remove unique index - multiple Gold Standard tables can share the same database_table_name
    # Examples: Trinity Bible/Teacher/Lexicon all use 'trinity', Suppliers uses 'contacts'
    remove_index :tables, :database_table_name, if_exists: true

    # Add non-unique index for performance
    add_index :tables, :database_table_name
  end
end
