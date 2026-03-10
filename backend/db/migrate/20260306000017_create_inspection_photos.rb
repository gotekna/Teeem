class CreateInspectionPhotos < ActiveRecord::Migration[7.1]
  def change
    create_table :inspection_photos do |t|
      t.bigint :tenant_id, null: false
      t.references :inspection_item, null: false, foreign_key: true
      t.references :storage_blob, null: false, foreign_key: true
      t.bigint :annotated_blob_id
      t.string :caption
      t.jsonb :annotations_json, default: {}
      t.datetime :taken_at
      t.decimal :latitude, precision: 10, scale: 7
      t.decimal :longitude, precision: 10, scale: 7
      t.integer :sort_order, null: false, default: 0

      t.timestamps
    end

    add_index :inspection_photos, :tenant_id
    add_index :inspection_photos, [:inspection_item_id, :sort_order], name: "idx_inspection_photos_on_item_and_order"
    add_foreign_key :inspection_photos, :storage_blobs, column: :annotated_blob_id
  end
end
