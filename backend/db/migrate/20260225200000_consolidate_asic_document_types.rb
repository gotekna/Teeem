# frozen_string_literal: true

# Consolidate ASIC Forms document types into the existing ASIC folder.
#
# The "ASIC Forms" folder (created by 20260213200001) duplicated types that
# already exist in the "ASIC" folder created via the admin UI:
#   - "Form 484 Record" (484)  → "ASIC Form 484 - Director Changes" (F484)
#   - "Consent to Act" (CTA)   → "Consent to Act as Director" (CAD)
#
# Two types have NO equivalent in ASIC and need to be created there:
#   - "Director Resignation" (DR)  → new in ASIC
#   - "Directors Minutes" (DM)     → new in ASIC
#
# After migration:
#   - DR and DM exist in the ASIC folder
#   - ASIC Forms folder and its 4 duplicate types (484, CTA) are removed
#   - WarehouseDocuments referencing removed types are remapped
#
class ConsolidateAsicDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    tenant = Tenant.first
    return puts "⚠️  No tenant found - skipping" unless tenant

    ActsAsTenant.with_tenant(tenant) do
      corporate_wt = WarehouseType.find_by(code: "corporate")
      return puts "⚠️  No 'corporate' warehouse type found - skipping" unless corporate_wt

      # Find the ASIC folder (created via admin UI)
      asic_folder = WarehouseFolder.find_by(warehouse_type: corporate_wt, name: "ASIC")
      unless asic_folder
        puts "⚠️  No 'ASIC' warehouse folder found - skipping"
        return
      end

      # Find the ASIC Forms folder (to be removed)
      asic_forms_folder = WarehouseFolder.find_by(warehouse_type: corporate_wt, name: "ASIC Forms")

      # --- Step 1: Add missing types to ASIC folder ---

      dr_type = DocumentType.find_by(abbreviation: "DR")
      dm_type = DocumentType.find_by(abbreviation: "DM")

      # If DR/DM exist (from ASIC Forms migration), relink to ASIC folder.
      # If they don't exist, create them.
      unless dr_type
        dr_type = DocumentType.create!(
          name: "Director Resignation",
          abbreviation: "DR",
          ui_name: "Director Resignation Letter",
          description: "Formal resignation letter for ceasing directors",
          scope: "company",
          active: true,
          warehouse_type: corporate_wt
        )
        puts "  Created: Director Resignation (DR)"
      end

      unless dm_type
        dm_type = DocumentType.create!(
          name: "Directors Minutes",
          abbreviation: "DM",
          ui_name: "Minutes of Meeting of Directors",
          description: "Board resolution minutes for director changes",
          scope: "company",
          active: true,
          warehouse_type: corporate_wt
        )
        puts "  Created: Directors Minutes (DM)"
      end

      # Ensure DR and DM are linked to the ASIC folder
      [dr_type, dm_type].each do |dt|
        WarehouseFolderDocumentType.find_or_create_by!(
          warehouse_folder: asic_folder,
          document_type: dt
        ) do |wfdt|
          wfdt.is_primary = true
        end
        puts "  Linked #{dt.abbreviation} to ASIC folder"
      end

      # --- Step 2: Remap WarehouseDocuments from duplicate types ---

      f484_type = DocumentType.find_by(abbreviation: "F484")
      cad_type = DocumentType.find_by(abbreviation: "CAD")
      old_484_type = DocumentType.find_by(abbreviation: "484")
      old_cta_type = DocumentType.find_by(abbreviation: "CTA")

      # Remap 484 → F484
      if old_484_type && f484_type
        remap_documents(old_484_type, f484_type, asic_folder)
      end

      # Remap CTA → CAD
      if old_cta_type && cad_type
        remap_documents(old_cta_type, cad_type, asic_folder)
      end

      # DR and DM are already the correct types (just moved to ASIC folder above)

      # --- Step 3: Clean up ASIC Forms folder ---

      if asic_forms_folder
        # Remove folder-doc type links
        WarehouseFolderDocumentType.where(warehouse_folder: asic_forms_folder).destroy_all
        puts "  Removed ASIC Forms folder-doc type links"

        # Remove the folder itself
        asic_forms_folder.destroy!
        puts "  Deleted ASIC Forms folder"
      end

      # Delete the duplicate types (484 and CTA) - their documents have been remapped
      [old_484_type, old_cta_type].compact.each do |dt|
        # Only delete if no remaining references
        remaining = WarehouseFolderDocumentType.where(document_type: dt).count
        if remaining == 0
          dt.destroy!
          puts "  Deleted duplicate type: #{dt.abbreviation} (#{dt.name})"
        else
          puts "  ⚠️  Kept #{dt.abbreviation} - still has #{remaining} folder links"
        end
      end

      puts "✅ Consolidated ASIC document types into ASIC folder"
    end
  end

  def down
    # Re-running the original migration (20260213200001) would recreate ASIC Forms
    puts "Run 20260213200001 to recreate ASIC Forms folder if needed"
  end

  private

  def remap_documents(old_type, new_type, target_folder)
    # Find the target WFDT for the new type
    target_wfdt = WarehouseFolderDocumentType.find_by(
      warehouse_folder: target_folder,
      document_type: new_type
    )

    return puts "  ⚠️  No WFDT for #{new_type.abbreviation} in target folder" unless target_wfdt

    # Update WarehouseDocuments that reference the old type's WFDTs
    old_wfdts = WarehouseFolderDocumentType.where(document_type: old_type)
    count = WarehouseDocument.where(warehouse_folder_document_type: old_wfdts).update_all(
      warehouse_folder_document_type_id: target_wfdt.id
    )

    # Also update metadata references
    WarehouseDocument.where("metadata->>'document_type_id' = ?", old_type.id.to_s).find_each do |doc|
      doc.metadata["document_type_id"] = new_type.id.to_s
      doc.metadata["document_type"] = new_type.name
      doc.save!
    end

    puts "  Remapped #{count} documents: #{old_type.abbreviation} → #{new_type.abbreviation}"
  end
end
