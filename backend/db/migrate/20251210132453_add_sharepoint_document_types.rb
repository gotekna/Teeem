class AddSharepointDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Add identity document aliases to existing PID type instead of creating separate types
    add_identity_aliases

    # Financial Statements (NEW)

    # 1. Profit & Loss Statement
    DocumentType.create!(
      name: "Profit & Loss Statement",
      abbreviation: "P&L",
      folder: "COMPANY",
      file_name: "{CompanyCode} P&L {PeriodLong} FY{YY}",
      display_name: "P&L {PeriodLong} FY{YY}",
      aliases: [ "P&L", "Profit and Loss", "Income Statement", "P L Statement", "Profit Loss" ],
      active: true
    )

    # 2. Balance Sheet
    DocumentType.create!(
      name: "Balance Sheet",
      abbreviation: "BS",
      folder: "COMPANY",
      file_name: "{CompanyCode} Balance Sheet {Date} FY{YY}",
      display_name: "Balance Sheet {Date} FY{YY}",
      aliases: [ "Balance Sheet", "Statement of Financial Position", "BS" ],
      active: true
    )

    # 3. Cash Flow Statement
    DocumentType.create!(
      name: "Cash Flow Statement",
      abbreviation: "CFS",
      folder: "COMPANY",
      file_name: "{CompanyCode} Cash Flow {PeriodLong} FY{YY}",
      display_name: "Cash Flow {PeriodLong} FY{YY}",
      aliases: [ "Cash Flow", "Cash Flow Statement", "Statement of Cash Flows", "CFS" ],
      active: true
    )

    # Business Documents (NEW)

    # 4. Invoice
    DocumentType.create!(
      name: "Invoice",
      abbreviation: "INV",
      folder: "GENERAL",
      file_name: "{CompanyCode} Invoice {InvoiceNum} {Date}",
      display_name: "Invoice {InvoiceNum} {Date}",
      aliases: [ "Invoice", "Tax Invoice", "INV" ],
      active: true
    )

    # 5. Receipt
    DocumentType.create!(
      name: "Receipt",
      abbreviation: "REC",
      folder: "GENERAL",
      file_name: "{CompanyCode} Receipt {Date}",
      display_name: "Receipt {Date}",
      aliases: [ "Receipt", "Payment Receipt", "REC" ],
      active: true
    )

    # 6. Quote
    DocumentType.create!(
      name: "Quote",
      abbreviation: "QTE",
      folder: "GENERAL",
      file_name: "{CompanyCode} Quote {QuoteNum} {Date}",
      display_name: "Quote {QuoteNum} {Date}",
      aliases: [ "Quote", "Quotation", "QTE" ],
      active: true
    )

    # Insurance Documents (NEW)

    # 7. Insurance Policy
    DocumentType.create!(
      name: "Insurance Policy",
      abbreviation: "INS",
      folder: "INSURANCE",
      file_name: "{CompanyCode} Insurance Policy {PolicyType} {Date}",
      display_name: "Insurance Policy {PolicyType} {Date}",
      aliases: [ "Insurance", "Insurance Policy", "Policy", "INS" ],
      active: true
    )

    # 8. Certificate of Currency
    DocumentType.create!(
      name: "Certificate of Currency",
      abbreviation: "COC",
      folder: "INSURANCE",
      file_name: "{CompanyCode} Certificate of Currency {Date}",
      display_name: "Certificate of Currency {Date}",
      aliases: [ "Certificate of Currency", "COC", "Currency Certificate" ],
      active: true
    )

    # General Documents (NEW)

    # 9. Notice
    DocumentType.create!(
      name: "Notice",
      abbreviation: "NOT",
      folder: "GENERAL",
      file_name: "{CompanyCode} Notice {Description} {Date}",
      display_name: "Notice {Description} {Date}",
      aliases: [ "Notice", "Official Notice", "NOT" ],
      active: true
    )

    # 10. Report
    DocumentType.create!(
      name: "Report",
      abbreviation: "REP",
      folder: "GENERAL",
      file_name: "{CompanyCode} Report {Description} {Date}",
      display_name: "Report {Description} {Date}",
      aliases: [ "Report", "REP" ],
      active: true
    )

    # 11. Property Document
    DocumentType.create!(
      name: "Property Document",
      abbreviation: "PROP",
      folder: "GENERAL",
      file_name: "{PropertyName} {DocumentType} {Date}",
      display_name: "{PropertyName} {DocumentType} {Date}",
      aliases: [ "Property", "Property Document", "Livin the Dream", "Living the Dream", "PROP" ],
      active: true
    )

    # Add aliases to other existing document types
    add_aliases_to_existing_types
  end

  def down
    # Remove the document types we added
    DocumentType.where(abbreviation: [
      'P&L', 'BS', 'CFS',      # Financial statements
      'INV', 'REC', 'QTE',     # Business documents
      'INS', 'COC',            # Insurance
      'NOT', 'REP', 'PROP'     # General
    ]).destroy_all

    # Note: We don't remove aliases from existing types as they may be used elsewhere
  end

  private

  def add_identity_aliases
    # Use existing PID (Personal ID Document) type for all identity documents
    pid = DocumentType.find_by(abbreviation: "PID")
    if pid
      identity_aliases = [
        "Passport", "Australian Passport", "Travel Document", "PASS",
        "Driver License", "Drivers Licence", "DL", "Licence", "License",
        "Medicare", "Medicare Card", "MEDI",
        "Birth Certificate", "BC",
        "Marriage Certificate", "MC",
        "Personal ID", "Identity Document", "ID"
      ]
      pid.aliases = (pid.aliases || []) | identity_aliases

      # Update folder to PEOPLE if not set
      pid.folder = "PEOPLE" if pid.folder.blank?

      # Update file name template if generic
      if pid.file_name.blank? || pid.file_name == "PID"
        pid.file_name = "{PersonName} {DocumentType} {Date}"
      end

      # Update display name template
      if pid.display_name.blank? || pid.display_name == "PID"
        pid.display_name = "{DocumentType} {Date}"
      end

      pid.save!
    end
  end

  def add_aliases_to_existing_types
    # Add aliases to Minutes
    minutes = DocumentType.find_by(name: "Minutes - Signed") || DocumentType.find_by("name LIKE ?", "%Minutes%")
    if minutes
      new_aliases = [ "Meeting Minutes", "Board Meeting", "Directors Meeting", "Shareholders Meeting", "Minutes of Meeting", "Minutes" ]
      minutes.aliases = (minutes.aliases || []) | new_aliases
      minutes.save!
    end

    # Add aliases to Resolution
    resolution = DocumentType.find_by("name LIKE ?", "%Resolution%")
    if resolution
      new_aliases = [ "Board Resolution", "Shareholders Resolution", "Directors Resolution", "Company Resolution", "Resolution" ]
      resolution.aliases = (resolution.aliases || []) | new_aliases
      resolution.save!
    end

    # Add aliases to Constitution
    constitution = DocumentType.find_by(name: "Constitution")
    if constitution
      new_aliases = [ "Company Constitution", "Trust Deed", "CONST" ]
      constitution.aliases = (constitution.aliases || []) | new_aliases
      constitution.save!
    end
  end
end
