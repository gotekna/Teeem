class AddPeopleDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Personal ID Document
    DocumentType.create!(
      name: "PID - Personal ID Document",
      abbreviation: "PID",
      display_name: "Personal ID Document",
      description: "Personal identification documents including passports, driver's licenses, birth certificates, police certificates, and other personal ID",
      scope: "people",
      tabs: [ "PEOPLE" ],
      primary_tab: "PEOPLE",
      category: "general",
      file_extensions: %w[pdf jpg jpeg png],
      name_format: "{PersonName} - {IDType} - {Date}",
      target_folder: "People/{PersonName}/ID Documents",
      active: true
    )

    # Personal Tax Return
    DocumentType.create!(
      name: "PTR - Personal Tax Return",
      abbreviation: "PTR",
      display_name: "Personal Tax Return",
      description: "Individual tax returns and related personal tax documents",
      scope: "people",
      tabs: [ "PEOPLE" ],
      primary_tab: "PEOPLE",
      category: "tax",
      file_extensions: %w[pdf],
      name_format: "{PersonName} - Tax Return {FY}",
      target_folder: "People/{PersonName}/Tax Returns",
      requires_filing: true,
      retention_years: 7,
      active: true
    )

    puts "✅ Created PEOPLE document types:"
    puts "  - PID: Personal ID Document"
    puts "  - PTR: Personal Tax Return"
  end

  def down
    DocumentType.where(abbreviation: %w[PID PTR]).destroy_all
    puts "❌ Removed PEOPLE document types"
  end
end
