class JobTab < ApplicationRecord
  has_many :user_job_tab_configs, dependent: :destroy

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :icon, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position) }

  # Get all active tabs ordered by position
  def self.default_tabs
    active.ordered
  end
end
