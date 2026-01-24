# frozen_string_literal: true

class UserRole < ApplicationRecord
  belongs_to :user
  belongs_to :role

  validates :user_id, uniqueness: { scope: :role_id, message: "already has this role" }

  # =============================================================================
  # Primary Role Support
  # SSoT: Only one role per user can be marked as primary
  # The primary role determines default settings for users with multiple roles
  # =============================================================================

  scope :primary, -> { where(is_primary: true) }

  # Callback to ensure only one primary role per user
  before_save :ensure_single_primary, if: :will_save_change_to_is_primary?
  after_create :auto_set_primary_if_only_role
  after_destroy :reassign_primary_if_needed

  # Set this role as primary for the user
  def set_as_primary!
    return if is_primary?

    transaction do
      # Clear any existing primary role for this user
      UserRole.where(user_id: user_id, is_primary: true).update_all(is_primary: false)
      update!(is_primary: true)
    end
  end

  private

  # Ensure only one primary role per user
  def ensure_single_primary
    return unless is_primary?

    # Clear other primary roles for this user
    UserRole.where(user_id: user_id, is_primary: true)
            .where.not(id: id)
            .update_all(is_primary: false)
  end

  # Auto-set as primary if this is the user's only role
  def auto_set_primary_if_only_role
    return if is_primary?

    # If this is the only role for the user, make it primary
    if UserRole.where(user_id: user_id).count == 1
      update_column(:is_primary, true)
    end
  end

  # If the primary role is deleted, assign primary to another role
  def reassign_primary_if_needed
    return unless is_primary?

    # Find another role for this user and make it primary
    other_role = UserRole.where(user_id: user_id).first
    other_role&.update_column(:is_primary, true)
  end
end
