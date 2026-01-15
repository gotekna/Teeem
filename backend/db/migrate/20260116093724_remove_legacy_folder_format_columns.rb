# frozen_string_literal: true

# SSoT Consolidation: Remove legacy folder format columns
# These are replaced by StorageConfiguration.templates (THE ONE source)
#
# Before: CorporateCompanySetting had contact_folder_format and job_folder_name_format
# After: StorageConfiguration.template_for(:contact) and template_for(:job)
class RemoveLegacyFolderFormatColumns < ActiveRecord::Migration[8.0]
  def change
    # SSoT: contact_folder_format replaced by StorageConfiguration.template_for(:contact)
    if column_exists?(:corporate_company_settings, :contact_folder_format)
      remove_column :corporate_company_settings, :contact_folder_format, :string, default: "id_name"
    end

    # SSoT: job_folder_name_format replaced by StorageConfiguration.template_for(:job)
    if column_exists?(:corporate_company_settings, :job_folder_name_format)
      remove_column :corporate_company_settings, :job_folder_name_format, :jsonb
    end
  end
end
