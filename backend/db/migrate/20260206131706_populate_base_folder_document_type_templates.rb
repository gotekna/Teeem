# frozen_string_literal: true

# SSoT (Feb 2026): BIG BANG - No fallbacks
# Populate ui_name_template and download_name_template on BaseFolderDocumentType
# from the associated DocumentType records.
#
# This is a ONE-TIME data migration. After this:
# - Templates live on the join table (BaseFolderDocumentType)
# - No fallback to DocumentType.ui_name/download_name
# - Each folder can have different templates for the same doc type
class PopulateBaseFolderDocumentTypeTemplates < ActiveRecord::Migration[7.2]
  def up
    # Copy templates from DocumentType to BaseFolderDocumentType
    execute <<~SQL
      UPDATE base_folder_document_types bfdt
      SET
        ui_name_template = COALESCE(bfdt.ui_name_template, dt.ui_name),
        download_name_template = COALESCE(bfdt.download_name_template, dt.download_name),
        updated_at = NOW()
      FROM document_types dt
      WHERE bfdt.document_type_id = dt.id
        AND (bfdt.ui_name_template IS NULL OR bfdt.download_name_template IS NULL)
    SQL

    # Report what was updated
    updated_count = BaseFolderDocumentType.where.not(ui_name_template: nil).count
    total_count = BaseFolderDocumentType.count
    puts "Populated #{updated_count}/#{total_count} BaseFolderDocumentType records with templates"
  end

  def down
    # Reversible: Clear templates that match DocumentType defaults
    # (only clears if they're identical to the source)
    execute <<~SQL
      UPDATE base_folder_document_types bfdt
      SET
        ui_name_template = NULL,
        download_name_template = NULL,
        updated_at = NOW()
      FROM document_types dt
      WHERE bfdt.document_type_id = dt.id
        AND bfdt.ui_name_template = dt.ui_name
        AND bfdt.download_name_template = dt.download_name
    SQL
  end
end
