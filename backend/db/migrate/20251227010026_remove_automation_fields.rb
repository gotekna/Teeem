class RemoveAutomationFields < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_schedule_master, :auto_include, :boolean
    remove_column :sm_schedule_master, :allow_duplicates, :boolean
    remove_column :sm_schedule_master, :ai_select, :boolean
    remove_column :sm_schedule_master, :is_master, :boolean
  end
end
