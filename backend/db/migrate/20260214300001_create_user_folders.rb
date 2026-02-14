# frozen_string_literal: true

class CreateUserFolders < ActiveRecord::Migration[7.1]
  def change
    create_table :user_folders do |t|
      t.references :user, null: false, foreign_key: true
      t.string :path, null: false
      t.timestamps
    end

    add_index :user_folders, [:user_id, :path], unique: true
  end
end
