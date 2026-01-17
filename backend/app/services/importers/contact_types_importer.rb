# frozen_string_literal: true

module Importers
  class ContactTypesImporter < BaseImporter
    def import!
      spreadsheet.each_with_index do |row, idx|
        row_number = idx + 2

        contact_type = build_contact_type(row)

        if contact_type.save
          @count += 1
        else
          add_error(row_number, contact_type.errors.full_messages.join(", "))
        end
      end

      result
    end

    private

    def build_contact_type(row)
      ContactType.find_or_initialize_by(
        name: normalize_value(row["name"])
      ).tap do |ct|
        ct.company_group = @tenant
        ct.code = normalize_value(row["code"])
        ct.description = normalize_value(row["description"])
        ct.is_active = parse_boolean(row["active"]) != false
      end
    end
  end
end
