class CompanyActivity < ApplicationRecord
  # Associations
  belongs_to :company
  belongs_to :performed_by, polymorphic: true

  # Validations
  validates :activity_type, presence: true
  validates :occurred_at, presence: true

  # Scopes
  scope :recent, -> { order(occurred_at: :desc) }
  scope :by_type, ->(type) { where(activity_type: type) }
  scope :since, ->(date) { where('occurred_at >= ?', date) }
  scope :between, ->(start_date, end_date) { where(occurred_at: start_date..end_date) }

  # Instance methods
  def formatted_activity_type
    activity_type.to_s.titleize.gsub('_', ' ')
  end

  def performed_by_name
    case performed_by
    when User
      performed_by.name || performed_by.email
    else
      'System'
    end
  end

  def time_ago
    distance = Time.current - occurred_at

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
      occurred_at.strftime('%d %b %Y')
    end
  end
end
