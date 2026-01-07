# frozen_string_literal: true

# SignatureUsage - Digital Signature Register
#
# Tracks every use of a user's digital signature for audit and compliance.
# This is the SSoT for signature usage history.
#
# Usage:
#   SignatureUsage.record!(
#     user: supervisor,
#     certificate_type: "form_43",
#     document_name: "J046 SWI Form43 06-01-2026.pdf",
#     purpose: "Form 43 Aspect Certificate - Stormwater Insulation",
#     document_type: document_type,
#     job: job,
#     job_document: job_document
#   )
#
class SignatureUsage < ApplicationRecord
  # Associations
  belongs_to :user
  belongs_to :document_type, optional: true
  belongs_to :job, optional: true
  belongs_to :job_document, optional: true

  # Validations
  validates :signed_at, presence: true
  validates :certificate_type, presence: true
  validates :document_name, presence: true

  # Scopes
  scope :recent, -> { order(signed_at: :desc) }
  scope :for_user, ->(user_id) { where(user_id: user_id) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :by_certificate_type, ->(type) { where(certificate_type: type) }
  scope :in_date_range, ->(start_date, end_date) { where(signed_at: start_date..end_date) }

  # Class method to record a signature usage with defaults
  def self.record!(user:, certificate_type:, document_name:, purpose: nil, **options)
    create!(
      user: user,
      certificate_type: certificate_type,
      document_name: document_name,
      purpose: purpose || "Digital signature applied to #{certificate_type}",
      signed_at: Time.current,
      **options
    )
  end

  # Display helpers
  def certificate_type_display
    case certificate_type
    when "form_43"
      "Form 43 - Aspect Certificate"
    when "contract"
      "Contract"
    when "variation"
      "Variation Order"
    else
      certificate_type&.titleize || "Unknown"
    end
  end

  def signed_at_formatted
    signed_at&.strftime("%d/%m/%Y %H:%M")
  end

  def job_reference
    job&.job_code || job&.name || "N/A"
  end
end
