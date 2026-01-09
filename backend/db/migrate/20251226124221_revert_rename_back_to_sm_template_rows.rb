class RevertRenameBackToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    rename_table :sm_schedule_master, :sm_template_rows
  end
end
