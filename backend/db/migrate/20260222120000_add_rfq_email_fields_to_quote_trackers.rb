# frozen_string_literal: true

class AddRfqEmailFieldsToQuoteTrackers < ActiveRecord::Migration[7.2]
  def change
    add_column :quote_trackers, :reminder_count, :integer, default: 0
    add_column :quote_trackers, :last_reminder_at, :datetime
  end
end
