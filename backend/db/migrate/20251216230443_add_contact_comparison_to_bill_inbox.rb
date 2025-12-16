class AddContactComparisonToBillInbox < ActiveRecord::Migration[8.0]
  def change
    add_column :bill_inboxes, :contact_comparison_data, :jsonb, default: {}
  end
end
