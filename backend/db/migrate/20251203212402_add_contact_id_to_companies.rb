class AddContactIdToCompanies < ActiveRecord::Migration[8.0]
  def change
    # Add as optional initially - will be populated by data migration
    add_reference :companies, :contact, null: true, foreign_key: true
  end
end
