# frozen_string_literal: true

class CreateSmCommentMentions < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_comment_mentions do |t|
      t.references :sm_comment, null: false, foreign_key: true, index: true
      t.references :user, null: true, foreign_key: true, index: true
      t.references :resource, null: true, foreign_key: { to_table: :sm_resources }

      t.datetime :mentioned_at, null: false
      t.datetime :read_at

      t.timestamps
    end

    add_index :sm_comment_mentions, :read_at
  end
end
