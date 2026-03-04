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
      created_at.strftime("%d %b %Y %l:%M %p")
    end
  end

  def icon_name
    case activity_type
    when "company_created" then "plus-circle"
    when "company_updated" then "pencil"
    when "director_appointed" then "user-plus"
    when "director_resigned" then "user-minus"
    when /bank_account_added/ then "landmark"
    when /bank_account_closed/ then "landmark"
    when "minute_created" then "document-text"
    when /xero/ then "arrow-path-rounded-square"
    when /asset/ then "package"
    else "information-circle"
    end
  end

  def icon_color
    case activity_type
    when "company_created", "xero_connected" then "green"
    when "company_updated" then "blue"
    when "director_appointed" then "indigo"
    when "director_resigned", "bank_account_closed", "xero_disconnected" then "red"
    when "bank_account_added" then "purple"
    when "minute_created" then "cyan"
    when /bank_accounts_synced/, /xero.*synced/ then "sky"
    when /asset/ then "orange"
    else "gray"
    end
  end
end
