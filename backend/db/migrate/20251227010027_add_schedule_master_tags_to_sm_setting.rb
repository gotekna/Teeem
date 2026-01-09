class AddScheduleMasterTagsToSmSetting < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_settings, :schedule_master_tags, :jsonb, default: [], null: false
  end
end
