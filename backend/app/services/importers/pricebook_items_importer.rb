# frozen_string_literal: true

module Importers
  class PricebookItemsImporter < BaseImporter
    def import!
      spreadsheet.each_with_index do |row, idx|
        row_number = idx + 2

        item = build_pricebook_item(row)

        if item.save
          @count += 1
        else
          add_error(row_number, item.errors.full_messages.join(", "))
        end
      end

      result
    end

    private

    def build_pricebook_item(row)
      PricebookItem.new(
        company_group: @tenant,
        code: normalize_value(row["code"]),
        name: normalize_value(row["name"]),
        description: normalize_value(row["description"]),
        unit: normalize_value(row["unit"]) || "each",
        cost_price: parse_decimal(row["cost_price"]),
        sell_price: parse_decimal(row["sell_price"]),
        category: find_or_create_category(row["category"]),
        supplier_name: normalize_value(row["supplier"]),
        is_active: parse_boolean(row["active"]) != false
      )
    end

    def find_or_create_category(name)
      return nil if name.blank?

      if defined?(PricebookCategory) && PricebookCategory.table_exists?
        PricebookCategory.find_or_create_by!(name: name.to_s.strip)
      else
        name.to_s.strip
      end
    end
  end
end
