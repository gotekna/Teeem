class AllowNullPerformedByInContactActivities < ActiveRecord::Migration[8.0]
  def change
    # Allow null for performed_by columns to support system-initiated actions (e.g., Xero sync)
    change_column_null :contact_activities, :performed_by_type, true
    change_column_null :contact_activities, :performed_by_id, true
  end
end
