class AddTradesStagesRolesToSmSetting < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_settings, :schedule_master_trades, :jsonb, default: []
    add_column :sm_settings, :schedule_master_stages, :jsonb, default: []
    add_column :sm_settings, :schedule_master_roles, :jsonb, default: []
  end
end
