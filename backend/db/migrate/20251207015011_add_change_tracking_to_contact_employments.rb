class AddChangeTrackingToContactEmployments < ActiveRecord::Migration[8.0]
  def change
    # Track previous values when email/phone changes
    add_column :contact_employments, :previous_work_email, :string
    add_column :contact_employments, :previous_work_phone, :string
    add_column :contact_employments, :email_changed_at, :datetime
    add_column :contact_employments, :phone_changed_at, :datetime

    # Track when role changes
    add_column :contact_employments, :previous_role, :string
    add_column :contact_employments, :role_changed_at, :datetime

    # General change tracking
    add_column :contact_employments, :last_modified_by_id, :integer  # User who made the change
    add_column :contact_employments, :change_notes, :text  # Freeform notes about changes

    # Add index for finding recent changes
    add_index :contact_employments, :email_changed_at
    add_index :contact_employments, :role_changed_at
  end
end
