class RenameSmTemplatesToSmScheduleMasterTemplates < ActiveRecord::Migration[8.0]
  def change
    rename_table :sm_templates, :sm_schedule_master_templates
  end
end
