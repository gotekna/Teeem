# frozen_string_literal: true

# Add tender detail snapshot columns to tender_documents.
# These fields are frozen at tender creation time so the document
# remains a point-in-time record even if job data changes later.
class AddTenderDetailSnapshotsToTenderDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :tender_documents, :council, :string
    add_column :tender_documents, :estate, :string
    add_column :tender_documents, :facade, :string
    add_column :tender_documents, :design_name, :string
    add_column :tender_documents, :specification, :string
    add_column :tender_documents, :developer_approval, :boolean
    add_column :tender_documents, :developer_contact, :string
    add_column :tender_documents, :land_registration, :string
    add_column :tender_documents, :building_contract_type, :string
    add_column :tender_documents, :development_application, :string
    add_column :tender_documents, :sales_centre, :string
    add_column :tender_documents, :wind_classification, :string
    add_column :tender_documents, :soil_classification, :string
    add_column :tender_documents, :lot_address, :string
    add_column :tender_documents, :plan_number, :string
  end
end
