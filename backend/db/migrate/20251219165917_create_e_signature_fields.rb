# frozen_string_literal: true

class CreateESignatureFields < ActiveRecord::Migration[8.0]
  def change
    create_table :e_signature_fields do |t|
      t.references :e_signature_request, null: false, foreign_key: true
      t.references :e_signature_signer, null: false, foreign_key: true

      # Field type and position
      t.string :field_type, null: false  # signature, initials, date, text
      t.integer :page_number, null: false

      # Position as percentage (0-100) for PDF scaling independence
      t.float :x_percent, null: false
      t.float :y_percent, null: false
      t.float :width_percent, null: false
      t.float :height_percent, null: false

      # Configuration
      t.string :label
      t.boolean :required, default: true
      t.string :date_format, default: "%d/%m/%Y"  # For date fields
      t.string :placeholder  # For text fields

      # Completion data (populated when signer completes the field)
      t.text :value  # Captured signature data (base64 image for signatures) or text value
      t.datetime :completed_at

      t.timestamps
    end

    add_index :e_signature_fields, %i[e_signature_request_id page_number], name: "idx_esign_fields_request_page"
    add_index :e_signature_fields, %i[e_signature_signer_id completed_at], name: "idx_esign_fields_signer_completion"
  end
end
