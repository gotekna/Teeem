# frozen_string_literal: true

# SSoT: Document Types and Storage Paths for Contact Tabs
#
# This migration:
# 1. Creates Purchase Order document type for contacts
# 2. Links document types to Invoices, Bills, Purchase Orders tabs (ROOT and Financial sub-tabs)
# 3. Sets storage folder paths with {{XeroConnectionName}}/{{ContactName}}/[TabType] pattern
#
# Folder Structure:
#   /Contacts
#     /{{XeroConnectionName}}    ← Primary folder (dynamic Xero connection name)
#       /{{ContactName}}         ← Secondary folder (contact name)
#         /Invoices
#         /Bills
#         /Purchase Orders
#
class AddDocumentTypesAndStoragePathsToContactTabs < ActiveRecord::Migration[8.0]
  def up
    # 1. Create Purchase Order document type if it doesn't exist
    po_doc_type = DocumentType.find_or_create_by!(name: "Purchase Order") do |dt|
      dt.scope = "contacts"
      dt.category = "financial"
      dt.primary_tab = "Purchase Orders"
      dt.folder = "Purchase Orders"
      dt.description = "Purchase order documents for supplier contacts"
      dt.active = true
    end
    puts "  Purchase Order document type ID: #{po_doc_type.id}"

    # Get existing document types
    invoice_doc = DocumentType.find_by(name: "Xero Invoice", scope: "contacts")
    bill_doc = DocumentType.find_by(name: "Xero Bill", scope: "contacts")

    # Get Financial tab for sub-tab lookups
    financial = EntityTab.find_by(scope: 'contact', tab_key: 'financial')

    # 2. Link document types and set storage paths for ROOT tabs
    root_tabs = {
      'invoices' => { folder: 'Invoices', doc: invoice_doc },
      'bills' => { folder: 'Bills', doc: bill_doc },
      'purchase-orders' => { folder: 'Purchase Orders', doc: po_doc_type }
    }

    root_tabs.each do |tab_key, config|
      tab = EntityTab.find_by(scope: 'contact', tab_key: tab_key, parent_id: nil)
      next unless tab

      # Set storage path
      tab.update!(
        has_storage_folder: true,
        storage_folder_path: "{{XeroConnectionName}}/{{ContactName}}/#{config[:folder]}",
        uses_custom_path: true
      )
      puts "  Updated ROOT #{tab_key} storage path"

      # Link document type
      if config[:doc]
        EntityTabDocumentType.find_or_create_by!(entity_tab: tab, document_type: config[:doc]) do |link|
          link.is_primary = true
        end
        puts "  Linked #{config[:doc].name} to ROOT #{tab_key}"
      end
    end

    # 3. Link document types and set storage paths for Financial sub-tabs
    if financial
      sub_tabs = {
        'invoices' => { folder: 'Invoices', doc: invoice_doc },
        'bills' => { folder: 'Bills', doc: bill_doc },
        'purchase-orders' => { folder: 'Purchase Orders', doc: po_doc_type }
      }

      sub_tabs.each do |tab_key, config|
        tab = EntityTab.find_by(scope: 'contact', tab_key: tab_key, parent_id: financial.id)
        next unless tab

        # Set storage path
        tab.update!(
          has_storage_folder: true,
          storage_folder_path: "{{XeroConnectionName}}/{{ContactName}}/#{config[:folder]}",
          uses_custom_path: true
        )
        puts "  Updated Financial sub-tab #{tab_key} storage path"

        # Link document type
        if config[:doc]
          EntityTabDocumentType.find_or_create_by!(entity_tab: tab, document_type: config[:doc]) do |link|
            link.is_primary = true
          end
          puts "  Linked #{config[:doc].name} to Financial #{tab_key}"
        end
      end
    end

    puts "[AddDocumentTypesAndStoragePathsToContactTabs] Complete"
  end

  def down
    # Remove storage paths from tabs
    EntityTab.where(scope: 'contact', tab_key: %w[invoices bills purchase-orders]).update_all(
      has_storage_folder: false,
      storage_folder_path: nil,
      uses_custom_path: false
    )

    # Remove document type links (but keep the document types themselves)
    tabs = EntityTab.where(scope: 'contact', tab_key: %w[invoices bills purchase-orders])
    EntityTabDocumentType.where(entity_tab: tabs).delete_all
  end
end
