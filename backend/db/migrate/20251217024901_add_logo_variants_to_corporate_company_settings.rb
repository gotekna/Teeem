class AddLogoVariantsToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_company_settings, :logo_mobile, :string
    add_column :corporate_company_settings, :logo_dark, :string
  end
end
