# frozen_string_literal: true

# SSoT Fix: Remove duplicate website_url column
# The table already has a 'website' column - use that instead
class RemoveDuplicateWebsiteUrlFromCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def up
    # Copy any data from website_url to website if website is blank
    execute <<-SQL
      UPDATE corporate_company_settings
      SET website = website_url
      WHERE (website IS NULL OR website = '') AND website_url IS NOT NULL
    SQL

    # Remove the duplicate column
    remove_column :corporate_settings, :website_url
  end

  def down
    add_column :corporate_settings, :website_url, :string
  end
end
