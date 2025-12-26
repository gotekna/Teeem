# frozen_string_literal: true

class CreateEmailLabelAssignments < ActiveRecord::Migration[8.0]
  def change
    create_table :email_label_assignments do |t|
      # Note: email_warehouse table uses singular name
      t.bigint :email_warehouse_id, null: false, index: true
      t.references :email_label, null: false, foreign_key: true, index: false

      t.timestamps
    end

    # Foreign key to email_warehouse (singular table name)
    add_foreign_key :email_label_assignments, :email_warehouse, column: :email_warehouse_id

    # Ensure each email can only have each label once
    add_index :email_label_assignments,
              [:email_warehouse_id, :email_label_id],
              unique: true,
              name: "idx_email_label_assignments_unique"

    # Fast lookup by label (for "show all emails with this label")
    add_index :email_label_assignments, :email_label_id, name: "idx_email_label_by_label"
  end
end
