class AddQbccLicenseToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_settings, :qbcc_license, :string
  end
end
