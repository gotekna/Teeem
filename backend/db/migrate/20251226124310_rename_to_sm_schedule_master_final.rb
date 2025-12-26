class RenameToSmScheduleMasterFinal < ActiveRecord::Migration[8.0]
  def change
    rename_table :sm_template_rows, :sm_schedule_master
  end
end
