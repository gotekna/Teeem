# frozen_string_literal: true

# FRC (Feb 2026): Warehouse-sourced documents (BillInbox, ChatMessage,
# TeeemSpreadsheet, TeeemDocument, TeeemPdf) have generic folder_path
# "Warehousing/TeeemXL" instead of their model-specific paths.
#
# Root cause: No migration existed to recompute these paths after
# the tenant_id fix (20260210100001). The job path recompute migration
# (20260210200001) only targeted job documents.
#
# Each documentable model defines warehouse_folder_path:
#   BillInbox         → "Warehousing/BillInbox/{Status}/{Year}/{Month}"
#   ChatMessage       → "Warehousing/Chat/General/{Year}/{Month}"
#   TeeemSpreadsheet  → "Warehousing/TeeemXL/{User}/{Year}" or "Jobs/{Code}/TeeemXL"
#   TeeemDocument     → "Warehousing/TeeemWord/{User}/{Year}" or "Jobs/{Code}/TeeemWord"
#   TeeemPdf          → "Warehousing/TeeemPDF/{User}/{Year}" or "Jobs/{Code}/TeeemPDF"
#
class RecomputeWarehouseSourceDocumentPaths < ActiveRecord::Migration[7.2]
  def up
    computer = WarehousePathComputer.new
    fixed = 0
    errors = 0
    skipped = 0

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        # All warehouse-sourced documents for this tenant
        docs = WarehouseDocument.unscoped
          .where(tenant_id: tenant.id, source_type: "warehouse")

        total = docs.count
        next if total.zero?

        say "Tenant #{tenant.id}: #{total} warehouse-sourced documents"

        docs.find_each do |doc|
          old_path = doc.folder_path

          # Skip if documentable is missing (deleted record)
          unless doc.documentable.present?
            skipped += 1
            next
          end

          result = computer.compute(doc)

          if result[:folder_path].present? && result[:folder_path] != old_path
            doc.update_columns(
              folder_path: result[:folder_path],
              warehouse_folder_id: result[:warehouse_folder_id],
              path_template_version: result[:path_template_version]
            )
            fixed += 1
          end
        rescue => e
          errors += 1
          say "  ERROR doc ##{doc.id}: #{e.message}"
        end
      end
    end

    say "Recomputed #{fixed} documents (#{skipped} skipped, #{errors} errors)"
  end

  def down
    # No rollback - paths are now correct
  end
end
