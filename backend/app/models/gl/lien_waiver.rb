# frozen_string_literal: true

module Gl
  # Lien waiver tracking for construction subcontractors
  class LienWaiver < ApplicationRecord
    self.table_name = "gl_lien_waivers"

    WAIVER_TYPES = %w[conditional_partial conditional_final unconditional_partial unconditional_final].freeze
    STATUSES = %w[requested received approved rejected].freeze

    belongs_to :corporate_company
    belongs_to :job
    belongs_to :contact
    belongs_to :progress_claim, class_name: "Gl::ProgressClaim", optional: true

    validates :waiver_type, presence: true, inclusion: { in: WAIVER_TYPES }
    validates :waiver_date, presence: true
    validates :status, inclusion: { in: STATUSES }

    scope :pending, -> { where(status: %w[requested received]) }
    scope :approved, -> { where(status: "approved") }
    scope :for_job, ->(job) { where(job_id: job.id) }
    scope :for_subcontractor, ->(contact) { where(contact_id: contact.id) }

    # Request a new waiver
    def self.request!(job:, contact:, waiver_type:, through_amount: nil, through_date: nil)
      create!(
        corporate_company: job.corporate_company,
        job: job,
        contact: contact,
        waiver_type: waiver_type,
        waiver_date: Date.current,
        through_amount: through_amount,
        through_date: through_date
      )
    end

    # Mark as received
    def mark_received!(from: nil, document_id: nil)
      update!(
        status: "received",
        received_at: Time.current,
        received_from: from,
        document_file_id: document_id
      )
    end

    # Approve the waiver
    def approve!
      return false unless status == "received"

      update!(status: "approved")
    end

    # Reject the waiver
    def reject!(reason = nil)
      update!(
        status: "rejected",
        notes: [notes, "Rejected: #{reason}"].compact.join("\n")
      )
    end

    # Check if final waiver
    def final?
      waiver_type.include?("final")
    end

    # Check if conditional
    def conditional?
      waiver_type.include?("conditional")
    end
  end
end
