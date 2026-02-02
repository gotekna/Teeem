class AddWebsiteToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_settings, :website, :string
  end
end
