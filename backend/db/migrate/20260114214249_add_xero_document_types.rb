# frozen_string_literal: true

# SSoT: Add DocumentTypes for Xero invoices, bills, and attachments
# These types enable File Warehouse to display documents in the correct folders
#
# Document routing (from StorageConfiguration.document_routing):
# - xero_primary_invoice → ContactDocument (Contacts/[Name]/Invoices)
# - xero_attachment → CorporateCompanyDocument (Corporate/[Group]/[Company]/[Tab])
#
class AddXeroDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # =====================================================
    # PRIMARY DOCUMENTS → ContactDocument → Contacts scope
    # =====================================================

    # Find or create the Invoices EntityTab for contacts
    invoices_tab = EntityTab.find_by(display_name: "Invoices", scope: "contact")

    # Xero Invoice (Sales Invoice PDF)
    xero_invoice = DocumentType.find_or_create_by!(
      name: "Xero Invoice",
      scope: "contacts"
    ) do |dt|
      dt.abbreviation = "XINV"
      dt.description = "Sales invoice from Xero"
      dt.primary_tab = "Invoices"
      dt.folder = "Invoices"
    end

    # Xero Bill (Purchase Bill PDF)
    xero_bill = DocumentType.find_or_create_by!(
      name: "Xero Bill",
      scope: "contacts"
    ) do |dt|
      dt.abbreviation = "XBILL"
      dt.description = "Purchase bill from Xero"
      dt.primary_tab = "Invoices"
      dt.folder = "Invoices"
    end

    # Xero Credit Note
    xero_credit = DocumentType.find_or_create_by!(
      name: "Xero Credit Note",
      scope: "contacts"
    ) do |dt|
      dt.abbreviation = "XCR"
      dt.description = "Credit note from Xero"
      dt.primary_tab = "Invoices"
      dt.folder = "Invoices"
    end

    # Associate with Invoices EntityTab if it exists
    if invoices_tab
      [xero_invoice, xero_bill, xero_credit].each do |doc_type|
        EntityTabDocumentType.find_or_create_by!(
          entity_tab: invoices_tab,
          document_type: doc_type
        ) do |join|
          join.is_primary = true
        end
      end
      Rails.logger.info "[Migration] Associated Xero document types with Invoices tab (ID: #{invoices_tab.id})"
    else
      Rails.logger.warn "[Migration] Invoices EntityTab not found for contact scope - skipping association"
    end

    # =====================================================
    # ATTACHMENTS → CorporateCompanyDocument → Corporate scope
    # =====================================================

    # Find the Financial or Documents EntityTab for corporate
    financial_tab = EntityTab.find_by(display_name: "Financial", scope: "corporate_entity") ||
                    EntityTab.find_by(display_name: "Documents", scope: "corporate_entity")

    # Xero Attachment (supporting documents attached to invoices/bills)
    xero_attachment = DocumentType.find_or_create_by!(
      name: "Xero Attachment",
      scope: "corporate_entity"
    ) do |dt|
      dt.abbreviation = "XATT"
      dt.description = "Attachment from Xero invoice or bill"
      dt.primary_tab = financial_tab&.display_name || "Financial"
      dt.folder = "Xero Attachments"
    end

    # Associate with Financial/Documents EntityTab if it exists
    if financial_tab
      EntityTabDocumentType.find_or_create_by!(
        entity_tab: financial_tab,
        document_type: xero_attachment
      ) do |join|
        join.is_primary = true
      end
      Rails.logger.info "[Migration] Associated Xero Attachment with #{financial_tab.display_name} tab (ID: #{financial_tab.id})"
    else
      Rails.logger.warn "[Migration] Financial/Documents EntityTab not found for corporate_entity scope - skipping association"
    end

    Rails.logger.info "[Migration] Created Xero document types: Invoice, Bill, Credit Note, Attachment"
  end

  def down
    # Remove the DocumentTypes (associations cascade via dependent: :destroy)
    DocumentType.where(abbreviation: %w[XINV XBILL XCR XATT]).destroy_all
  end
end
