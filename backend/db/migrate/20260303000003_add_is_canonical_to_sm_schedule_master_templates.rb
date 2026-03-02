class AddIsCanonicalToSmScheduleMasterTemplates < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_schedule_master_templates, :is_canonical, :boolean, default: false
  end
end
