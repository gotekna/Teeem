# frozen_string_literal: true

class AddDefaultDocumentTypesToTenderDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    add_column :tender_document_templates, :default_document_types, :jsonb, default: []
  end
end
