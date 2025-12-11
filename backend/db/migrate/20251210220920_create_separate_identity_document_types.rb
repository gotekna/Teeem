class CreateSeparateIdentityDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Create 5 separate People identity document types (idempotent)

    # 1. Passport
    DocumentType.find_or_create_by!(abbreviation: "PASS") do |dt|
      dt.name = "Passport"
      dt.folder = "PEOPLE"
      dt.scope = "people"
      dt.file_name = "{PersonName} Passport {Date}"
      dt.display_name = "Passport {Date}"
      dt.aliases = [ "Australian Passport", "Travel Document", "Passport Document" ]
      dt.active = true
    end

    # 2. Driver License
    DocumentType.find_or_create_by!(abbreviation: "DL") do |dt|
      dt.name = "Driver License"
      dt.folder = "PEOPLE"
      dt.scope = "people"
      dt.file_name = "{PersonName} Driver License {Date}"
      dt.display_name = "Driver License {Date}"
      dt.aliases = [ "Drivers Licence", "Driver's License", "Licence", "License", "Driving Licence" ]
      dt.active = true
    end

    # 3. Medicare Card
    DocumentType.find_or_create_by!(abbreviation: "MEDI") do |dt|
      dt.name = "Medicare Card"
      dt.folder = "PEOPLE"
      dt.scope = "people"
      dt.file_name = "{PersonName} Medicare Card {Date}"
      dt.display_name = "Medicare Card {Date}"
      dt.aliases = [ "Medicare", "Medicare Document" ]
      dt.active = true
    end

    # 4. Birth Certificate
    DocumentType.find_or_create_by!(abbreviation: "BC") do |dt|
      dt.name = "Birth Certificate"
      dt.folder = "PEOPLE"
      dt.scope = "people"
      dt.file_name = "{PersonName} Birth Certificate {Date}"
      dt.display_name = "Birth Certificate {Date}"
      dt.aliases = [ "Birth Cert", "Certificate of Birth" ]
      dt.active = true
    end

    # 5. Marriage Certificate
    DocumentType.find_or_create_by!(abbreviation: "MC") do |dt|
      dt.name = "Marriage Certificate"
      dt.folder = "PEOPLE"
      dt.scope = "people"
      dt.file_name = "{PersonName} Marriage Certificate {Date}"
      dt.display_name = "Marriage Certificate {Date}"
      dt.aliases = [ "Marriage Cert", "Certificate of Marriage" ]
      dt.active = true
    end

    puts "✅ Created 5 separate identity document types (PASS, DL, MEDI, BC, MC)"
  end

  def down
    # Remove the 5 identity document types
    DocumentType.where(abbreviation: [ 'PASS', 'DL', 'MEDI', 'BC', 'MC' ]).destroy_all
    puts "🗑️  Removed 5 identity document types"
  end
end
