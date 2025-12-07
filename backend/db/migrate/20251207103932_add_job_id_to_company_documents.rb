class AddJobIdToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :job_id, :integer
    add_index :company_documents, :job_id
  end
end
