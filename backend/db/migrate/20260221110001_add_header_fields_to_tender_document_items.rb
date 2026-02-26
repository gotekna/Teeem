# frozen_string_literal: true

# Add header snapshot fields to tender_document_items.
# These capture the parent header at document creation time, same pattern
# as existing section snapshot fields (tender_section_name, tender_section_code, etc.).
#
class AddHeaderFieldsToTenderDocumentItems < ActiveRecord::Migration[8.0]
  def change
    add_column :tender_document_items, :tender_header_name, :string
    add_column :tender_document_items, :tender_header_code, :string
    add_column :tender_document_items, :header_sort_order, :integer
    add_column :tender_document_items, :default_note, :text
  end
end
