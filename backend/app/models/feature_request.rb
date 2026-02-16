# NOTE: Deliberately NOT using acts_as_tenant - shared across all tenants
# This is a public product roadmap visible to all authenticated users
class FeatureRequest < ApplicationRecord
  CATEGORIES = %w[feature improvement bug_report suggestion].freeze
  STATUSES = %w[submitted planned in_progress completed declined].freeze

  validates :title, presence: true
  validates :category, inclusion: { in: CATEGORIES }
  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where.not(status: "declined") }
  scope :by_status, ->(s) { where(status: s) }
  scope :ordered, -> {
    order(
      Arel.sql(
        "CASE status " \
        "WHEN 'in_progress' THEN 1 " \
        "WHEN 'planned' THEN 2 " \
        "WHEN 'submitted' THEN 3 " \
        "WHEN 'completed' THEN 4 " \
        "WHEN 'declined' THEN 5 " \
        "END"
      ),
      Arel.sql("priority_order ASC NULLS LAST"),
      created_at: :desc
    )
  }

  def followed_by?(user_id)
    follower_user_ids.include?(user_id)
  end

  def add_follower(user_id)
    return if followed_by?(user_id)
    self.follower_user_ids = follower_user_ids + [user_id]
    self.follower_count = follower_user_ids.size
    save!
  end

  def remove_follower(user_id)
    self.follower_user_ids = follower_user_ids - [user_id]
    self.follower_count = follower_user_ids.size
    save!
  end
end
