# frozen_string_literal: true

class AddAttachedDocumentTypesToTenders < ActiveRecord::Migration[7.2]
  def change
    add_column :tenders, :attached_document_types, :jsonb, default: []
  end
end
