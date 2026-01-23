# frozen_string_literal: true

module Importers
  class ContactsImporter < BaseImporter
    COLUMN_MAP = {
      "first_name" => :first_name,
      "last_name" => :last_name,
      "email" => :email,
      "phone" => :phone,
      "mobile" => :mobile,
      "company" => :company_name,
      "type" => :contact_type_name,
      "address" => :address,
      "city" => :city,
      "state" => :state,
      "postcode" => :postcode,
      "notes" => :notes,
      "abn" => :abn
    }.freeze

    def import!
      spreadsheet.each_with_index do |row, idx|
        row_number = idx + 2 # Account for header and 0-indexing

        contact = build_contact(row)

        if contact.save
          @count += 1
        else
          add_error(row_number, contact.errors.full_messages.join(", "))
        end
      end

      result
    end

    private

    def build_contact(row)
      # SSoT: Multi-tenancy - use tenant association (not deprecated company_group)
      Contact.new(
        tenant: @tenant,
        first_name: normalize_value(row["first_name"]),
        last_name: normalize_value(row["last_name"]),
        email: normalize_value(row["email"]),
        phone: normalize_value(row["phone"]),
        mobile: normalize_value(row["mobile"]),
        company_name: normalize_value(row["company"]),
        contact_type: find_contact_type(row["type"]),
        address: normalize_value(row["address"]),
        city: normalize_value(row["city"]),
        state: normalize_value(row["state"]),
        postcode: normalize_value(row["postcode"]),
        notes: normalize_value(row["notes"]),
        abn: normalize_value(row["abn"])
      )
    end

    def find_contact_type(name)
      return nil if name.blank?
      ContactType.find_by(name: name.to_s.strip)
    end
  end
end
