class AddDocumentTypeToCustomQuoteLines < ActiveRecord::Migration[8.0]
  def change
    add_reference :custom_quote_lines, :document_type, null: true, foreign_key: true
  end
end
