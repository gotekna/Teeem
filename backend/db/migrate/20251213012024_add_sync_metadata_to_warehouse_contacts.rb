# frozen_string_literal: true

# Adds sync metadata fields to WarehouseContacts
# These fields allow WarehouseContact to fully replace ContactExternalLink
class AddSyncMetadataToWarehouseContacts < ActiveRecord::Migration[8.0]
  def change
    # Sync control fields
    add_column :warehouse_contacts, :sync_enabled, :boolean, default: true
    add_column :warehouse_contacts, :sync_direction, :string, default: "bidirectional"
    add_column :warehouse_contacts, :sync_error, :text

    # Conflict tracking
    add_column :warehouse_contacts, :conflict_fields, :jsonb, default: {}

    # Match metadata (how the warehouse contact was linked to TEEEM Contact)
    add_column :warehouse_contacts, :match_type, :string
    add_column :warehouse_contacts, :match_confidence, :decimal, precision: 5, scale: 4

    # Review workflow
    add_column :warehouse_contacts, :needs_review, :boolean, default: false
    add_column :warehouse_contacts, :reviewed_at, :datetime
    add_column :warehouse_contacts, :reviewed_by, :string

    # Indexes for common queries
    add_index :warehouse_contacts, :sync_enabled
    add_index :warehouse_contacts, :needs_review
  end
end
