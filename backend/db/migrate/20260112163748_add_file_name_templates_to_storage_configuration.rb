# frozen_string_literal: true

# Add file_name_templates to StorageConfiguration for auto-save from Entity Config
# SSoT: Stores file naming templates per scope (e.g., "{{OriginalFileName}}", "{{Date}}_{{OriginalFileName}}")
class AddFileNameTemplatesToStorageConfiguration < ActiveRecord::Migration[8.0]
  def change
    add_column :storage_configurations, :file_name_templates, :jsonb, null: false, default: {}
  end
end
