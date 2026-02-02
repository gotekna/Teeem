# frozen_string_literal: true

# Drop deprecated organization_id from warehouse_providers table.
#
# SSoT (Feb 2026): Organization → Tenant consolidation Phase 3
#
# WarehouseProvider now belongs_to :tenant only (validates uniqueness on tenant_id).
# The organization_id column was kept for backwards compatibility but is no longer needed.
#
# Organization.has_one :warehouse_provider is also being removed from the model.
#
class DropOrganizationIdFromWarehouseProviders < ActiveRecord::Migration[8.0]
  def change
    if column_exists?(:warehouse_providers, :organization_id)
      # Remove foreign key if exists
      if foreign_key_exists?(:warehouse_providers, :organizations)
        remove_foreign_key :warehouse_providers, :organizations
      end
      # Remove index if exists
      if index_exists?(:warehouse_providers, :organization_id)
        remove_index :warehouse_providers, :organization_id
      end
      # Remove the column
      remove_column :warehouse_providers, :organization_id, :bigint
    end
  end
end
