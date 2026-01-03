# frozen_string_literal: true

class CreateNotebookShares < ActiveRecord::Migration[8.0]
  def change
    create_table :notebook_shares do |t|
      t.references :notebook, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.references :granted_by, foreign_key: { to_table: :users }
      t.string :permission, null: false, default: "view"
      t.datetime :expires_at

      t.timestamps
    end

    add_index :notebook_shares, [:notebook_id, :user_id], unique: true
    add_index :notebook_shares, :permission
    add_index :notebook_shares, :expires_at
  end
end
