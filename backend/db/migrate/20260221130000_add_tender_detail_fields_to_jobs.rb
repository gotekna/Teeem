# frozen_string_literal: true

# Add tender detail fields to jobs for Rawson-style tender document generation.
# These fields are editable on the Contract tab and snapshotted into tender_documents at creation.
class AddTenderDetailFieldsToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :estate, :string
    add_column :jobs, :facade, :string
    add_column :jobs, :developer_approval, :boolean, default: false
    add_column :jobs, :developer_contact, :string
    add_column :jobs, :land_registration, :string
    add_column :jobs, :building_contract_type, :string
    add_column :jobs, :development_application, :string
    add_column :jobs, :sales_centre, :string
    add_column :jobs, :wind_classification, :string
    add_column :jobs, :soil_classification, :string
    add_column :jobs, :specification, :string
  end
end
