class RemoveShareholderForeignKeyFromCompanyShareholdings < ActiveRecord::Migration[8.0]
  def change
    # Remove the foreign key constraint since we now use polymorphic association
    # that can reference either Contact or Company
    remove_foreign_key :company_shareholdings, :contacts, column: :shareholder_id, if_exists: true
  end
end
