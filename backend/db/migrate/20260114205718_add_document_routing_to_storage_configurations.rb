# frozen_string_literal: true

# SSoT: Document routing configuration
# Determines which document model to use for different document sources
#
# Default routing:
# - xero_primary_invoice: ContactDocument (primary Xero invoice/bill PDFs go directly to contacts)
# - xero_attachment: CorporateCompanyDocument (supporting attachments go to corporate warehouse)
# - sharepoint_scan: CorporateCompanyDocument (scanned SharePoint docs go to corporate)
# - manual_upload: varies by context (uses scope from upload location)
#
class AddDocumentRoutingToStorageConfigurations < ActiveRecord::Migration[8.0]
  def change
    add_column :storage_configurations, :document_routing, :jsonb, null: false, default: {
      # Primary Xero invoice/bill PDFs → ContactDocument
      # These are the main transaction documents that belong to the contact
      "xero_primary_invoice" => {
        "model" => "ContactDocument",
        "scope" => "contact",
        "description" => "Primary Xero invoice/bill PDF"
      },
      # Xero attachments → CorporateCompanyDocument
      # These are supporting documents that go to the corporate warehouse
      "xero_attachment" => {
        "model" => "CorporateCompanyDocument",
        "scope" => "corporate_entity",
        "description" => "Xero invoice/bill attachments"
      },
      # SharePoint scanned documents → CorporateCompanyDocument
      "sharepoint_scan" => {
        "model" => "CorporateCompanyDocument",
        "scope" => "corporate_entity",
        "description" => "SharePoint scanned documents"
      },
      # Email attachments → CorporateCompanyDocument
      "email_attachment" => {
        "model" => "CorporateCompanyDocument",
        "scope" => "corporate_entity",
        "description" => "Email attachments"
      }
    }
  end
end
