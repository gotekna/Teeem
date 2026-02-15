# frozen_string_literal: true

# Migrate DEFAULT_ALIASES from hardcoded constant into each DocumentType's aliases JSONB column.
# Only populates records where aliases is empty/null - does not overwrite existing data.
# After this migration, DocumentType no longer needs the DEFAULT_ALIASES constant.
class PopulateDocumentTypeAliases < ActiveRecord::Migration[7.1]
  # Hardcoded aliases that were previously in DocumentType::DEFAULT_ALIASES
  DEFAULT_ALIASES = {
    "BAS - Business Activity Statement" => [
      "Activity Statement", "AS", "Business Activity Statement", "BAS",
      "Activity Stmt", "Bus Activity Statement"
    ],
    "CTR - Company Tax Return" => [
      "Income Tax", "Income Tax Return", "CT", "CTR", "Tax Return",
      "Corporate Tax Return", "Company Tax", "Company Tax Return"
    ],
    "TTR - Trust Tax Return" => [
      "TTR", "Trust Tax", "Trust Income Tax", "Trust Tax Return"
    ],
    "IAS - Instalment Activity Statement" => [
      "Instalment Activity Statement", "IAS", "Instalment Statement"
    ],
    "ATO Documents" => [
      "ATO Document", "ATO Correspondence", "ATO Letter", "ATO Notice",
      "ato_document", "ato document"
    ],
    "Financial Statements" => [
      "Financial Statement", "FS", "Financials", "Annual Financials",
      "Year End Financials", "Final Financials"
    ],
    "Annual Report" => [
      "AR", "Yearly Report"
    ],
    "Annual Statement" => [
      "ASIC Annual Statement", "Company Statement"
    ],
    "Company Extract" => [
      "CE", "ASIC Extract", "Current Company Extract"
    ],
    "Constitution" => [
      "Company Constitution", "CON"
    ],
    "Minutes" => [
      "Meeting Minutes", "MIN", "Board Minutes", "Directors Minutes"
    ],
    "Resolution" => [
      "RES", "Directors Resolution", "Members Resolution"
    ],
    "Trust Deed" => [
      "TD", "Deed of Trust"
    ],
    "Loan Agreement" => [
      "LA", "Loan Contract", "Facility Agreement"
    ],
    "Security Deed" => [
      "SD", "Deed of Security"
    ],
    "PPSR Registration" => [
      "PPSR", "Personal Property Security"
    ],
    "Bank Statement" => [
      "BS", "Account Statement", "Statement of Account"
    ],
    "Certificate of Currency" => [
      "COC", "Insurance Certificate", "Currency Certificate"
    ]
  }.freeze

  def up
    DEFAULT_ALIASES.each do |canonical_name, aliases|
      # Find all document types matching this name (across tenants)
      document_types = execute(<<-SQL.squish)
        SELECT id, aliases FROM document_types
        WHERE LOWER(name) = #{connection.quote(canonical_name.downcase)}
      SQL

      document_types.each do |row|
        dt_id = row["id"]
        existing_aliases = row["aliases"]

        # Parse existing aliases
        existing = if existing_aliases.present?
          begin
            parsed = JSON.parse(existing_aliases)
            parsed.is_a?(Array) ? parsed : []
          rescue JSON::ParserError
            []
          end
        else
          []
        end

        # Only populate if aliases are empty
        next if existing.any?

        # Set the aliases from the defaults
        execute(<<-SQL.squish)
          UPDATE document_types
          SET aliases = #{connection.quote(aliases.to_json)},
              updated_at = NOW()
          WHERE id = #{dt_id}
        SQL
      end
    end

    say "Populated aliases for #{DEFAULT_ALIASES.keys.count} document type names"
  end

  def down
    # Reversible: clear aliases that exactly match the defaults
    DEFAULT_ALIASES.each do |canonical_name, aliases|
      execute(<<-SQL.squish)
        UPDATE document_types
        SET aliases = '[]'::jsonb,
            updated_at = NOW()
        WHERE LOWER(name) = #{connection.quote(canonical_name.downcase)}
          AND aliases = #{connection.quote(aliases.to_json)}::jsonb
      SQL
    end
  end
end
