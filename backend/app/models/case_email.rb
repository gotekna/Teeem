# CaseEmail - links emails from warehouse to cases
class CaseEmail < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id, class_name: "CaseRecord"
  # SSoT: Legacy column is email_warehouse_id, but actual model is SyncedEmail
  belongs_to :email_warehouse, class_name: "SyncedEmail"
  belongs_to :added_by, class_name: "User", optional: true

  # Alias for legacy column name (EmailWarehouse was renamed to SyncedEmail)
  alias_attribute :synced_email_id, :email_warehouse_id
  # Use alias_method for associations (alias_attribute only works for columns in Rails 8)
  alias_method :synced_email, :email_warehouse
  alias_method :synced_email=, :email_warehouse=

  has_many :case_email_qas, dependent: :destroy

  validates :case_id, uniqueness: { scope: :email_warehouse_id }
  validates :relevance, inclusion: {
    in: %w[key_evidence supporting background reference],
    allow_blank: true
  }

  scope :key_evidence, -> { where(relevance: "key_evidence") }
  scope :by_relevance, -> { order(Arel.sql("CASE relevance WHEN 'key_evidence' THEN 1 WHEN 'supporting' THEN 2 WHEN 'background' THEN 3 ELSE 4 END")) }
  scope :by_sequence, -> { order(:sequence) }
  scope :by_date, -> { joins(:email_warehouse).order("email_warehouse.received_at DESC") }
  scope :with_unanswered_questions, -> { where(has_unanswered_questions: true) }

  # Callbacks
  before_create :generate_short_code, if: -> { short_code.blank? }
  before_create :set_display_name, if: -> { display_name.blank? }

  RELEVANCE_TYPES = {
    "key_evidence" => "Key Evidence",
    "supporting" => "Supporting",
    "background" => "Background",
    "reference" => "Reference"
  }.freeze

  def formatted_relevance
    RELEVANCE_TYPES[relevance] || relevance&.titleize
  end

  # Update unanswered questions flag based on QA entries
  def update_unanswered_flag!
    has_unanswered = case_email_qas.unanswered.exists?
    update_column(:has_unanswered_questions, has_unanswered) if has_unanswered_questions != has_unanswered
  end

  private

  def generate_short_code
    max_sequence = case_record.case_emails.where.not(short_code: nil)
                              .pluck(:short_code)
                              .map { |code| code.to_s.split("-").last.to_i }
                              .max || 0
    self.short_code = "EMAIL-#{(max_sequence + 1).to_s.rjust(3, '0')}"
  end

  def set_display_name
    return unless email_warehouse

    # Create a user-friendly display name from subject
    subject = email_warehouse.subject || "No Subject"
    # Truncate if too long
    self.display_name = subject.truncate(100)
  end
end
