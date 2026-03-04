# frozen_string_literal: true

# FRC (Mar 2026): 1,928 WarehouseDocuments with source_type="xero" were found on
# TEEEM tenant (tenant_id=1) but TEEEM has no Xero connection and zero ExternalInvoices.
#
# Root cause: Before the Feb 2026 tenant_id fix (ExternalInvoice.tenant_id confusion),
# Xero attachment sync ran without proper ActsAsTenant context, causing documents to be
# written with tenant_id=1 (TEEEM) instead of their actual tenants (Tekna=2, Pilgrim=3).
#
# These are orphaned legacy records — safe to delete because:
# 1. TEEEM has no Xero connection (no XeroCredential for tenant_id=1)
# 2. No ExternalInvoices exist for TEEEM (tenant_id=1)
# 3. Correct docs exist (or will be re-synced) under their proper tenant IDs
# 4. StorageBlobs are shared (content-addressed) — deleting WarehouseDocument records
#    does NOT delete the underlying files; it only decrements reference counts.
class DeleteOrphanedXeroDocsFromTeeemTenant < ActiveRecord::Migration[7.1]
  def up
    # Safety check: confirm TEEEM really has no Xero connection
    teeem_tenant = Tenant.find_by(id: 1)
    if teeem_tenant.nil?
      puts "Tenant 1 not found — skipping"
      return
    end

    ActsAsTenant.with_tenant(teeem_tenant) do
      xero_doc_count = WarehouseDocument.where(source_type: "xero").count
      puts "Found #{xero_doc_count} orphaned xero WarehouseDocuments on TEEEM (tenant_id=1)"

      if xero_doc_count == 0
        puts "Nothing to delete."
        return
      end

      # Decrement blob reference counts before destroying
      blob_ids = WarehouseDocument.where(source_type: "xero").pluck(:storage_blob_id).compact.uniq
      puts "Decrementing reference counts on #{blob_ids.size} storage blobs..."

      WarehouseDocument.where(source_type: "xero").find_each do |doc|
        doc.storage_blob&.decrement_reference!
      end

      # Destroy the records (callbacks run per-record for audit trail)
      deleted = WarehouseDocument.where(source_type: "xero").delete_all
      puts "Deleted #{deleted} orphaned xero WarehouseDocuments from TEEEM tenant"
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Cannot restore deleted xero docs — re-run Xero attachment sync instead"
  end
end
