class CreateSuburbs < ActiveRecord::Migration[8.0]
  def change
    create_table :suburbs do |t|
      t.string :name, null: false
      t.string :postcode, null: false
      t.string :state, null: false
      t.string :council
      t.integer :position
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :suburbs, :name
    add_index :suburbs, :postcode
    add_index :suburbs, :state
    add_index :suburbs, :council
    add_index :suburbs, [:name, :state], unique: true
  end
end
