# frozen_string_literal: true

class AddDocumentTypeIdsToCustomQuoteTemplateLines < ActiveRecord::Migration[7.2]
  def change
    add_column :custom_quote_template_lines, :document_type_ids, :integer, array: true, default: [], null: false
  end
end
