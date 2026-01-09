class AddPostcodeToCorporateCompanySetting < ActiveRecord::Migration[8.0]
  def up
    add_column :corporate_company_settings, :postcode, :string

    # Migrate existing postcode from address (Australian postcodes are 4 digits at end)
    execute <<-SQL
      UPDATE corporate_company_settings
      SET postcode = SUBSTRING(address FROM '(\\d{4})\\s*$')
      WHERE address ~ '\\d{4}\\s*$'
    SQL
  end

  def down
    remove_column :corporate_company_settings, :postcode
  end
end
