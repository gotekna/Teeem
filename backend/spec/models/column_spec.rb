# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Column, type: :model do
  describe 'COLUMN_SQL_TYPE_MAP' do
    # SSoT: This constant is THE source of truth for column types
    # If this test fails, update the count here AND in all documentation files:
    #   - TEEEM_DOCS/GOLD_STANDARD_TABLE.md
    #   - .claude/commands/ttv.md, t.md
    #   - .claude/agents/foundation-validator.md
    #   - frontend-next/components/table/core/column-renderer/ColumnRenderer.tsx
    #   - frontend-next/app/(app)/admin/system/components/BrandGuidelinesTab.tsx
    #
    # Run this to find all places that reference column count:
    #   grep -rn "34.*column" --include="*.md" --include="*.tsx" --include="*.rb"

    it 'has exactly 34 column types (update docs if this changes)' do
      expect(Column::COLUMN_SQL_TYPE_MAP.keys.count).to eq(34)
    end

    it 'includes all expected column types' do
      expected_types = %w[
        single_line_text multiple_lines_text email phone mobile url
        number whole_number currency percentage
        date date_and_time time
        gps_coordinates color_picker file_upload action_buttons
        boolean choice
        lookup multiple_lookups user
        computed
        structured_data array_of_items searchable_text array_of_integers
        abn acn bsb bank_account postcode tfn
        uuid
      ]

      actual_types = Column::COLUMN_SQL_TYPE_MAP.keys

      expect(actual_types).to match_array(expected_types)
    end

    it 'maps each column type to a valid SQL type' do
      Column::COLUMN_SQL_TYPE_MAP.each do |type_name, sql_type|
        expect(sql_type).to be_a(String), "#{type_name} should have a string SQL type"
        expect(sql_type).not_to be_empty, "#{type_name} should have a non-empty SQL type"
      end
    end
  end
end
