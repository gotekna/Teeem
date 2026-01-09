class AddRoleIdsToContactRelationships < ActiveRecord::Migration[8.0]
  def change
    # Add role_ids as integer array with default empty array
    add_column :contact_relationships, :role_ids, :integer, array: true, default: []

    # Add index for array queries (GIN index for contains/overlap queries)
    add_index :contact_relationships, :role_ids, using: :gin
  end
end
