# frozen_string_literal: true

# Add signature_field_config to DocumentType for storing template signature positions
# Used by WordToPdfConverter to place signatures at correct locations
#
# Config format:
# [{
#   signatory_type: "director" | "secretary" | "witness" | "authorized_signatory",
#   signatory_name: "John Smith" | null,
#   page_number: 1,
#   x_percent: 65.5,
#   y_percent: 82.0,
#   width_percent: 20.0,
#   height_percent: 8.0
# }]
class AddSignatureFieldConfigToDocumentTypes < ActiveRecord::Migration[7.2]
  def change
    add_column :document_types, :signature_field_config, :jsonb, default: []
  end
end
