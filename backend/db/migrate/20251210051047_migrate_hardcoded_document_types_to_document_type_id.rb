class MigrateHardcodedDocumentTypesToDocumentTypeId < ActiveRecord::Migration[8.0]
  def up
    # Count documents before migration
    total_docs = CorporateCompanyDocument.count
    docs_with_type_text = CorporateCompanyDocument.where.not(document_type: [ nil, "" ]).count
    docs_already_mapped = CorporateCompanyDocument.where.not(document_type_id: nil).count

    puts "\n" + "=" * 80
    puts "MIGRATING HARDCODED DOCUMENT TYPES TO DOCUMENT_TYPE_ID"
    puts "=" * 80
    puts "Total documents: #{total_docs}"
    puts "Documents with hardcoded document_type text: #{docs_with_type_text}"
    puts "Documents already mapped to document_type_id: #{docs_already_mapped}"
    puts "=" * 80
    puts ""

    # Group documents by their hardcoded document_type value
    type_groups = CorporateCompanyDocument
      .where.not(document_type: [ nil, "" ])
      .group(:document_type)
      .count
      .sort_by { |_type, count| -count } # Sort by count descending

    puts "HARDCODED DOCUMENT TYPES FOUND:"
    puts "-" * 80
    type_groups.each do |hardcoded_type, count|
      puts sprintf("  %-50s %6d documents", hardcoded_type, count)
    end
    puts "-" * 80
    puts ""

    # Track migration statistics
    stats = {
      mapped_by_exact_name: 0,
      mapped_by_alias: 0,
      mapped_by_abbreviation: 0,
      unmapped: 0,
      already_had_id: 0
    }

    unmapped_types = []

    # Process each document
    CorporateCompanyDocument.find_each do |doc|
      next if doc.document_type.blank?

      # Skip if already has document_type_id
      if doc.document_type_id.present?
        stats[:already_had_id] += 1
        next
      end

      # Try to find matching DocumentType
      doc_type_record = find_document_type_for(doc.document_type)

      if doc_type_record
        doc.update_column(:document_type_id, doc_type_record.id)

        # Track how it was matched
        if doc_type_record.name.downcase == doc.document_type.downcase
          stats[:mapped_by_exact_name] += 1
        elsif doc_type_record.abbreviation&.downcase == doc.document_type.downcase
          stats[:mapped_by_abbreviation] += 1
        else
          stats[:mapped_by_alias] += 1
        end
      else
        stats[:unmapped] += 1
        unmapped_types << doc.document_type unless unmapped_types.include?(doc.document_type)
      end
    end

    # Print results
    puts "\n" + "=" * 80
    puts "MIGRATION RESULTS"
    puts "=" * 80
    puts "✅ Mapped by exact name match:        #{stats[:mapped_by_exact_name]}"
    puts "✅ Mapped by abbreviation match:      #{stats[:mapped_by_abbreviation]}"
    puts "✅ Mapped by alias match:             #{stats[:mapped_by_alias]}"
    puts "⏭️  Already had document_type_id:      #{stats[:already_had_id]}"
    puts "❌ Could not map (unmapped):          #{stats[:unmapped]}"
    puts "=" * 80

    if unmapped_types.any?
      puts "\n⚠️  UNMAPPED DOCUMENT TYPES (need manual review):"
      puts "-" * 80
      unmapped_types.each do |type|
        count = CorporateCompanyDocument.where(document_type: type, document_type_id: nil).count
        puts sprintf("  %-50s %6d documents", type, count)
      end
      puts "-" * 80
      puts "\n💡 TIP: Add these as aliases in DocumentType or create new DocumentType records"
      puts ""
    end

    puts "\n✅ Migration complete!"
    puts "=" * 80
    puts ""
  end

  def down
    # Clear all document_type_id values (revert to hardcoded text only)
    puts "Reverting migration: Clearing all document_type_id values..."
    CorporateCompanyDocument.update_all(document_type_id: nil)
    puts "✅ Reverted: All document_type_id values cleared"
  end

  private

  # Find DocumentType record by name, abbreviation, or alias
  def find_document_type_for(hardcoded_type)
    return nil if hardcoded_type.blank?

    # Try DocumentType.find_by_name_or_alias (uses DB aliases + default aliases)
    doc_type = DocumentType.find_by_name_or_alias(hardcoded_type)
    return doc_type if doc_type

    # Try exact name match (case-insensitive)
    doc_type = DocumentType.active.find_by("LOWER(name) = ?", hardcoded_type.downcase)
    return doc_type if doc_type

    # Try abbreviation match (case-insensitive)
    doc_type = DocumentType.active.find_by("LOWER(abbreviation) = ?", hardcoded_type.downcase)
    return doc_type if doc_type

    # Try partial name match (e.g., "Tax Return" matches "CTR - Company Tax Return")
    doc_type = DocumentType.active.find_by("LOWER(name) LIKE ?", "%#{hardcoded_type.downcase}%")
    return doc_type if doc_type

    # No match found
    nil
  end
end
