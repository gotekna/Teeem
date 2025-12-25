# frozen_string_literal: true

class AddMatchConfidenceToBillInboxes < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_inboxes, :match_confidence, :integer
    add_column :bill_inboxes, :match_source, :string, limit: 30

    # Index for finding AI-matched bills
    add_index :bill_inboxes, :match_source
  end
end
