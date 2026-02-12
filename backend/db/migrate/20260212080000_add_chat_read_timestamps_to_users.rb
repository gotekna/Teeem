# frozen_string_literal: true

class AddChatReadTimestampsToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :chat_read_timestamps, :jsonb, default: {}, null: false
  end
end
