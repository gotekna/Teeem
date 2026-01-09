class DropContactRoles < ActiveRecord::Migration[8.0]
  def change
    drop_table :contact_roles do |t|
      t.string :name, null: false
      t.string :contact_types, array: true, default: []
      t.boolean :active, default: true
      t.timestamps
    end
  end
end
