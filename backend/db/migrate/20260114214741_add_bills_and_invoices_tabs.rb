# frozen_string_literal: true

# SSoT: Create separate Bills and Invoices tabs
#
# Structure after migration:
# - Contacts → [Name] → Invoices (sales invoices - Xero Invoice)
# - Contacts → [Name] → Bills (purchase bills - Xero Bill)
# - Corporate → [Group] → [Company] → Invoices (invoice attachments)
# - Corporate → [Group] → [Company] → Bills (bill attachments)
#
class AddBillsAndInvoicesTabs < ActiveRecord::Migration[8.0]
  def up
    # =====================================================
    # CONTACTS SCOPE - Add Bills tab
    # =====================================================

    # Find existing Invoices tab for contacts
    contact_invoices_tab = EntityTab.find_by(display_name: "Invoices", scope: "contact")

    # Create Bills tab for contacts (next to Invoices)
    contact_bills_tab = EntityTab.find_or_create_by!(
      display_name: "Bills",
      scope: "contact",
      tab_group: "documents"
    ) do |tab|
      tab.tab_key = "bills"
      tab.icon_name = "clipboard-list"  # Different from receipt used elsewhere
      tab.order_position = contact_invoices_tab ? contact_invoices_tab.order_position + 1 : 10
      tab.enabled = true
      tab.storage_folder_path = "{{ContactName}}/Bills"
      tab.has_storage_folder = true
    end

    Rails.logger.info "[Migration] Created/found Bills tab for contacts (ID: #{contact_bills_tab.id})"

    # =====================================================
    # CORPORATE SCOPE - Add Invoices and Bills tabs
    # =====================================================

    # Find reference tab for positioning
    financial_tab = EntityTab.find_by(display_name: "Financial", scope: "corporate_entity")
    documents_tab = EntityTab.find_by(display_name: "Documents", scope: "corporate_entity")
    ref_position = financial_tab&.order_position || documents_tab&.order_position || 10

    # Create Invoices tab for corporate
    corp_invoices_tab = EntityTab.find_or_create_by!(
      display_name: "Invoices",
      scope: "corporate_entity",
      tab_group: "documents"
    ) do |tab|
      tab.tab_key = "corp_invoices"
      tab.icon_name = "file-invoice"  # Unique for corporate invoices
      tab.order_position = ref_position + 1
      tab.enabled = true
      tab.storage_folder_path = "{{CompanyGroup}}/{{CompanyCode}}/Invoices"
      tab.has_storage_folder = true
    end

    Rails.logger.info "[Migration] Created/found Invoices tab for corporate (ID: #{corp_invoices_tab.id})"

    # Create Bills tab for corporate
    corp_bills_tab = EntityTab.find_or_create_by!(
      display_name: "Bills",
      scope: "corporate_entity",
      tab_group: "documents"
    ) do |tab|
      tab.tab_key = "corp_bills"
      tab.icon_name = "file-invoice-dollar"  # Unique for corporate bills
      tab.order_position = ref_position + 2
      tab.enabled = true
      tab.storage_folder_path = "{{CompanyGroup}}/{{CompanyCode}}/Bills"
      tab.has_storage_folder = true
    end

    Rails.logger.info "[Migration] Created/found Bills tab for corporate (ID: #{corp_bills_tab.id})"

    # =====================================================
    # UPDATE DOCUMENT TYPE ASSOCIATIONS
    # =====================================================

    # Find document types
    xero_invoice = DocumentType.find_by(name: "Xero Invoice")
    xero_bill = DocumentType.find_by(name: "Xero Bill")
    xero_credit = DocumentType.find_by(name: "Xero Credit Note")
    xero_attachment = DocumentType.find_by(name: "Xero Attachment")

    # Clear existing associations for Xero types
    [xero_invoice, xero_bill, xero_credit, xero_attachment].compact.each do |dt|
      EntityTabDocumentType.where(document_type: dt).destroy_all
    end

    # Xero Invoice → Contacts/Invoices
    if xero_invoice && contact_invoices_tab
      EntityTabDocumentType.create!(
        entity_tab: contact_invoices_tab,
        document_type: xero_invoice,
        is_primary: true
      )
      xero_invoice.update!(primary_tab: "Invoices")
      Rails.logger.info "[Migration] Associated Xero Invoice with Contacts/Invoices tab"
    end

    # Xero Bill → Contacts/Bills
    if xero_bill && contact_bills_tab
      EntityTabDocumentType.create!(
        entity_tab: contact_bills_tab,
        document_type: xero_bill,
        is_primary: true
      )
      xero_bill.update!(primary_tab: "Bills")
      Rails.logger.info "[Migration] Associated Xero Bill with Contacts/Bills tab"
    end

    # Xero Credit Note → Contacts/Invoices (credit notes go with invoices)
    if xero_credit && contact_invoices_tab
      EntityTabDocumentType.create!(
        entity_tab: contact_invoices_tab,
        document_type: xero_credit,
        is_primary: true
      )
      xero_credit.update!(primary_tab: "Invoices")
      Rails.logger.info "[Migration] Associated Xero Credit Note with Contacts/Invoices tab"
    end

    # Create Xero Invoice Attachment and Xero Bill Attachment types for corporate
    xero_invoice_att = DocumentType.find_or_create_by!(
      name: "Xero Invoice Attachment",
      scope: "corporate_entity"
    ) do |dt|
      dt.abbreviation = "XINVA"
      dt.description = "Attachment from Xero sales invoice"
      dt.primary_tab = "Invoices"
      dt.folder = "Invoices"
    end

    xero_bill_att = DocumentType.find_or_create_by!(
      name: "Xero Bill Attachment",
      scope: "corporate_entity"
    ) do |dt|
      dt.abbreviation = "XBILLA"
      dt.description = "Attachment from Xero purchase bill"
      dt.primary_tab = "Bills"
      dt.folder = "Bills"
    end

    # Associate attachment types with corporate tabs
    EntityTabDocumentType.create!(
      entity_tab: corp_invoices_tab,
      document_type: xero_invoice_att,
      is_primary: true
    )
    Rails.logger.info "[Migration] Associated Xero Invoice Attachment with Corporate/Invoices tab"

    EntityTabDocumentType.create!(
      entity_tab: corp_bills_tab,
      document_type: xero_bill_att,
      is_primary: true
    )
    Rails.logger.info "[Migration] Associated Xero Bill Attachment with Corporate/Bills tab"

    # Remove the generic Xero Attachment type (replaced by specific types)
    xero_attachment&.destroy
    Rails.logger.info "[Migration] Removed generic Xero Attachment type"

    Rails.logger.info "[Migration] Complete: Created Bills tabs and updated DocumentType associations"
  end

  def down
    # Remove the new tabs
    EntityTab.where(display_name: "Bills", scope: "contact").destroy_all
    EntityTab.where(display_name: "Invoices", scope: "corporate_entity").destroy_all
    EntityTab.where(display_name: "Bills", scope: "corporate_entity").destroy_all

    # Remove new document types
    DocumentType.where(name: ["Xero Invoice Attachment", "Xero Bill Attachment"]).destroy_all
  end
end
