class CreateTaskContacts < ActiveRecord::Migration[8.0]
  def change
    create_table :task_contacts do |t|
      t.references :sm_task, null: false, foreign_key: { on_delete: :cascade }
      t.references :contact, foreign_key: { on_delete: :cascade }
      t.references :user, foreign_key: { on_delete: :cascade }
      t.string :role, limit: 50, null: false
      t.boolean :is_sender, default: false
      t.text :notes
      t.references :added_by, foreign_key: { to_table: :users, on_delete: :nullify }

      t.timestamps
    end

    # Unique constraint: one contact per task per role
    add_index :task_contacts, [:sm_task_id, :contact_id, :role],
              unique: true,
              name: "idx_task_contacts_task_contact_role",
              where: "contact_id IS NOT NULL"

    # Unique constraint: one user per task per role
    add_index :task_contacts, [:sm_task_id, :user_id, :role],
              unique: true,
              name: "idx_task_contacts_task_user_role",
              where: "user_id IS NOT NULL"

    # Quick lookup for sender
    add_index :task_contacts, [:sm_task_id, :is_sender],
              where: "is_sender = true",
              name: "idx_task_contacts_sender"

    # Role lookup
    add_index :task_contacts, :role
  end
end
