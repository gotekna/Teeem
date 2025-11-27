class AddUserIdToJobContacts < ActiveRecord::Migration[8.0]
  def change
    add_reference :job_contacts, :user, null: true, foreign_key: true
    # Make contact_id nullable since internal team uses user_id instead
    change_column_null :job_contacts, :contact_id, true
  end
end
