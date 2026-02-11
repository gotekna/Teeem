# frozen_string_literal: true

# Add date_of_birth column to contacts table.
#
# DOB is required for ASIC director change forms (Form 484).
# Previously DOB only existed on director_onboarding_requests,
# not on the contact record itself.
class AddDateOfBirthToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :date_of_birth, :date
  end
end
