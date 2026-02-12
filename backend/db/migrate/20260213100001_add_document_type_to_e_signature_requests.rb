class AddDocumentTypeToESignatureRequests < ActiveRecord::Migration[8.0]
  def change
    add_reference :e_signature_requests, :document_type, foreign_key: true, null: true
  end
end
