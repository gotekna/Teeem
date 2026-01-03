# frozen_string_literal: true

class CreateNotebooks < ActiveRecord::Migration[8.0]
  def change
    create_table :notebooks do |t|
      t.string :name, null: false
      t.text :description
      t.string :icon_name
      t.string :color
      t.references :owner, null: false, foreign_key: { to_table: :users }
      t.string :notable_type
      t.bigint :notable_id
      t.boolean :is_default, default: false, null: false
      t.datetime :archived_at

      t.timestamps
    end

    add_index :notebooks, :name
    add_index :notebooks, [:notable_type, :notable_id]
    add_index :notebooks, :archived_at
  end
end
