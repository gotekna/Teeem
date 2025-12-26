# frozen_string_literal: true

class CreateEmailLabels < ActiveRecord::Migration[8.0]
  def change
    create_table :email_labels do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.string :color, default: "#6B7280"  # Tailwind gray-500
      t.boolean :is_system, default: false  # For "Starred", "Important", etc.
      t.integer :position, default: 0
      t.integer :email_count, default: 0  # Cached count for performance

      t.timestamps
    end

    add_index :email_labels, [:user_id, :name], unique: true
    add_index :email_labels, [:user_id, :position]
  end
end
