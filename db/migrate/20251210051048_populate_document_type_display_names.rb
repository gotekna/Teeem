class PopulateDocumentTypeDisplayNames < ActiveRecord::Migration[8.0]
  def up
    # SSoT Fix: Populate display_name for all document types where it's NULL
    # display_name should be a user-friendly version, defaulting to name if not set

    count = 0
    DocumentType.where(display_name: [ nil, "" ]).find_each do |doc_type|
      # Extract friendly name from full name
      # e.g., "CTR - Company Tax Return" -> "Company Tax Return"
      # or "Annual Statement" -> "Annual Statement" (no change)

      display_value = if doc_type.name.include?(" - ")
        # Remove abbreviation prefix (e.g., "CTR - Company Tax Return" -> "Company Tax Return")
        doc_type.name.split(" - ", 2).last.strip
      else
        # Use full name as is
        doc_type.name
      end

      doc_type.update_column(:display_name, display_value)
      count += 1
    end

    puts "✅ Populated display_name for #{count} document types"
  end

  def down
    # Revert: Clear all display_name values
    DocumentType.update_all(display_name: nil)
    puts "⏪ Cleared all display_name values"
  end
end
