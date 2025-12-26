# frozen_string_literal: true

module Gl
  # Request for documents from a client
  class DocumentRequest < ApplicationRecord
    self.table_name = "gl_document_requests"

    STATUSES = %w[pending sent partially_received completed expired].freeze

    belongs_to :corporate_company
    belongs_to :contact
    belongs_to :job, optional: true
    belongs_to :created_by, class_name: "User", optional: true

    has_many :requested_documents, class_name: "Gl::RequestedDocument",
                                   foreign_key: :document_request_id, dependent: :destroy

    validates :title, presence: true
    validates :status, inclusion: { in: STATUSES }

    before_create :generate_access_token

    scope :pending, -> { where(status: %w[pending sent partially_received]) }
    scope :completed, -> { where(status: "completed") }
    scope :expired, -> { where(status: "expired") }
    scope :recent, -> { order(created_at: :desc) }
    scope :overdue, -> { pending.where("due_date < ?", Date.current) }

    # Send request to client
    def send_request!
      return false if status == "sent"

      # Would send email here
      update!(status: "sent", sent_at: Time.current)
      true
    end

    # Generate portal URL
    def portal_url
      return nil unless access_token
      "#{ENV.fetch('FRONTEND_URL', 'https://app.teeem.com')}/document-upload/#{access_token}"
    end

    # Check completion
    def check_completion!
      required_docs = requested_documents.where(required: true)
      uploaded_docs = required_docs.where(status: "uploaded")

      if uploaded_docs.count == required_docs.count && required_docs.any?
        update!(status: "completed", completed_at: Time.current)
      elsif uploaded_docs.any?
        update!(status: "partially_received")
      end
    end

    # Send reminder
    def send_reminder!
      return false unless status.in?(%w[sent partially_received])
      return false if last_reminder_at && last_reminder_at > 24.hours.ago

      # Would send reminder email here
      update!(
        reminder_count: reminder_count + 1,
        last_reminder_at: Time.current
      )
      true
    end

    # Mark as expired
    def expire!
      return false unless due_date && due_date < Date.current
      update!(status: "expired")
      true
    end

    # Upload document (from portal)
    def upload_document!(document_id, file)
      doc = requested_documents.find(document_id)
      doc.upload!(file)
      check_completion!
    end

    # Summary stats
    def summary
      {
        total_documents: requested_documents.count,
        required: requested_documents.where(required: true).count,
        uploaded: requested_documents.where(status: "uploaded").count,
        approved: requested_documents.where(status: "approved").count,
        rejected: requested_documents.where(status: "rejected").count,
        pending: requested_documents.where(status: "pending").count
      }
    end

    # Create common request
    def self.create_tax_return_request!(company, contact:, year:, user:)
      request = create!(
        corporate_company: company,
        contact: contact,
        created_by: user,
        title: "Tax Return Documents - FY#{year}",
        description: "Please upload the following documents for your tax return",
        due_date: Date.current + 14.days
      )

      %w[bank_statements income_statements deduction_receipts prior_tax_return].each do |doc_type|
        request.requested_documents.create!(
          document_type: doc_type,
          name: doc_type.titleize,
          required: true
        )
      end

      request
    end

    private

    def generate_access_token
      self.access_token ||= SecureRandom.urlsafe_base64(32)
    end
  end
end
