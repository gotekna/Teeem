# frozen_string_literal: true

# FRC: Migration 100005 created ROOT invoices/bills/purchase-orders tabs AFTER
# migration 100004 tried to set storage flags, so they never got has_storage_folder.
# This fixes the ROOT tabs to have proper storage configuration.
#
class FixContactRootTabStorageFlags < ActiveRecord::Migration[8.0]
  def up
    # Fix ROOT tabs (parent_id: nil) for invoices, bills, purchase-orders
    EntityTab.where(
      scope: 'contact',
      tab_key: %w[invoices bills purchase-orders],
      parent_id: nil
    ).update_all(
      has_storage_folder: true,
      uses_custom_path: true,
      tab_group: 'documents'
    )

    puts "[FixContactRootTabStorageFlags] Updated ROOT contact tabs with storage flags"
  end

  def down
    # Revert to original state
    EntityTab.where(
      scope: 'contact',
      tab_key: %w[invoices bills purchase-orders],
      parent_id: nil
    ).update_all(
      has_storage_folder: false,
      uses_custom_path: false,
      tab_group: nil
    )
  end
end
