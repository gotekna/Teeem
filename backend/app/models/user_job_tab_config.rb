class UserJobTabConfig < ApplicationRecord
  belongs_to :user
  belongs_to :job_tab
  belongs_to :parent_job_tab, class_name: "JobTab", optional: true

  validates :user_id, uniqueness: { scope: :job_tab_id }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :no_circular_parent

  scope :ordered, -> { order(:position) }
  scope :visible, -> { where(is_hidden: false) }
  scope :top_level, -> { where(parent_job_tab_id: nil) }
  scope :children_of, ->(parent_id) { where(parent_job_tab_id: parent_id) }

  # Initialize config for a user from system defaults
  def self.initialize_for_user(user)
    return if user.user_job_tab_configs.exists?

    JobTab.default_tabs.each_with_index do |tab, index|
      create!(
        user: user,
        job_tab: tab,
        position: index,
        parent_job_tab_id: nil,
        is_hidden: false
      )
    end
  end

  # Reset user's config back to system defaults
  def self.reset_for_user(user)
    user.user_job_tab_configs.destroy_all
    initialize_for_user(user)
  end

  # Sync user config when new system tabs are added
  def self.sync_new_tabs_for_user(user)
    existing_tab_ids = user.user_job_tab_configs.pluck(:job_tab_id)
    new_tabs = JobTab.active.where.not(id: existing_tab_ids).ordered

    return if new_tabs.empty?

    max_position = user.user_job_tab_configs.maximum(:position) || -1

    new_tabs.each_with_index do |tab, index|
      create!(
        user: user,
        job_tab: tab,
        position: max_position + 1 + index,
        parent_job_tab_id: nil,
        is_hidden: false
      )
    end
  end

  # Get user's tab config as hierarchical structure
  def self.hierarchical_for_user(user)
    configs = user.user_job_tab_configs.includes(:job_tab).ordered

    # Separate top-level and children
    top_level = configs.select { |c| c.parent_job_tab_id.nil? && c.job_tab.is_active }
    children_by_parent = configs
      .select { |c| c.parent_job_tab_id.present? && c.job_tab.is_active }
      .group_by(&:parent_job_tab_id)

    top_level.map do |config|
      children = (children_by_parent[config.job_tab_id] || []).sort_by(&:position)
      {
        id: config.job_tab_id,
        name: config.job_tab.name,
        slug: config.job_tab.slug,
        icon: config.job_tab.icon,
        position: config.position,
        is_hidden: config.is_hidden,
        has_children: children.any?,
        children: children.map do |child_config|
          {
            id: child_config.job_tab_id,
            name: child_config.job_tab.name,
            slug: child_config.job_tab.slug,
            icon: child_config.job_tab.icon,
            position: child_config.position,
            is_hidden: child_config.is_hidden
          }
        end
      }
    end
  end

  private

  def no_circular_parent
    return unless parent_job_tab_id.present?

    if parent_job_tab_id == job_tab_id
      errors.add(:parent_job_tab_id, "cannot be itself")
    end
  end
end
