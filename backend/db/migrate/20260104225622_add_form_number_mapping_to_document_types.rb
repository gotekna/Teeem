class AddFormNumberMappingToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :form_number_mapping, :jsonb, default: {}
  end
end
