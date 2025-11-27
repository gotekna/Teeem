class CompanyDocument < ApplicationRecord
  # Associations
  belongs_to :company
  belongs_to :user, optional: true

  # Active Storage for file upload
  has_one_attached :file

  # Validations
  validates :document_name, presence: true
  validates :document_type, inclusion: {
    in: %w[constitution minutes loan_agreement security_deed setup share_certificate
           tax_return financial_statement insurance_policy other]
  }, allow_blank: true

  # Scopes
  scope :by_type, ->(type) { where(document_type: type) }
  scope :by_year, ->(year) { where(year: year) }
  scope :recent, -> { order(created_at: :desc) }

  # Callbacks
  after_create :create_activity

  # Instance methods
  def formatted_document_type
    document_type.to_s.titleize.gsub('_', ' ')
  end

  def file_size_mb
    return nil unless file_size.present?
    (file_size.to_f / 1024 / 1024).round(2)
  end

  def display_name
    document_name
  end

  private

  def create_activity
    company.company_activities.create!(
      activity_type: 'document_uploaded',
      description: "Document uploaded: #{document_name}",
      metadata: {
        document_type: document_type,
        file_name: file_name,
        file_size: file_size
      },
      performed_by: user || Current.user || User.first,
      occurred_at: Time.current
    )
  end
end
