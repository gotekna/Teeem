class CreateKnownParties < ActiveRecord::Migration[8.0]
  def change
    create_table :known_parties do |t|
      t.string :name, null: false
      t.string :email
      t.string :phone
      t.string :organisation
      t.string :relationship_type
      t.string :default_alignment, default: 'neutral'
      t.text :notes
      t.references :contact, null: true, foreign_key: true
      t.integer :seen_count, default: 1
      t.datetime :last_seen_at

      t.timestamps
    end

    add_index :known_parties, :email, unique: true, where: "email IS NOT NULL"
    add_index :known_parties, [ :name, :organisation ], unique: true
    add_index :known_parties, :relationship_type
  end
end
