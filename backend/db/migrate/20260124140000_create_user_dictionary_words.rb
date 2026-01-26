# frozen_string_literal: true

class CreateUserDictionaryWords < ActiveRecord::Migration[7.2]
  def change
    create_table :user_dictionary_words do |t|
      t.references :user, null: false, foreign_key: true
      t.string :word, null: false

      t.timestamps
    end

    add_index :user_dictionary_words, [:user_id, :word], unique: true
  end
end
