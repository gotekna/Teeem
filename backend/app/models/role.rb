# frozen_string_literal: true

class Role < ApplicationRecord
  # Associations
  has_many :user_roles, dependent: :destroy
  has_many :users, through: :user_roles

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :display_name, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than: 0 }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position) }
  scope :with_god_view, -> { where(god_view_access: true) }
  scope :with_payment_approval, -> { where(can_approve_payments: true) }

  # =============================================================================
  # Settings JSONB Accessors
  # SSoT: Role settings stored as JSONB, accessed via these methods
  # Available settings:
  #   - default_task_view: 'list' | 'board' | 'gantt' (default: 'board')
  #   - default_theme: 'light' | 'dark' | 'system' (default: 'system')
  #   - sidebar_collapsed: boolean (default: false)
  # =============================================================================

  VALID_TASK_VIEWS = %w[list board gantt].freeze
  VALID_THEMES = %w[light dark system].freeze

  # Get the default task view for this role
  def default_task_view
    settings&.dig("default_task_view") || "board"
  end

  # Set the default task view for this role
  def default_task_view=(value)
    value = value.to_s.downcase
    return unless VALID_TASK_VIEWS.include?(value)

    self.settings = (settings || {}).merge("default_task_view" => value)
  end

  # Get the default theme for this role
  def default_theme
    settings&.dig("default_theme") || "system"
  end

  # Set the default theme for this role
  def default_theme=(value)
    value = value.to_s.downcase
    return unless VALID_THEMES.include?(value)

    self.settings = (settings || {}).merge("default_theme" => value)
  end

  # Get whether sidebar should be collapsed by default
  def sidebar_collapsed?
    settings&.dig("sidebar_collapsed") == true
  end

  # Set whether sidebar should be collapsed by default
  def sidebar_collapsed=(value)
    self.settings = (settings || {}).merge("sidebar_collapsed" => !!value)
  end

  # Update multiple settings at once
  def update_settings(new_settings)
    current = settings || {}

    # Only update valid settings
    if new_settings.key?("default_task_view") || new_settings.key?(:default_task_view)
      view = (new_settings["default_task_view"] || new_settings[:default_task_view]).to_s.downcase
      current["default_task_view"] = view if VALID_TASK_VIEWS.include?(view)
    end

    if new_settings.key?("default_theme") || new_settings.key?(:default_theme)
      theme = (new_settings["default_theme"] || new_settings[:default_theme]).to_s.downcase
      current["default_theme"] = theme if VALID_THEMES.include?(theme)
    end

    if new_settings.key?("sidebar_collapsed") || new_settings.key?(:sidebar_collapsed)
      collapsed = new_settings["sidebar_collapsed"] || new_settings[:sidebar_collapsed]
      current["sidebar_collapsed"] = !!collapsed
    end

    self.settings = current
  end

  # Class methods
  def self.for_select
    active.ordered.pluck(:id, :name, :display_name).map { |id, name, display| { id: id, value: name, label: display } }
  end
end
