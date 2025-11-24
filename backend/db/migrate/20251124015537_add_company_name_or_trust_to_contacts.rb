class AddCompanyNameOrTrustToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :company_name_or_trust, :string
  end
end
