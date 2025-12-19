# frozen_string_literal: true

# == Schema Information
#
# Table name: e_signature_fields
#
# A signature field placed on a specific page of a document.
# Fields are assigned to signers and must be completed during the signing ceremony.
# Position is stored as percentages (0-100) for PDF scaling independence.
#
class ESignatureField < ApplicationRecord
  # Field types that can be placed on a document
  FIELD_TYPES = %w[signature initials date text].freeze

  # Default date format for date fields
  DEFAULT_DATE_FORMAT = "%d/%m/%Y"

  # ==========================================================================
  # Associations
  # ==========================================================================

  belongs_to :e_signature_request
  belongs_to :e_signature_signer

  # ==========================================================================
  # Validations
  # ==========================================================================

  validates :field_type, presence: true, inclusion: { in: FIELD_TYPES }
  validates :page_number, presence: true, numericality: { greater_than: 0 }
  validates :x_percent, :y_percent, :width_percent, :height_percent,
            presence: true,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }

  # ==========================================================================
  # Scopes
  # ==========================================================================

  scope :for_signer, ->(signer) { where(e_signature_signer: signer) }
  scope :by_page, -> { order(:page_number, :y_percent, :x_percent) }
  scope :incomplete, -> { where(completed_at: nil) }
  scope :completed, -> { where.not(completed_at: nil) }
  scope :required, -> { where(required: true) }
  scope :signatures, -> { where(field_type: "signature") }
  scope :initials, -> { where(field_type: "initials") }
  scope :dates, -> { where(field_type: "date") }
  scope :texts, -> { where(field_type: "text") }

  # ==========================================================================
  # Instance Methods
  # ==========================================================================

  # Check if this field has been completed
  def complete?
    completed_at.present?
  end

  # Check if this field is pending completion
  def pending?
    !complete?
  end

  # Complete this field with a value
  # @param new_value [String] The value to set (signature data, text, or date)
  def complete!(new_value)
    update!(
      value: new_value,
      completed_at: Time.current
    )

    # Log the field completion event
    e_signature_request.log_event(
      event_type: "field_completed",
      actor_type: "signer",
      actor_name: e_signature_signer.name || e_signature_signer.email,
      actor_email: e_signature_signer.email,
      metadata: {
        field_id: id,
        field_type: field_type,
        page_number: page_number,
        label: label
      }
    )
  end

  # Get the effective date format for date fields
  def effective_date_format
    date_format.presence || DEFAULT_DATE_FORMAT
  end

  # Check if this is a signature-type field (signature or initials)
  def signature_type?
    %w[signature initials].include?(field_type)
  end

  # Get the value as a formatted date (for date fields)
  def formatted_date_value
    return nil unless field_type == "date" && value.present?

    Date.parse(value).strftime(effective_date_format)
  rescue ArgumentError
    value
  end

  # ==========================================================================
  # Serialization
  # ==========================================================================

  # Return field data for API responses
  def as_json(options = {})
    super(options).merge(
      "complete" => complete?,
      "signer_email" => e_signature_signer&.email,
      "signer_name" => e_signature_signer&.name
    )
  end
end
