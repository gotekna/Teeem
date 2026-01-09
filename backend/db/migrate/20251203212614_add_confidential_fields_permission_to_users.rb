class AddConfidentialFieldsPermissionToUsers < ActiveRecord::Migration[8.0]
  def change
    # Admins and product owners get access by default
    add_column :users, :can_view_confidential_fields, :boolean, default: false, null: false
  end
end
