# SSoT: User-level tab preferences
# Stores per-user customizations for tab visibility, order, and default tab selection
# Works with BaseFolder to allow users to personalize their tab experience
# (Feb 2026: WarehouseFolder eliminated, BaseFolder is THE ONE for folder structure)
class UserWarehouseFolderPreference < ApplicationRecord
  # Table was renamed from user_entity_tab_preferences
  self.table_name = 'user_warehouse_folder_preferences'
  # Valid scopes (must match BaseFolder warehouse types)
  # SSoT: 'corporate' is THE ONE for corporate entities (Jan 2026 - 'corporate_entity' renamed)
  SCOPES = %w[corporate people job document contact].freeze

  # Associations
  belongs_to :user

  # Validations
  validates :scope, presence: true, inclusion: { in: SCOPES }
  validates :user_id, uniqueness: { scope: :scope, message: 'already has preferences for this scope' }

  # Scopes
  scope :for_scope, ->(s) { where(scope: s) }
  scope :for_job, -> { for_scope('job') }

  # Get or create preferences for a user and scope
  def self.for_user_scope(user, scope_name)
    find_or_create_by(user: user, scope: scope_name)
  end

  # Check if a tab is hidden
  def tab_hidden?(tab_key)
    (hidden_tabs || []).include?(tab_key.to_s)
  end

  # Hide a tab
  def hide_tab!(tab_key)
    self.hidden_tabs = ((hidden_tabs || []) + [tab_key.to_s]).uniq
    save!
  end

  # Show a tab (remove from hidden)
  def show_tab!(tab_key)
    self.hidden_tabs = (hidden_tabs || []).reject { |t| t == tab_key.to_s }
    save!
  end

  # Toggle tab visibility
  def toggle_tab!(tab_key)
    if tab_hidden?(tab_key)
      show_tab!(tab_key)
    else
      hide_tab!(tab_key)
    end
  end

  # Set default tab
  def set_default_tab!(tab_key)
    update!(default_tab: tab_key.to_s)
  end

  # Clear default tab (use system default)
  def clear_default_tab!
    update!(default_tab: nil)
  end

  # Set tab order (array of tab_keys)
  def set_tab_order!(order)
    update!(tab_order: Array(order).map(&:to_s))
  end

  # Get tab order (empty array means use system default)
  def get_tab_order
    tab_order || []
  end

  # Bulk update preferences
  def update_preferences!(hidden: nil, default: nil, order: nil)
    updates = {}
    updates[:hidden_tabs] = Array(hidden).map(&:to_s) if hidden.present? || hidden == []
    updates[:default_tab] = default.presence if default.present? || default == ''
    updates[:tab_order] = Array(order).map(&:to_s) if order.present? || order == []
    update!(updates) if updates.any?
  end
end
