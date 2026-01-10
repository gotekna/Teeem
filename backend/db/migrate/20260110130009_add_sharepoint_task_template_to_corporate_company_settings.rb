class AddSharepointTaskTemplateToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_company_settings, :sharepoint_task_template, :string
  end
end
