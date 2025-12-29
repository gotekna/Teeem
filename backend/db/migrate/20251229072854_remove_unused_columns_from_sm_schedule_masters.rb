# frozen_string_literal: true

class RemoveUnusedColumnsFromSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_schedule_master, :header_backup, :string
    remove_column :sm_schedule_master, :trade_text, :string
    remove_column :sm_schedule_master, :stage_text, :string
  end
end
