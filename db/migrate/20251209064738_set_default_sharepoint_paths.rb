class SetDefaultSharepointPaths < ActiveRecord::Migration[8.0]
  def up
    # Default SharePoint path template: /Corporate/{company_code}/{FOLDER_NAME}
    # Users can customize these paths in the UI

    default_paths = {
      'COMPANY' => '/Corporate/{company_code}/Company',
      'XERO' => '/Corporate/{company_code}/Xero',
      'BANK' => '/Corporate/{company_code}/Bank',
      'ATO' => '/Corporate/{company_code}/ATO',
      'ASIC' => '/Corporate/{company_code}/ASIC',
      'TRUST' => '/Corporate/{company_code}/Trust',
      'REGISTRY' => '/Corporate/{company_code}/Registry',
      'DIVIDENDS' => '/Corporate/{company_code}/Dividends',
      'FINANCIALS' => '/Corporate/{company_code}/Financials',
      'LOANS' => '/Corporate/{company_code}/Loans',
      'ASSETS' => '/Corporate/{company_code}/Assets',
      'INSURANCE' => '/Corporate/{company_code}/Insurance',
      'MINUTES' => '/Corporate/{company_code}/Minutes',
      'ADVICE' => '/Corporate/{company_code}/Advice',
      'GENERAL' => '/Corporate/{company_code}/General'
    }

    default_paths.each do |folder_name, path|
      execute <<-SQL
        UPDATE document_folders
        SET sharepoint_path = '#{path}'
        WHERE name = '#{folder_name}'
      SQL
    end
  end

  def down
    execute "UPDATE document_folders SET sharepoint_path = NULL"
  end
end
