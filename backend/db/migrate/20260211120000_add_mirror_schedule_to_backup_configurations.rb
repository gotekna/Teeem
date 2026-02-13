# frozen_string_literal: true

class AddMirrorScheduleToBackupConfigurations < ActiveRecord::Migration[7.1]
  def change
    add_column :backup_configurations, :mirror_schedule, :string, default: "daily_2am", null: false
  end
end
