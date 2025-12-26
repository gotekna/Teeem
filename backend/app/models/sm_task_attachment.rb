class SmTaskAttachment < ApplicationRecord
  # Associations
  belongs_to :sm_task
  belongs_to :attachable, polymorphic: true
  belongs_to :added_by, class_name: "User", optional: true

  # Attachment types
  ATTACHMENT_TYPES = %w[email document upload].freeze

  # Validations
  validates :attachable_type, inclusion: {
    in: %w[EmailWarehouse CorporateCompanyDocument]
  }
  validates :attachment_type, inclusion: { in: ATTACHMENT_TYPES }, allow_blank: true

  # Scopes
  scope :emails, -> { where(attachable_type: "EmailWarehouse") }
  scope :documents, -> { where(attachable_type: "CorporateCompanyDocument") }
  scope :recent, -> { order(created_at: :desc) }
end
