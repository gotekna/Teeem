class CorporateMinute < ApplicationRecord
  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope queries to current tenant

  # Explicit table name since we renamed from corporate_company_minutes
  self.table_name = "corporate_minutes"

  # Associations
  belongs_to :tenant
  belongs_to :corporate, foreign_key: "company_id"
  belongs_to :minute_template, optional: true
  alias_method :company, :corporate

  # Validations
  validates :title, presence: true
  validates :meeting_date, presence: true
  validates :status, inclusion: { in: %w[draft approved signed filed] }

  # Scopes
  scope :drafts, -> { where(status: "draft") }
  scope :signed, -> { where(status: "signed") }
  scope :filed, -> { where(status: "filed") }
  scope :by_date, -> { order(meeting_date: :desc) }
  scope :recent, -> { by_date.limit(10) }

  # Callbacks
  after_create :create_activity

  def draft?
    status == "draft"
  end

  def signed?
    status == "signed"
  end

  def filed?
    status == "filed"
  end

  def can_sign?
    draft? || status == "approved"
  end

  def can_file?
    signed?
  end

  # Generate content from template
  def generate_from_template(values = {})
    return unless minute_template.present?

    # Default values from company
    default_values = {
      company_name: company.name,
      acn: company.formatted_acn,
      abn: company.formatted_abn,
      registered_office: company.registered_office_address,
      meeting_date: meeting_date&.strftime("%d %B %Y"),
      current_date: Date.today.strftime("%d %B %Y")
    }

    self.content = minute_template.generate_content(default_values.merge(values))
  end

  private

  def create_activity
    company.company_activities.create!(
      activity_type: "minute_created",
      description: "Minutes created: #{title}",
      related: self
    )
  end
end
