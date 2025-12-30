class AddConfirmationTimestampsToSmTemplateRows < ActiveRecord::Migration[7.2]
  def change
    # Add timestamp columns to track when confirmations happened
    unless column_exists?(:sm_schedule_masters, :confirmed_at)
      add_column :sm_schedule_masters, :confirmed_at, :datetime
    end

    unless column_exists?(:sm_schedule_masters, :supplier_confirmed_at)
      add_column :sm_schedule_masters, :supplier_confirmed_at, :datetime
    end

    # Also add hold_at for consistency with sm_tasks table
    unless column_exists?(:sm_schedule_masters, :hold_at)
      add_column :sm_schedule_masters, :hold_at, :datetime
    end
  end
end
