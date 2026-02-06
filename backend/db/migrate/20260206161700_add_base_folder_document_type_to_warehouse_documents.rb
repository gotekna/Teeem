# frozen_string_literal: true

# SSoT (Feb 2026): BIG BANG - Direct FK from WarehouseDocument → BaseFolderDocumentType
#
# Why: When admin changes templates in BaseFolderDocumentType, we need a way to
# update all affected WarehouseDocument.ui_name values. Without a direct FK,
# we'd have to walk the documentable chain for each document (slow).
#
# With FK:
#   - Query: "all docs using this template" is instant
#   - Sync: When template changes, update all linked docs
#   - ui_name stays consistent with current template
#
class AddBaseFolderDocumentTypeToWarehouseDocuments < ActiveRecord::Migration[7.2]
  def change
    # Add the FK column (nullable - not all docs have document types)
    add_reference :warehouse_documents, :base_folder_document_type,
                  foreign_key: true,
                  null: true,
                  index: true
  end
end
