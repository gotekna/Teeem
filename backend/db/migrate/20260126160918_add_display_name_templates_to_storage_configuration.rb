class AddDisplayNameTemplatesToStorageConfiguration < ActiveRecord::Migration[8.0]
  def change
    add_column :storage_configurations, :display_name_templates, :jsonb, default: {}
  end
end
