# frozen_string_literal: true

namespace :xero do
  desc "Update Xero document types with file naming templates"
  task update_naming: :environment do
    updates = [
      {
        name: "Xero Invoice",
        file_name: "{ContactName} {DocTypeCode} {InvoiceNumber} {Date}",
        display_name: "{DocTypeName} {InvoiceNumber} {Date}"
      },
      {
        name: "Xero Bill",
        file_name: "{ContactName} {DocTypeCode} {InvoiceNumber} {Date}",
        display_name: "{DocTypeName} {InvoiceNumber} {Date}"
      },
      {
        name: "Xero Credit Note",
        file_name: "{ContactName} {DocTypeCode} {InvoiceNumber} {Date}",
        display_name: "{DocTypeName} {InvoiceNumber} {Date}"
      },
      {
        name: "Xero Invoice Attachment",
        file_name: "{CompanyCode} {DocTypeCode} {InvoiceNumber} {Date} {Description}",
        display_name: "{DocTypeName} {InvoiceNumber} {Description}"
      },
      {
        name: "Xero Bill Attachment",
        file_name: "{CompanyCode} {DocTypeCode} {InvoiceNumber} {Date} {Description}",
        display_name: "{DocTypeName} {InvoiceNumber} {Description}"
      }
    ]

    updates.each do |attrs|
      dt = DocumentType.find_by(name: attrs[:name])
      if dt
        dt.update!(file_name: attrs[:file_name], display_name: attrs[:display_name])
        puts "Updated #{attrs[:name]}: file_name='#{attrs[:file_name]}'"
      else
        puts "SKIP: #{attrs[:name]} not found"
      end
    end

    puts "\nDone! Updated #{updates.size} Xero document types."
  end
end
