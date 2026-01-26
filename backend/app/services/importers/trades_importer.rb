# frozen_string_literal: true

module Importers
  class TradesImporter < BaseImporter
    def import!
      spreadsheet.each_with_index do |row, idx|
        row_number = idx + 2

        trade = build_trade(row)

        if trade.save
          @count += 1
        else
          add_error(row_number, trade.errors.full_messages.join(", "))
        end
      end

      result
    end

    private

    def build_trade(row)
      # SmTrade is typically used for trades/subcontractors
      SmTrade.new(
        company_group: @tenant,
        name: normalize_value(row["name"]),
        trade_type: normalize_value(row["trade_type"]),
        contact_name: normalize_value(row["contact_name"]),
        phone: normalize_value(row["phone"]),
        email: normalize_value(row["email"]),
        abn: normalize_value(row["abn"]),
        license_number: normalize_value(row["license_number"]),
        address: normalize_value(row["address"]),
        notes: normalize_value(row["notes"]),
        is_active: parse_boolean(row["active"]) != false
      )
    end
  end
end
