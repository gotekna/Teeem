class AddGanttColumnConfigToCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_settings, :gantt_column_config, :jsonb, default: {}
  end
end
