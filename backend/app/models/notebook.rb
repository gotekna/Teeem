# frozen_string_literal: true

# Notebook - Core container for organized notes
#
# Features:
# - Polymorphic attachment to any entity (Job, Contact, etc.) via notable
# - Global notebooks when notable is nil
# - Owner-based permissions with sharing
# - Soft delete via archived_at
#
class Notebook < ApplicationRecord
  # Associations
  belongs_to :owner, class_name: "User"
  belongs_to :notable, polymorphic: true, optional: true

  has_many :sections, class_name: "NotebookSection", dependent: :destroy
  has_many :pages, through: :sections
  has_many :shares, class_name: "NotebookShare", dependent: :destroy
  has_many :shared_users, through: :shares, source: :user
  has_many :activities, class_name: "NotebookActivity", dependent: :destroy

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :description, length: { maximum: 2000 }, allow_blank: true

  # Scopes
  scope :active, -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :global, -> { where(notable_type: nil) }
  scope :for_entity, ->(entity) { where(notable_type: entity.class.name, notable_id: entity.id) }
  scope :owned_by, ->(user) { where(owner: user) }
  scope :recent, -> { order(updated_at: :desc) }

  # Accessible notebooks for a user (owned + shared + entity-based)
  # Note: Can't use .or() because owned and shared have different joins (Rails 8 compatibility)
  scope :accessible_by, ->(user) {
    owned_ids = where(owner: user).pluck(:id)
    shared_ids = joins(:shares).where(notebook_shares: { user_id: user.id }).pluck(:id)
    where(id: (owned_ids + shared_ids).uniq)
  }

  # Callbacks
  after_create :create_default_section

  # Permission levels
  PERMISSIONS = %w[view edit admin].freeze

  # Check if user can access this notebook
  def accessible_by?(user)
    return true if owner_id == user.id
    shares.active.exists?(user_id: user.id)
  end

  # Check permission level for user
  def permission_for(user)
    return "admin" if owner_id == user.id
    share = shares.active.find_by(user_id: user.id)
    share&.permission
  end

  # Check if user can edit
  def editable_by?(user)
    permission = permission_for(user)
    %w[edit admin].include?(permission)
  end

  # Check if user is admin (owner or shared admin)
  def admin?(user)
    permission_for(user) == "admin"
  end

  # Soft delete
  def archive!
    update!(archived_at: Time.current)
  end

  def restore!
    update!(archived_at: nil)
  end

  def archived?
    archived_at.present?
  end

  # Page count
  def page_count
    pages.active.count
  end

  # Section count
  def section_count
    sections.active.count
  end

  # Last activity
  def last_activity_at
    [updated_at, pages.maximum(:updated_at)].compact.max
  end

  private

  def create_default_section
    sections.create!(name: "General", position: 0)
  end
end
