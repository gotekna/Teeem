class CreateSeparateIdentityDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Create 5 separate People identity document types

    # 1. Passport
    DocumentType.create!(
      name: "Passport",
      abbreviation: "PASS",
      folder: "PEOPLE",
      scope: "people",
      file_name: "{PersonName} Passport {Date}",
      display_name: "Passport {Date}",
      aliases: ["Australian Passport", "Travel Document", "Passport Document"],
      active: true
    )

    # 2. Driver License
    DocumentType.create!(
      name: "Driver License",
      abbreviation: "DL",
      folder: "PEOPLE",
      scope: "people",
      file_name: "{PersonName} Driver License {Date}",
      display_name: "Driver License {Date}",
      aliases: ["Drivers Licence", "Driver's License", "Licence", "License", "Driving Licence"],
      active: true
    )

    # 3. Medicare Card
    DocumentType.create!(
      name: "Medicare Card",
      abbreviation: "MEDI",
      folder: "PEOPLE",
      scope: "people",
      file_name: "{PersonName} Medicare Card {Date}",
      display_name: "Medicare Card {Date}",
      aliases: ["Medicare", "Medicare Document"],
      active: true
    )

    # 4. Birth Certificate
    DocumentType.create!(
      name: "Birth Certificate",
      abbreviation: "BC",
      folder: "PEOPLE",
      scope: "people",
      file_name: "{PersonName} Birth Certificate {Date}",
      display_name: "Birth Certificate {Date}",
      aliases: ["Birth Cert", "Certificate of Birth"],
      active: true
    )

    # 5. Marriage Certificate
    DocumentType.create!(
      name: "Marriage Certificate",
      abbreviation: "MC",
      folder: "PEOPLE",
      scope: "people",
      file_name: "{PersonName} Marriage Certificate {Date}",
      display_name: "Marriage Certificate {Date}",
      aliases: ["Marriage Cert", "Certificate of Marriage"],
      active: true
    )

    puts "✅ Created 5 separate identity document types (PASS, DL, MEDI, BC, MC)"
  end

  def down
    # Remove the 5 identity document types
    DocumentType.where(abbreviation: ['PASS', 'DL', 'MEDI', 'BC', 'MC']).destroy_all
    puts "🗑️  Removed 5 identity document types"
  end
end
