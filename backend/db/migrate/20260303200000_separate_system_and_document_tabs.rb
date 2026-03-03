# frozen_string_literal: true

# SSoT Fix: System tabs must NEVER hold document types.
# Documents should be on dedicated document tabs so they appear at the top.
#
# Group 1: Tabs WITH system components → Split (create new doc sibling)
#   - contract (JobContractTab) → create "Contract Docs"
#   - expenses (JobExpensesTab) → create "Expense Docs"
#   - purchase-orders (JobPurchaseOrdersTab) → create "PO Docs"
#   - xero-bank (XeroBankAccountsCard, parent) → create "Bank Docs" child
#
# Group 2: Leaf tabs WITHOUT components → Just re-save to trigger auto-convert
#   - compliance → becomes tab_type='document' via enforce_leaf_document_type callback
#   - payments → becomes tab_type='document' via enforce_leaf_document_type callback
#
# Group 3: Parent tabs WITHOUT components → Create doc child, move doc types
#   - assets → create "Asset Docs" child
#   - templates → create "Template Docs" child
#
class SeparateSystemAndDocumentTabs < ActiveRecord::Migration[7.2]
  def up
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        # ═══════════════════════════════════════════════════
        # Group 1: Tabs with system components → Split
        # ═══════════════════════════════════════════════════

        # 1a. Contract (under Contract Info) - currently tab_type=document but renders component
        split_tab(
          tab_key: "contract",
          new_display_name: "Contract Docs",
          new_tab_key: "contract-docs",
          force_system: true  # Change existing from document → system
        )

        # 1b. Expenses (under Finance)
        split_tab(
          tab_key: "expenses",
          new_display_name: "Expense Docs",
          new_tab_key: "expense-docs",
          parent_tab_key: "finance"  # expenses is child of finance
        )

        # 1c. Purchase Orders (under Estimating)
        split_tab(
          tab_key: "purchase-orders",
          new_display_name: "PO Docs",
          new_tab_key: "po-docs",
          parent_tab_key: "estimating"  # purchase-orders is child of estimating
        )

        # 1d. Xero Bank (parent with children) → create doc child
        split_tab_to_child(
          tab_key: "xero-bank",
          new_display_name: "Bank Docs",
          new_tab_key: "bank-docs"
        )

        # ═══════════════════════════════════════════════════
        # Group 2: Leaf tabs without components → Re-save
        # enforce_leaf_document_type callback auto-converts
        # ═══════════════════════════════════════════════════

        %w[compliance payments].each do |key|
          folder = WarehouseFolder.find_by(tab_key: key)
          next unless folder
          next if folder.children.exists?  # Safety: skip if it became a parent

          if folder.tab_type == "system" && folder.warehouse_folder_document_types.any?
            # The before_validation callback will convert to 'document'
            folder.save!
            Rails.logger.info "[SeparateSystemDocTabs] #{tenant.name}: #{key} auto-converted to document"
          end
        end

        # ═══════════════════════════════════════════════════
        # Group 3: Parent tabs without components → Create doc child
        # ═══════════════════════════════════════════════════

        split_tab_to_child(
          tab_key: "assets",
          new_display_name: "Asset Docs",
          new_tab_key: "asset-docs"
        )

        split_tab_to_child(
          tab_key: "templates",
          new_display_name: "Template Docs",
          new_tab_key: "template-docs"
        )
      end
    end
  end

  def down
    # Reversible: move doc types back and delete created tabs
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        new_tab_keys = %w[contract-docs expense-docs po-docs bank-docs asset-docs template-docs]
        new_tab_keys.each do |new_key|
          new_folder = WarehouseFolder.find_by(tab_key: new_key)
          next unless new_folder

          # Find original tab to move doc types back
          original_key = case new_key
                         when "contract-docs" then "contract"
                         when "expense-docs" then "expenses"
                         when "po-docs" then "purchase-orders"
                         when "bank-docs" then "xero-bank"
                         when "asset-docs" then "assets"
                         when "template-docs" then "templates"
                         end

          original = WarehouseFolder.find_by(tab_key: original_key)
          if original
            # Move doc types back
            new_folder.warehouse_folder_document_types.update_all(warehouse_folder_id: original.id)
          end

          new_folder.destroy!
        end

        # Revert contract back to document type
        contract = WarehouseFolder.find_by(tab_key: "contract")
        contract&.update_columns(tab_type: "document", tab_group: "documents")

        # Revert compliance/payments back to system
        %w[compliance payments].each do |key|
          folder = WarehouseFolder.find_by(tab_key: key)
          folder&.update_columns(tab_type: "system", tab_group: "data")
        end
      end
    end
  end

  private

  # Split a leaf tab: keep existing as system, create doc sibling with its doc types
  def split_tab(tab_key:, new_display_name:, new_tab_key:, parent_tab_key: nil, force_system: false)
    folder = WarehouseFolder.find_by(tab_key: tab_key)
    return unless folder
    return unless folder.warehouse_folder_document_types.any?

    # Determine parent: same parent as existing tab, or look up by key
    parent = if parent_tab_key
               WarehouseFolder.find_by(tab_key: parent_tab_key)
             else
               folder.parent
             end

    # Create new document tab as sibling
    new_folder = WarehouseFolder.create!(
      name: new_display_name,
      display_name: new_display_name,
      folder_segment: new_display_name.parameterize,
      tab_key: new_tab_key,
      tab_type: "document",
      tab_group: "documents",
      warehouse_type_id: folder.warehouse_type_id,
      parent_id: parent&.id,
      is_system: false,
      enabled: true,
      order_position: folder.order_position + 1,
      folder_path_suffix: folder.folder_path_suffix  # Same storage path suffix
    )

    # Move doc types from system tab to new doc tab
    folder.warehouse_folder_document_types.update_all(warehouse_folder_id: new_folder.id)

    # Force existing tab to system if needed (e.g., contract was tab_type=document)
    if force_system && folder.tab_type != "system"
      folder.update_columns(tab_type: "system", tab_group: "data")
    end

    tenant_name = ActsAsTenant.current_tenant&.name
    Rails.logger.info "[SeparateSystemDocTabs] #{tenant_name}: Split #{tab_key} → created #{new_tab_key} with #{new_folder.warehouse_folder_document_types.count} doc types"
  end

  # Split a parent tab: create doc child under it with its doc types
  def split_tab_to_child(tab_key:, new_display_name:, new_tab_key:)
    folder = WarehouseFolder.find_by(tab_key: tab_key)
    return unless folder
    return unless folder.warehouse_folder_document_types.any?

    # Create new document tab as child
    new_folder = WarehouseFolder.create!(
      name: new_display_name,
      display_name: new_display_name,
      folder_segment: new_display_name.parameterize,
      tab_key: new_tab_key,
      tab_type: "document",
      tab_group: "documents",
      warehouse_type_id: folder.warehouse_type_id,
      parent_id: folder.id,
      is_system: false,
      enabled: true,
      order_position: (folder.children.maximum(:order_position) || 0) + 1,
      folder_path_suffix: folder.folder_path_suffix  # Same storage path suffix
    )

    # Move doc types from parent to new child
    folder.warehouse_folder_document_types.update_all(warehouse_folder_id: new_folder.id)

    tenant_name = ActsAsTenant.current_tenant&.name
    Rails.logger.info "[SeparateSystemDocTabs] #{tenant_name}: Created child #{new_tab_key} under #{tab_key} with #{new_folder.warehouse_folder_document_types.count} doc types"
  end
end
