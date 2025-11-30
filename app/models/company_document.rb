class CompanyDocument < ApplicationRecord
  # Associations
  belongs_to :company
  belongs_to :user, optional: true
  belongs_to :asset, optional: true
  belongs_to :loan, class_name: 'CompanyLoan', optional: true
  belongs_to :document_type_record, class_name: 'DocumentType', foreign_key: 'document_type_id', optional: true

  # Active Storage for file upload
  has_one_attached :file

  # Storage types for Company Register tracking
  STORAGE_TYPES = %w[manual electronic both].freeze

  # Validations
  validates :title, presence: true
  validates :document_type, inclusion: {
    in: %w[constitution minutes loan_agreement security_deed setup share_certificate
           tax_return financial_statement insurance_policy asic share_registry trust_deed
           financial tax insurance contract certificate other]
  }, allow_blank: true
  validates :storage_type, inclusion: { in: STORAGE_TYPES }, allow_blank: true

  # Scopes
  scope :by_type, ->(type) { where(document_type: type) }
  scope :by_year, ->(year) { where(year: year) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :by_tab, ->(tab) {
    joins("LEFT JOIN document_types ON document_types.name = company_documents.document_type")
      .where("document_types.tabs @> ?", [tab].to_json)
  }
  scope :by_source, ->(source) { where(source: source) }
  scope :by_asset, ->(asset_id) { where(asset_id: asset_id) }
  scope :with_asset, -> { where.not(asset_id: nil) }
  scope :without_asset, -> { where(asset_id: nil) }
  scope :electronic, -> { where(storage_type: 'electronic') }
  scope :manual, -> { where(storage_type: 'manual') }
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
    title
  end

  private

  def create_activity
    performer = user || (defined?(Current) && Current.respond_to?(:user) ? Current.user : nil) || User.first
    company.company_activities.create!(
      activity_type: 'document_uploaded',
      description: "Document uploaded: #{title}",
      change_details: {
        document_type: document_type,
        file_name: file_name,
        file_size: file_size
      },
      user: performer
    )
  end
end
