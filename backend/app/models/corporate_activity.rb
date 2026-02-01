class CorporateActivity < ApplicationRecord
  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope queries to current tenant

  # Explicit table name since we renamed from corporate_company_activities
  self.table_name = "corporate_activities"

  # Associations
  belongs_to :tenant
  belongs_to :corporate, foreign_key: "company_id"
  belongs_to :user, optional: true
  alias_method :performed_by, :user

  # Validations
  validates :activity_type, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(activity_type: type) }
  scope :since, ->(date) { where("created_at >= ?", date) }
  scope :between, ->(start_date, end_date) { where(created_at: start_date..end_date) }

  # Instance methods
  def formatted_activity_type
    activity_type.to_s.titleize.gsub("_", " ")
  end

  def performed_by_name
    case performed_by
    when User
      performed_by.name || performed_by.email
    else
      "System"
    end
  end

  def time_ago
    distance = Time.current - created_at

    case distance
    when 0..59
      "#{distance.to_i} seconds ago"
    when 60..3599
      "#{(distance / 60).to_i} minutes ago"
    when 3600..86399
      "#{(distance / 3600).to_i} hours ago"
    when 86400..2591999
      "#{(distance / 86400).to_i} days ago"
    else
      created_at.strftime("%d %b %Y")
    end
  end
end

# Backwards compatibility alias (deprecated - use CorporateActivity directly)
CorporateCompanyActivity = CorporateActivity
