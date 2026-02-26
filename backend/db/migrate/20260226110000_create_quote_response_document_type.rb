# frozen_string_literal: true

# Creates a "Quote Response" document type for each tenant, linked to the
# existing "Quote Returns" warehouse folder. This classifies PDFs uploaded
# when recording a supplier's quote response.
class CreateQuoteResponseDocumentType < ActiveRecord::Migration[8.0]
  def up
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        # Skip if already exists
        next if DocumentType.find_by(name: "Quote Response", scope: "job")

        # Find the "Quote Returns" warehouse folder for this tenant
        quote_returns_folder = WarehouseFolder
          .joins(:warehouse_type)
          .where(warehouse_types: { code: "job" })
          .find_by(display_name: "Quote Returns")

        dt = DocumentType.create!(
          name: "Quote Response",
          scope: "job",
          active: true,
          download_name: "{JobCode} Quote Response - {Description} {Date}",
          description: "Supplier quote response PDF received via Custom Quotes",
          aliases: ["Supplier Quote Response", "Quote Return PDF"]
        )

        # Link to Quote Returns folder if it exists
        if quote_returns_folder
          dt.warehouse_folder_ids = [quote_returns_folder.id]
        end
      end
    end
  end

  def down
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        DocumentType.find_by(name: "Quote Response", scope: "job")&.destroy
      end
    end
  end
end
