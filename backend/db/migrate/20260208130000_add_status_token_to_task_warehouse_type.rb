# Add Status token to task warehouse type token_config
# FRC: Template uses {{Status}} but token_config only had TaskId, TaskName, JobCode, JobName
# This caused "No Status" in warehouse folder tree for all tasks
class AddStatusTokenToTaskWarehouseType < ActiveRecord::Migration[8.0]
  def up
    wt = WarehouseType.find_by(code: "task")
    return unless wt

    config = wt.token_config || {}
    config["Status"] = "status_label"
    wt.update_column(:token_config, config)
  end

  def down
    wt = WarehouseType.find_by(code: "task")
    return unless wt

    config = wt.token_config || {}
    config.delete("Status")
    wt.update_column(:token_config, config)
  end
end
