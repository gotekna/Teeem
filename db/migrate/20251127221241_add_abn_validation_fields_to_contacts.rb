class AddAbnValidationFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :abn_valid, :boolean
    add_column :contacts, :abn_entity_name, :string
    add_column :contacts, :abn_entity_type, :string
    add_column :contacts, :abn_gst_registered, :boolean
    add_column :contacts, :abn_verified_at, :datetime

    add_index :contacts, :abn_valid
  end
end
