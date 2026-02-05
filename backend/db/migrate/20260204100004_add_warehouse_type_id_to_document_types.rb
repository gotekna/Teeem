# frozen_string_literal: true

# Migration: Add warehouse_type_id FK to document_types
#
# Part of the Database-Driven Warehouse Types & Base Folders feature.
# This adds an optional foreign key reference to the warehouse_types table.
# Document types can now be directly associated with a warehouse type.
#
# The existing scope column is kept for backward compatibility during migration.
#
class AddWarehouseTypeIdToDocumentTypes < ActiveRecord::Migration[7.2]
  def change
    # Add optional FK reference to warehouse_types table
    # Optional because existing document types don't have this set yet
    add_reference :document_types, :warehouse_type, foreign_key: true, index: true, null: true

    # Note: The existing scope column is kept for backward compatibility.
    # The warehouse_type_id will be populated during data migration.
  end
end
