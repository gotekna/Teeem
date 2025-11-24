class AddPrimaryCompanyToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :primary_company_id, :bigint
    add_column :contacts, :primary_role, :string
    add_column :contacts, :employment_status, :string
    add_column :contacts, :employment_start_date, :date

    add_index :contacts, :primary_company_id
    add_foreign_key :contacts, :contacts, column: :primary_company_id
  end
end
