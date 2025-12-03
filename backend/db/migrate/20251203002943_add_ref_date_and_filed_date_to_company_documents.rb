class AddRefDateAndFiledDateToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :ref_date, :date
    add_column :company_documents, :filed_date, :date
  end
end
