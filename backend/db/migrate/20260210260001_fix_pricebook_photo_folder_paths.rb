# frozen_string_literal: true

# FRC (Feb 2026): Pricebook photos and colour swatches were incorrectly
# assigned to "Warehouse/TeeemXL" by the rebrand migration (20260210100500).
#
# Root cause: WarehousePathComputer.find_warehouse_folder_for_doc didn't
# respect existing warehouse_folder_id, and PricebookItem wasn't in the
# linkable_type mapping. The computer fell through to the "warehouse"
# source_type default which returned the TeeemXL root folder.
#
# Fix: Re-assign documents to correct WarehouseFolders based on metadata category.
class FixPricebookPhotoFolderPaths < ActiveRecord::Migration[7.2]
  def up
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        wt = WarehouseType.find_by(code: "warehouse")
        next unless wt

        # Find the correct target folders
        pricebook_wf = WarehouseFolder.where(warehouse_type: wt)
                                       .where("LOWER(name) LIKE ?", "%pricebook%photo%")
                                       .first
        colour_swatch_wf = WarehouseFolder.where(warehouse_type: wt)
                                           .where("LOWER(name) LIKE ?", "%colour%swatch%")
                                           .first

        next unless pricebook_wf || colour_swatch_wf

        # Fix pricebook photos (identified by metadata category)
        if pricebook_wf
          pricebook_docs = WarehouseDocument.where(source_type: "warehouse")
            .where("metadata->>'category' IN (?)", %w[pricebook_photo unmatched_product])
            .where.not(warehouse_folder_id: pricebook_wf.id)

          count = pricebook_docs.count
          if count > 0
            pricebook_docs.update_all(
              warehouse_folder_id: pricebook_wf.id,
              folder_path: "Warehouse/Pricebook Photos"
            )
            say "Tenant #{tenant.id}: Fixed #{count} pricebook photo docs → Warehouse/Pricebook Photos"
          end
        end

        # Fix colour swatches (identified by metadata category)
        if colour_swatch_wf
          swatch_docs = WarehouseDocument.where(source_type: "warehouse")
            .where("metadata->>'category' = ?", "colour_swatch")
            .where.not(warehouse_folder_id: colour_swatch_wf.id)

          count = swatch_docs.count
          if count > 0
            swatch_docs.update_all(
              warehouse_folder_id: colour_swatch_wf.id,
              folder_path: "Warehouse/Colour Swatches"
            )
            say "Tenant #{tenant.id}: Fixed #{count} colour swatch docs → Warehouse/Colour Swatches"
          end
        end
      end
    end
  end

  def down
    # No rollback - correct paths are the desired state
  end
end
