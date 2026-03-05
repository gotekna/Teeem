class AddInspectionFieldsToPropertyInspections < ActiveRecord::Migration[7.1]
  def change
    change_table :property_inspections do |t|
      # Signature blobs
      t.bigint :inspector_signature_blob_id
      t.bigint :tenant_signature_blob_id
      t.bigint :report_blob_id

      # Access token for public portal link
      t.string :access_token
      t.datetime :access_token_expires_at

      # GPS coordinates
      t.decimal :gps_latitude, precision: 10, scale: 7
      t.decimal :gps_longitude, precision: 10, scale: 7

      # Timing
      t.datetime :started_at
      t.datetime :completed_at

      # Inspection number
      t.string :inspection_number
    end

    add_index :property_inspections, :access_token, unique: true, where: "access_token IS NOT NULL", name: "idx_property_inspections_access_token"
    add_index :property_inspections, :inspection_number, unique: true, where: "inspection_number IS NOT NULL", name: "idx_property_inspections_number"
    add_foreign_key :property_inspections, :storage_blobs, column: :inspector_signature_blob_id
    add_foreign_key :property_inspections, :storage_blobs, column: :tenant_signature_blob_id
    add_foreign_key :property_inspections, :storage_blobs, column: :report_blob_id
  end
end
