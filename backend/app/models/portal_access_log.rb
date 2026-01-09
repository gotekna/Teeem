class PortalAccessLog < ApplicationRecord
  # Associations
  belongs_to :portal_user

  # Validations
  validates :portal_user_id, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_portal_user, ->(user_id) { where(portal_user_id: user_id) }
  scope :by_action, ->(action) { where(action: action) }
  scope :logins, -> { where(action: "login") }
  scope :logouts, -> { where(action: "logout") }
  scope :today, -> { where("created_at >= ?", Time.current.beginning_of_day) }
  scope :last_week, -> { where("created_at >= ?", 1.week.ago) }
  scope :last_month, -> { where("created_at >= ?", 1.month.ago) }

  # Class methods
  def self.log_activity(portal_user, action, metadata = {}, request: nil)
    create!(
      portal_user: portal_user,
      action: action,
      ip_address: request&.remote_ip,
      user_agent: request&.user_agent,
      metadata: metadata
    )
  rescue => e
    Rails.logger.error("Failed to log portal activity: #{e.message}")
  end

  def self.activity_summary(portal_user_id)
    logs = by_portal_user(portal_user_id)
    {
      total_logins: logs.logins.count,
      last_login: logs.logins.order(created_at: :desc).first&.created_at,
      total_activities: logs.count,
      recent_activities: logs.recent.limit(10).pluck(:action, :created_at)
    }
  end

  # Instance methods
  def formatted_created_at
    created_at.strftime("%Y-%m-%d %H:%M:%S")
  end

  def action_description
    case action
    when "login" then "Logged in"
    when "logout" then "Logged out"
    when "view_po" then "Viewed purchase order"
    when "view_payment" then "Viewed payment"
    when "view_maintenance" then "Viewed maintenance request"
    when "update_maintenance" then "Updated maintenance request"
    when "download_document" then "Downloaded document"
    when "view_gantt" then "Viewed Gantt chart"
    when "view_rating" then "Viewed ratings"
    when "view_dashboard" then "Viewed dashboard"
    else action&.humanize
    end
  end
end
