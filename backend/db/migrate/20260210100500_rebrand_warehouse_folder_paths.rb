# frozen_string_literal: true

# FRC (Feb 2026): Warehouse-sourced documents used generic folder names
# (Excel, PDF, Word) instead of Teeem product branding (TeeemXL, TeeemPDF, TeeemWord).
#
# This migration recomputes paths using the updated warehouse_folder_path methods
# which now return branded names.
#
class RebrandWarehouseFolderPaths < ActiveRecord::Migration[7.2]
  def up
    computer = WarehousePathComputer.new
    fixed = 0
    errors = 0
    skipped = 0

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        docs = WarehouseDocument.unscoped
          .where(tenant_id: tenant.id, source_type: "warehouse")

        total = docs.count
        next if total.zero?

        say "Tenant #{tenant.id}: #{total} warehouse-sourced documents"

        docs.find_each do |doc|
          old_path = doc.folder_path

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

    say "Rebranded #{fixed} documents (#{skipped} skipped, #{errors} errors)"
  end

  def down
    # No rollback - branded paths are correct
  end
end
