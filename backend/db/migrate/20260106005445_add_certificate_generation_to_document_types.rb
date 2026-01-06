class AddCertificateGenerationToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :generates_certificate, :boolean, default: false
    add_column :document_types, :certificate_template, :string  # e.g., "form_43", "form_16"
  end
end
