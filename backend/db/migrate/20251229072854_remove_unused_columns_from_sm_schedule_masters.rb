# frozen_string_literal: true

class RemoveUnusedColumnsFromSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_schedule_masters, :header_backup, :string
    remove_column :sm_schedule_masters, :trade_text, :string
    remove_column :sm_schedule_masters, :stage_text, :string
  end
end
