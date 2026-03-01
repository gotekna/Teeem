# frozen_string_literal: true

class AddDocumentViewedAtToCustomQuoteSuppliers < ActiveRecord::Migration[7.1]
  def change
    add_column :custom_quote_suppliers, :document_viewed_at, :datetime
  end
end
