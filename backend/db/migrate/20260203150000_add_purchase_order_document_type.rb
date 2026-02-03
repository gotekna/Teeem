# frozen_string_literal: true

class AddPurchaseOrderDocumentType < ActiveRecord::Migration[7.1]
  def up
    # Get the tenant (assuming single tenant for this Tekna instance)
    tenant_id = Tenant.first&.id
    return unless tenant_id

    # Create DocumentType for Purchase Orders
    DocumentType.find_or_create_by!(name: "Purchase Order", tenant_id: tenant_id) do |dt|
      dt.abbreviation = "PO"
      dt.description = "Purchase Order sent to supplier"
      dt.target_folder = "Purchase Orders"
      dt.scope = "job"
      dt.file_extensions = ["pdf"]
      dt.active = true
    end
  end

  def down
    DocumentType.find_by(name: "Purchase Order")&.destroy
  end
end
