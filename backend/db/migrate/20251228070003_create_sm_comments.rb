# frozen_string_literal: true

class CreateSmComments < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_comments do |t|
      t.references :sm_task, null: false, foreign_key: true, index: true
      t.references :author, null: false, foreign_key: { to_table: :users }, index: true
      t.references :parent, null: true, foreign_key: { to_table: :sm_comments }, index: true
      t.references :resource, null: true, foreign_key: { to_table: :sm_resources }

      t.text :body, null: false
      t.datetime :deleted_at

      t.timestamps
    end

    add_index :sm_comments, :deleted_at
  end
end
