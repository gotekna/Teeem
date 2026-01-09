# frozen_string_literal: true

class RemoveUnusedColumnsFromSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    # Only remove columns if they exist (may have already been removed or never created)
    remove_column :sm_schedule_masters, :header_backup, :string if column_exists?(:sm_schedule_masters, :header_backup)
    remove_column :sm_schedule_masters, :trade_text, :string if column_exists?(:sm_schedule_masters, :trade_text)
    remove_column :sm_schedule_masters, :stage_text, :string if column_exists?(:sm_schedule_masters, :stage_text)
  end
end
