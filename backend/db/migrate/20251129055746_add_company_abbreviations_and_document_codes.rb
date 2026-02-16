class AddCompanyAbbreviationsAndDocumentCodes < ActiveRecord::Migration[8.0]
  def change
    # Add company_code column to company_documents
    add_column :company_documents, :company_code, :string
    add_index :company_documents, :company_code

    # Populate company abbreviations
    reversible do |dir|
      dir.up do
        company_codes = {
          'Tekna Drafting' => 'TD',
          'Gen2612' => 'GEN',
          'Prov1322' => 'PROV',
          'Tekna Homes' => 'TH',
          'Tekna' => 'TEK',
          'Tekna Admin' => 'TA',
          'Team Harder' => 'TH',
          'Team Harder ATF Team Harder Super Fund' => 'THSF',
          'Team Harder Super Investments' => 'THSI',
          'Co Invest Capital' => 'CIC',
          'Co Invest Homes' => 'CIH',
          'W2G Assets' => 'W2G',
          'The Promise Family Trust' => 'TPFT',
          'The Promise QLD' => 'TPQLD'
        }

        company_codes.each do |name_pattern, code|
          execute sanitize_sql_array([
            "UPDATE companies SET abbreviation = ? WHERE name ILIKE ?",
            code,
            "%#{name_pattern}%"
          ])
        end
      end
    end
  end
end
