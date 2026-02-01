# frozen_string_literal: true

module Importers
  class CompaniesImporter < BaseImporter
    def import!
      spreadsheet.each_with_index do |row, idx|
        row_number = idx + 2

        # Companies are typically stored as Contacts with is_company flag
        # or as Corporate records depending on system design
        company = build_company(row)

        if company.save
          @count += 1
        else
          add_error(row_number, company.errors.full_messages.join(", "))
        end
      end

      result
    end

    private

    def build_company(row)
      # Using Contact model with company flag
      # SSoT: Multi-tenancy - use tenant association (not deprecated company_group)
      Contact.new(
        tenant: @tenant,
        company_name: normalize_value(row["name"]),
        abn: normalize_value(row["abn"]),
        address: normalize_value(row["address"]),
        phone: normalize_value(row["phone"]),
        email: normalize_value(row["email"]),
        website: normalize_value(row["website"]),
        notes: normalize_value(row["notes"]),
        is_company: true
      )
    end
  end
end
