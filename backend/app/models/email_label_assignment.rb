# frozen_string_literal: true

# Join table between EmailLabel and SyncedEmail
# Allows multiple labels per email (Gmail-style)
#
class EmailLabelAssignment < ApplicationRecord
  belongs_to :email_warehouse
  belongs_to :email_label

  # Validations
  validates :synced_email_id, uniqueness: { scope: :email_label_id }

  # Callbacks to update cached counts
  after_create :increment_label_count
  after_destroy :decrement_label_count

  private

  def increment_label_count
    email_label.increment!(:email_count)
  end

  def decrement_label_count
    email_label.decrement!(:email_count)
  end
end
