# Digital Signature Register - tracks every use of a user's digital signature
# SSoT for audit trail and compliance reporting
class CreateSignatureUsages < ActiveRecord::Migration[8.0]
  def change
    create_table :signature_usages do |t|
      # Who signed
      t.references :user, null: false, foreign_key: true

      # What was signed
      t.references :document_type, foreign_key: true
      t.references :job, foreign_key: true
      t.references :job_document, foreign_key: true

      # Signature details
      t.datetime :signed_at, null: false
      t.string :certificate_type  # e.g., "form_43", "contract", "variation"
      t.string :document_name     # Generated filename
      t.string :purpose           # Description of what was signed

      # Audit trail
      t.string :ip_address
      t.string :user_agent

      t.timestamps
    end

    # Indexes for common queries
    add_index :signature_usages, :signed_at
    add_index :signature_usages, :certificate_type
    add_index :signature_usages, [:user_id, :signed_at]
  end
end
