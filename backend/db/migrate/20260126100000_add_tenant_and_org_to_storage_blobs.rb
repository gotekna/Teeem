# frozen_string_literal: true

# Add multi-tenancy support to StorageBlob
#
# Changes:
#   - tenant_id: Required FK to tenants (backfilled to Tekna)
#   - organization_id: Optional FK to organizations (for org-specific blobs)
#   - needs_migration: Boolean flag for Phase 0 file recovery
#   - file_missing: Boolean flag for orphan detection
#   - file_verified_at: Datetime for verification status
#
# SSoT: StorageBlob now properly supports multi-tenancy with acts_as_tenant
#
class AddTenantAndOrgToStorageBlobs < ActiveRecord::Migration[8.0]
  def change
    # Multi-tenancy columns
    add_reference :storage_blobs, :tenant, null: true, foreign_key: true, index: true
    add_reference :storage_blobs, :organization, null: true, foreign_key: true, index: true

    # Migration tracking columns
    add_column :storage_blobs, :needs_migration, :boolean, default: false, null: false
    add_column :storage_blobs, :file_missing, :boolean, default: false, null: false

    # Note: verified_at already added in migration 20260126000000
    # No need to add it again

    # Compound index for tenant + organization queries
    add_index :storage_blobs, [:tenant_id, :organization_id], name: "idx_storage_blobs_tenant_org"

    # Index for migration status queries
    add_index :storage_blobs, :needs_migration, where: "needs_migration = true", name: "idx_storage_blobs_needs_migration"
    add_index :storage_blobs, :file_missing, where: "file_missing = true", name: "idx_storage_blobs_file_missing"

    # Backfill existing records with Tekna tenant
    reversible do |dir|
      dir.up do
        # Find Tekna tenant and organization
        tekna_tenant = execute("SELECT id FROM tenants WHERE name = 'Tekna' LIMIT 1").first
        tekna_org = execute("SELECT id FROM organizations WHERE slug = 'tekna' LIMIT 1").first

        if tekna_tenant
          tenant_id = tekna_tenant["id"]
          org_id = tekna_org ? tekna_org["id"] : nil

          say "Backfilling #{StorageBlob.count} storage_blobs with tenant_id=#{tenant_id}, organization_id=#{org_id}"

          # Backfill in batches for performance
          execute <<-SQL.squish
            UPDATE storage_blobs
            SET tenant_id = #{tenant_id},
                organization_id = #{org_id || 'NULL'}
            WHERE tenant_id IS NULL
          SQL
        else
          say "No Tekna tenant found - storage_blobs will need manual tenant assignment"
        end
      end
    end

    # Make tenant_id required after backfill
    # Organization can remain null for tenant-shared blobs
    change_column_null :storage_blobs, :tenant_id, false
  end
end
