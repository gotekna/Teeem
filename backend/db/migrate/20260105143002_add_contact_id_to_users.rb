class AddContactIdToUsers < ActiveRecord::Migration[8.0]
  def change
    add_reference :users, :contact, null: true, foreign_key: true, index: false
    add_index :users, :contact_id, unique: true, where: "contact_id IS NOT NULL", name: "index_users_on_contact_id_unique"
  end
end
