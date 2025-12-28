class UpdateDocumentTypesColumnSettings < ActiveRecord::Migration[8.0]
  def up
    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    foundation = Foundation.find_by(slug: "document_types")
    return puts "⚠️ Foundation 'document_types' not found - skipping migration" unless foundation

    puts "\n" + "=" * 80
    puts "UPDATING DOCUMENT TYPES COLUMN SETTINGS (slug: document_types, id: #{foundation.id})"
    puts "=" * 80

    # 1. Change "abbreviation" column display_name from "CODE" to "Job Title"
    #    (This column will show job title for job-scoped docs, code for others)
    abbrev_col = foundation.columns.find_by(name: "abbreviation")
    if abbrev_col
      abbrev_col.update!(display_name: "Job Title")
      puts "✅ Changed 'abbreviation' column header: CODE → Job Title"
    end

    # 2. Hide "target_folder" column (contains address/person info - not needed by default)
    target_folder_col = foundation.columns.find_by(name: "target_folder")
    if target_folder_col
      target_folder_col.update!(visible: false)
      puts "✅ Hidden 'target_folder' column (contains address/person paths)"
    end

    puts "=" * 80
    puts "✅ Column settings updated successfully"
    puts "=" * 80
    puts ""
  end

  def down
    # Revert changes - SSoT: Use slug lookup
    foundation = Foundation.find_by(slug: "document_types")
    return puts "⚠️ Foundation 'document_types' not found - skipping rollback" unless foundation

    abbrev_col = foundation.columns.find_by(name: "abbreviation")
    abbrev_col&.update!(display_name: "CODE")

    target_folder_col = foundation.columns.find_by(name: "target_folder")
    target_folder_col&.update!(visible: true)

    puts "⏪ Reverted: Column settings restored to original"
  end
end
