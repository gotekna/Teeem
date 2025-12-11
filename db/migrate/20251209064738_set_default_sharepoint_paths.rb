class SetDefaultSharepointPaths < ActiveRecord::Migration[8.0]
  def up
    # Default SharePoint path template: /Teeem/Companies/{company_code}/{FOLDER_NAME}
    # Users can customize these paths in the UI

    default_paths = {
      'COMPANY' => '/Teeem/Companies/{company_code}/Company',
      'XERO' => '/Teeem/Companies/{company_code}/Xero',
      'BANK' => '/Teeem/Companies/{company_code}/Bank',
      'ATO' => '/Teeem/Companies/{company_code}/ATO',
      'ASIC' => '/Teeem/Companies/{company_code}/ASIC',
      'TRUST' => '/Teeem/Companies/{company_code}/Trust',
      'REGISTRY' => '/Teeem/Companies/{company_code}/Registry',
      'DIVIDENDS' => '/Teeem/Companies/{company_code}/Dividends',
      'FINANCIALS' => '/Teeem/Companies/{company_code}/Financials',
      'LOANS' => '/Teeem/Companies/{company_code}/Loans',
      'ASSETS' => '/Teeem/Companies/{company_code}/Assets',
      'INSURANCE' => '/Teeem/Companies/{company_code}/Insurance',
      'MINUTES' => '/Teeem/Companies/{company_code}/Minutes',
      'ADVICE' => '/Teeem/Companies/{company_code}/Advice',
      'GENERAL' => '/Teeem/Companies/{company_code}/General'
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
