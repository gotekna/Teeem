# frozen_string_literal: true

class AddExcludedToTenderDocumentItems < ActiveRecord::Migration[7.1]
  def change
    add_column :tender_document_items, :excluded, :boolean, default: false, null: false
  end
end
