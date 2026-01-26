# frozen_string_literal: true

# SSoT: Complete setup for Xero document storage in File Warehouse
#
# Structure:
# ┌─────────────────────────────────────────────────────────────────┐
# │ CONTACTS (Primary Xero Documents)                               │
# │ Storage: {{ContactName}}/Invoices, {{ContactName}}/Bills        │
# ├─────────────────────────────────────────────────────────────────┤
# │ Xero Invoice (XINV)     → Contacts/[Name]/Invoices              │
# │ Xero Credit Note (XCR)  → Contacts/[Name]/Invoices              │
# │ Xero Bill (XBILL)       → Contacts/[Name]/Bills                 │
# └─────────────────────────────────────────────────────────────────┘
#
# ┌─────────────────────────────────────────────────────────────────┐
# │ CORPORATE (Xero Attachments - supporting documents)             │
# │ Storage: {{CompanyGroup}}/{{CompanyCode}}/Invoices|Bills        │
# ├─────────────────────────────────────────────────────────────────┤
# │ Xero Invoice Attachment (XINVA) → Corp/[Group]/[Co]/Invoices    │
# │ Xero Bill Attachment (XBILLA)   → Corp/[Group]/[Co]/Bills       │
# └─────────────────────────────────────────────────────────────────┘
#
class SetupXeroDocumentStorage < ActiveRecord::Migration[8.0]
  def up
    # =====================================================
    # STEP 1: ENTITY TABS (Folder Structure)
    # =====================================================

    # Contact scope: Invoices tab
    contact_invoices = EntityTab.find_or_initialize_by(
      display_name: "Invoices",
      scope: "contact"
    )
    contact_invoices.assign_attributes(
      tab_key: "invoices",
      icon_name: "file-text",
      tab_group: "documents",
      storage_folder_path: "{{ContactName}}/Invoices",
      has_storage_folder: true,
      enabled: true,
      order_position: contact_invoices.order_position || 10
    )
    contact_invoices.save!
    log "Contact/Invoices tab ready (ID: #{contact_invoices.id})"

    # Contact scope: Bills tab
    contact_bills = EntityTab.find_or_initialize_by(
      display_name: "Bills",
      scope: "contact"
    )
    contact_bills.assign_attributes(
      tab_key: "bills",
      icon_name: "receipt",
      tab_group: "documents",
      storage_folder_path: "{{ContactName}}/Bills",
      has_storage_folder: true,
      enabled: true,
      order_position: contact_bills.order_position || (contact_invoices.order_position + 1)
    )
    contact_bills.save!
    log "Contact/Bills tab ready (ID: #{contact_bills.id})"

    # Corporate scope: Invoices tab
    corp_invoices = EntityTab.find_or_initialize_by(
      display_name: "Invoices",
      scope: "corporate_entity"
    )
    corp_invoices.assign_attributes(
      tab_key: "corp_invoices",
      icon_name: "file-invoice",
      tab_group: "documents",
      storage_folder_path: "{{CompanyGroup}}/{{CompanyCode}}/Invoices",
      has_storage_folder: true,
      enabled: true,
      order_position: corp_invoices.order_position || 50
    )
    corp_invoices.save!
    log "Corporate/Invoices tab ready (ID: #{corp_invoices.id})"

    # Corporate scope: Bills tab
    corp_bills = EntityTab.find_or_initialize_by(
      display_name: "Bills",
      scope: "corporate_entity"
    )
    corp_bills.assign_attributes(
      tab_key: "corp_bills",
      icon_name: "file-invoice-dollar",
      tab_group: "documents",
      storage_folder_path: "{{CompanyGroup}}/{{CompanyCode}}/Bills",
      has_storage_folder: true,
      enabled: true,
      order_position: corp_bills.order_position || 51
    )
    corp_bills.save!
    log "Corporate/Bills tab ready (ID: #{corp_bills.id})"

    # =====================================================
    # STEP 2: DOCUMENT TYPES
    # =====================================================

    # Xero Invoice (sales invoice PDF) → Contact/Invoices
    xero_invoice = DocumentType.find_or_initialize_by(name: "Xero Invoice")
    xero_invoice.assign_attributes(
      scope: "contacts",
      abbreviation: "XINV",
      description: "Sales invoice PDF from Xero",
      primary_tab: "Invoices",
      folder: "Invoices"
    )
    xero_invoice.save!

    # Xero Credit Note → Contact/Invoices
    xero_credit = DocumentType.find_or_initialize_by(name: "Xero Credit Note")
    xero_credit.assign_attributes(
      scope: "contacts",
      abbreviation: "XCR",
      description: "Credit note PDF from Xero",
      primary_tab: "Invoices",
      folder: "Invoices"
    )
    xero_credit.save!

    # Xero Bill (purchase bill PDF) → Contact/Bills
    xero_bill = DocumentType.find_or_initialize_by(name: "Xero Bill")
    xero_bill.assign_attributes(
      scope: "contacts",
      abbreviation: "XBILL",
      description: "Purchase bill PDF from Xero",
      primary_tab: "Bills",
      folder: "Bills"
    )
    xero_bill.save!

    # Xero Invoice Attachment → Corporate/Invoices
    xero_inv_att = DocumentType.find_or_initialize_by(name: "Xero Invoice Attachment")
    xero_inv_att.assign_attributes(
      scope: "corporate_entity",
      abbreviation: "XINVA",
      description: "Attachment from Xero sales invoice",
      primary_tab: "Invoices",
      folder: "Invoices"
    )
    xero_inv_att.save!

    # Xero Bill Attachment → Corporate/Bills
    xero_bill_att = DocumentType.find_or_initialize_by(name: "Xero Bill Attachment")
    xero_bill_att.assign_attributes(
      scope: "corporate_entity",
      abbreviation: "XBILLA",
      description: "Attachment from Xero purchase bill",
      primary_tab: "Bills",
      folder: "Bills"
    )
    xero_bill_att.save!

    log "Document types ready: XINV, XCR, XBILL, XINVA, XBILLA"

    # =====================================================
    # STEP 3: DOCUMENT TYPE → TAB ASSOCIATIONS
    # =====================================================

    # Clear old associations for these types
    [xero_invoice, xero_credit, xero_bill, xero_inv_att, xero_bill_att].each do |dt|
      EntityTabDocumentType.where(document_type: dt).destroy_all
    end

    # Contact associations
    create_association(contact_invoices, xero_invoice)
    create_association(contact_invoices, xero_credit)
    create_association(contact_bills, xero_bill)

    # Corporate associations
    create_association(corp_invoices, xero_inv_att)
    create_association(corp_bills, xero_bill_att)

    log "Document type associations created"

    # =====================================================
    # CLEANUP: Remove deprecated types
    # =====================================================

    # Remove generic "Xero Attachment" if exists (replaced by specific types)
    DocumentType.find_by(name: "Xero Attachment")&.destroy

    log "Setup complete"
  end

  def down
    # Remove document types
    DocumentType.where(abbreviation: %w[XINV XCR XBILL XINVA XBILLA]).destroy_all

    # Note: EntityTabs are left in place as they may have other documents
  end

  private

  def create_association(tab, doc_type)
    EntityTabDocumentType.find_or_create_by!(
      entity_tab: tab,
      document_type: doc_type
    ) do |assoc|
      assoc.is_primary = true
    end
  end

  def log(msg)
    Rails.logger.info "[XeroDocStorage] #{msg}"
  end
end
