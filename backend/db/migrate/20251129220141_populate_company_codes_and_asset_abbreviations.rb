class PopulateCompanyCodesAndAssetAbbreviations < ActiveRecord::Migration[8.0]
  def up
    # Populate company codes based on company names
    company_codes = {
      'Tekna' => 'T',
      'Tekna Drafting (formerly Rock Invest Qld)' => 'TD',
      'Tekna Homes formerly Tekna Licence' => 'TH',
      'Tekna Admin Pty LTd' => 'TA',
      'Prov1322 Global ATF Team Harder Family Trust' => 'THFT',
      'Team Harder ATF Team Harder Super Fund' => 'THSF',
      'Team Harder' => 'TEAM',
      'Team Harder Super Investments' => 'THSI',
      'Robert Harder' => 'RH',
      'Rachel Harder' => 'RAH',
      'Jared Harder' => 'JH',
      'Grace Harder' => 'GH',
      'Sophie Mee-Jeong Harder' => 'SH',
      'Gen2612' => 'GEN',
      'Prov1322 Global' => 'PROV',
      'Co Invest Capital Pty Ltd' => 'CIC',
      'Co Invest Homes Pty Ltd' => 'CIH',
      'W2G Assets' => 'W2G',
      'The Promise Family Trust' => 'PFT',
      'The Promise QLD Pty Ltd' => 'PQL'
    }

    company_codes.each do |name, code|
      execute "UPDATE companies SET code = '#{code}' WHERE name = '#{name}'"
    end

    # Populate asset abbreviations based on asset names
    asset_abbrevs = {
      'Commercial Building Unit 5/8 Nevilles Street' => 'NEV',
      'Shares in Tekna Homes' => 'SHARES-TH',
      'Shared Equity Loan Khyiroya (Deed Of Novation)' => 'SEL-KHY',
      'Shared Equity Loan Mansfield (Deed Of Novation)' => 'SEL-MAN'
    }

    asset_abbrevs.each do |name, abbrev|
      execute "UPDATE assets SET abbreviation = '#{abbrev}' WHERE name = '#{name}'"
    end
  end

  def down
    # Clear all codes and abbreviations
    execute "UPDATE companies SET code = NULL"
    execute "UPDATE assets SET abbreviation = NULL"
  end
end
