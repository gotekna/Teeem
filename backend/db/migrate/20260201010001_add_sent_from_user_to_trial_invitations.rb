# frozen_string_literal: true

class AddSentFromUserToTrialInvitations < ActiveRecord::Migration[8.0]
  def change
    # Who the invitation email should appear to come FROM (for personalization)
    # Defaults to the invited_by user if not specified
    add_column :trial_invitations, :sent_from_user_id, :bigint
    add_index :trial_invitations, :sent_from_user_id

    add_foreign_key :trial_invitations, :users, column: :sent_from_user_id, on_delete: :nullify
  end
end
