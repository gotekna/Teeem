class AddTrustAccountFieldsToSuppliers < ActiveRecord::Migration[8.0]
  def change
    # Trust account fields for lawyers, accountants, real estate agents, etc.
    # who hold funds in trust on behalf of clients
    # Note: Suppliers are stored in the contacts table
    add_column :contacts, :has_trust_account, :boolean, default: false, null: false
    add_column :contacts, :trust_bsb, :string
    add_column :contacts, :trust_account_number, :string
    add_column :contacts, :trust_account_name, :string

    # Payment terms: "7 days", "Net 30", "EOM+30", "Due on receipt", etc.
    add_column :contacts, :payment_terms, :string
  end
end
