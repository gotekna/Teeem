class CreateContactRelationships < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_relationships do |t|
      t.references :source_contact, null: false, foreign_key: { to_table: :contacts }
      t.references :related_contact, null: false, foreign_key: { to_table: :contacts }
      t.string :relationship_type, null: false
      t.text :notes

      t.timestamps
    end

    # Add unique constraint for relationship pairs
    add_index :contact_relationships, [ :source_contact_id, :related_contact_id ],
              unique: true, name: 'index_contact_relationships_on_source_and_related'
  end
end
