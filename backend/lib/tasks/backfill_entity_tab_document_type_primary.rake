# frozen_string_literal: true

# Backfill is_primary flag for EntityTabDocumentType join records
# SSoT: The is_primary flag identifies which tab is the primary home for a DocumentType
# First tab in the DocumentType's entity_tab_ids array = primary
# All other tabs = secondary ("also show in")

namespace :entity_tabs do
  desc "Backfill is_primary flag on EntityTabDocumentType join records"
  task backfill_is_primary: :environment do
    puts "=== Backfilling is_primary flag for EntityTabDocumentType ==="
    puts ""

    updated_count = 0
    primary_count = 0
    secondary_count = 0

    DocumentType.find_each do |dt|
      joins = dt.entity_tab_document_types.to_a
      next if joins.empty?

      # First tab is primary, rest are secondary
      # We use the order they were created (id order) as proxy for original order
      sorted_joins = joins.sort_by(&:id)

      sorted_joins.each_with_index do |join, index|
        should_be_primary = (index == 0)

        if join.is_primary != should_be_primary
          join.update_column(:is_primary, should_be_primary)
          updated_count += 1
        end

        if should_be_primary
          primary_count += 1
        else
          secondary_count += 1
        end
      end
    end

    puts "Results:"
    puts "  - Primary tabs: #{primary_count}"
    puts "  - Secondary tabs: #{secondary_count}"
    puts "  - Records updated: #{updated_count}"
    puts ""
    puts "Done!"
  end

  desc "Report on EntityTabDocumentType is_primary status"
  task report_is_primary: :environment do
    puts "=== EntityTabDocumentType is_primary Report ==="
    puts ""

    total = EntityTabDocumentType.count
    primary = EntityTabDocumentType.where(is_primary: true).count
    secondary = EntityTabDocumentType.where(is_primary: false).count
    null_primary = EntityTabDocumentType.where(is_primary: nil).count

    puts "Total join records: #{total}"
    puts "  - is_primary: true  = #{primary}"
    puts "  - is_primary: false = #{secondary}"
    puts "  - is_primary: nil   = #{null_primary}"
    puts ""

    # Check for document types with multiple primaries (shouldn't happen)
    multi_primary = EntityTabDocumentType
      .where(is_primary: true)
      .group(:document_type_id)
      .having("COUNT(*) > 1")
      .count

    if multi_primary.any?
      puts "WARNING: #{multi_primary.count} document types have multiple primary tabs!"
      multi_primary.each do |doc_type_id, count|
        dt = DocumentType.find_by(id: doc_type_id)
        puts "  - #{dt&.name || 'Unknown'} (ID: #{doc_type_id}) has #{count} primary tabs"
      end
    else
      puts "OK: No document types have multiple primary tabs"
    end
    puts ""
  end
end
