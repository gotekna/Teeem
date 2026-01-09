class AddShareholderTypeToCompanyShareholdings < ActiveRecord::Migration[8.0]
  def change
    add_column :company_shareholdings, :shareholder_type, :string, default: 'Contact'

    # Update existing records to have the correct type
    reversible do |dir|
      dir.up do
        execute "UPDATE company_shareholdings SET shareholder_type = 'Contact' WHERE shareholder_type IS NULL"
      end
    end

    # Add index for polymorphic association
    add_index :company_shareholdings, [ :shareholder_type, :shareholder_id ], name: 'idx_shareholdings_polymorphic'
  end
end
