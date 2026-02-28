# frozen_string_literal: true

class AddWarehouseDocumentToTakeoffTables < ActiveRecord::Migration[8.0]
  def change
    # Add warehouse_document_id to all takeoff tables so any PDF with a
    # WarehouseDocument record can have measurements (Universal PDF Markup).
    # Mirrors the existing document_inbox_id columns.

    add_reference :page_scales, :warehouse_document, null: true, index: true, foreign_key: true
    add_reference :takeoff_measurements, :warehouse_document, null: true, index: true, foreign_key: true
    add_reference :takeoff_layers, :warehouse_document, null: true, index: true, foreign_key: true

    # Unique index: one calibration per page per warehouse document
    add_index :page_scales, [:warehouse_document_id, :page_number],
              unique: true,
              where: "warehouse_document_id IS NOT NULL",
              name: "index_page_scales_on_warehouse_doc_and_page"

    # Unique layer names per warehouse document
    add_index :takeoff_layers, [:warehouse_document_id, :name],
              unique: true,
              where: "warehouse_document_id IS NOT NULL",
              name: "index_takeoff_layers_on_warehouse_doc_and_name"
  end
end
