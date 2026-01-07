# frozen_string_literal: true

# NotebookShare - Sharing permissions for notebooks
#
# Features:
# - Permission levels: view, edit, admin
# - Optional expiration
# - Tracks who granted the share
#
class NotebookShare < ApplicationRecord
  # Associations
  belongs_to :notebook
  belongs_to :user
  belongs_to :granted_by, class_name: "User", optional: true

  # Validations
  validates :permission, presence: true, inclusion: { in: Notebook::PERMISSIONS }
  validates :user_id, uniqueness: { scope: :notebook_id, message: "already has access to this notebook" }

  # Scopes
  scope :active, -> { where("expires_at IS NULL OR expires_at > ?", Time.current) }
  scope :expired, -> { where("expires_at IS NOT NULL AND expires_at <= ?", Time.current) }
  scope :with_permission, ->(perm) { where(permission: perm) }

  # Check if share is expired
  def expired?
    expires_at.present? && expires_at <= Time.current
  end

  # Check if share is active
  def active?
    !expired?
  end

  # Permission level checks
  def can_view?
    active? && %w[view edit admin].include?(permission)
  end

  def can_edit?
    active? && %w[edit admin].include?(permission)
  end

  def can_admin?
    active? && permission == "admin"
  end
end
