class AddAssetIdToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_reference :company_documents, :asset, null: true, foreign_key: true
  end
end
