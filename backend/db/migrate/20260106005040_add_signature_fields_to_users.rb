class AddSignatureFieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :qbcc_licence_number, :string
    add_column :users, :qbcc_licence_class, :string
  end
end
