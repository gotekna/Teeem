class RenameAndAddAbnAcnToContacts < ActiveRecord::Migration[8.0]
  def change
    # Rename tax_number to abn (SSoT cleanup)
    rename_column :contacts, :tax_number, :abn

    # Add ACN column (Australian Company Number - 9 digits)
    add_column :contacts, :acn, :string, limit: 11

    # Add ACN validation fields (mirror ABN validation)
    add_column :contacts, :acn_valid, :boolean
    add_column :contacts, :acn_verified_at, :datetime

    add_index :contacts, :acn
    add_index :contacts, :acn_valid
  end
end
