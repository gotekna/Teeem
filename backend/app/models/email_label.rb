# frozen_string_literal: true

# SSoT: Email Labels System
# Gmail-style labels that can be assigned to multiple emails.
# Each user has their own set of labels.
#
class EmailLabel < ApplicationRecord
  belongs_to :user
  has_many :email_label_assignments, dependent: :destroy
  has_many :emails, through: :email_label_assignments, source: :email_warehouse

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: :user_id, case_sensitive: false }
  validates :color, format: { with: /\A#[0-9A-Fa-f]{6}\z/, message: "must be a valid hex color" }, allow_blank: true

  # Scopes
  scope :ordered, -> { order(position: :asc, name: :asc) }
  scope :system_labels, -> { where(is_system: true) }
  scope :user_labels, -> { where(is_system: false) }

  # Default label colors (Tailwind palette)
  COLORS = {
    red: "#EF4444",
    orange: "#F97316",
    amber: "#F59E0B",
    yellow: "#EAB308",
    lime: "#84CC16",
    green: "#22C55E",
    emerald: "#10B981",
    teal: "#14B8A6",
    cyan: "#06B6D4",
    sky: "#0EA5E9",
    blue: "#3B82F6",
    indigo: "#6366F1",
    violet: "#8B5CF6",
    purple: "#A855F7",
    fuchsia: "#D946EF",
    pink: "#EC4899",
    rose: "#F43F5E",
    gray: "#6B7280"
  }.freeze

  # System labels that are created for every user
  SYSTEM_LABELS = [
    { name: "Starred", color: COLORS[:amber], is_system: true },
    { name: "Important", color: COLORS[:red], is_system: true }
  ].freeze

  # Create default system labels for a new user
  def self.create_system_labels_for(user)
    SYSTEM_LABELS.each do |label_attrs|
      user.email_labels.find_or_create_by!(name: label_attrs[:name]) do |label|
        label.color = label_attrs[:color]
        label.is_system = label_attrs[:is_system]
      end
    end
  end

  # Assign this label to an email
  def assign_to(email)
    email_label_assignments.find_or_create_by!(email_warehouse: email)
    update_email_count!
  end

  # Remove this label from an email
  def remove_from(email)
    assignment = email_label_assignments.find_by(email_warehouse: email)
    if assignment
      assignment.destroy
      update_email_count!
    end
  end

  # Toggle label on/off for an email
  def toggle_for(email)
    assignment = email_label_assignments.find_by(email_warehouse: email)
    if assignment
      assignment.destroy
      update_email_count!
      false
    else
      email_label_assignments.create!(email_warehouse: email)
      update_email_count!
      true
    end
  end

  # Update cached email count
  def update_email_count!
    update_column(:email_count, email_label_assignments.count)
  end

  # JSON representation
  def as_json(options = {})
    {
      id: id,
      name: name,
      color: color,
      is_system: is_system,
      position: position,
      email_count: email_count
    }
  end
end
