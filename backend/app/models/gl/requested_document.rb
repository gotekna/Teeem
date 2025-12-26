# frozen_string_literal: true

module Gl
  # Individual document in a request
  class RequestedDocument < ApplicationRecord
    self.table_name = "gl_requested_documents"

    DOCUMENT_TYPES = %w[
      tax_return bank_statement income_statement payslip
      invoice receipt contract id_document certificate
      financial_report audit_report other
    ].freeze

    STATUSES = %w[pending uploaded approved rejected].freeze

    belongs_to :document_request, class_name: "Gl::DocumentRequest"
    belongs_to :uploaded_file, class_name: "DocumentFile", optional: true
    belongs_to :reviewed_by, class_name: "User", optional: true

    validates :document_type, presence: true, inclusion: { in: DOCUMENT_TYPES }
    validates :name, presence: true
    validates :status, inclusion: { in: STATUSES }

    scope :pending, -> { where(status: "pending") }
    scope :uploaded, -> { where(status: "uploaded") }
    scope :approved, -> { where(status: "approved") }
    scope :rejected, -> { where(status: "rejected") }
    scope :required, -> { where(required: true) }

    # Upload file
    def upload!(file)
      # Would create DocumentFile here
      update!(
        status: "uploaded",
        uploaded_at: Time.current
      )
    end

    # Approve document
    def approve!(reviewer)
      update!(
        status: "approved",
        reviewed_by: reviewer,
        reviewed_at: Time.current
      )
    end

    # Reject document
    def reject!(reviewer, reason:)
      update!(
        status: "rejected",
        reviewed_by: reviewer,
        reviewed_at: Time.current,
        rejection_reason: reason
      )
    end

    # Human-readable type
    def type_label
      document_type.titleize
    end
  end
end
