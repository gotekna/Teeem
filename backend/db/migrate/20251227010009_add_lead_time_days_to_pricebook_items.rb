class AddLeadTimeDaysToPricebookItems < ActiveRecord::Migration[8.0]
  def change
    # Lead time in days for ordering this item (e.g., 14 days for special orders)
    # If null, system uses default of 7 days for PO tasks
    add_column :pricebook, :lead_time_days, :integer
  end
end
