# frozen_string_literal: true

class AddRetentionCountToBackupConfigurations < ActiveRecord::Migration[7.1]
  def change
    add_column :backup_configurations, :retention_count, :integer, default: 5, null: false
  end
end
