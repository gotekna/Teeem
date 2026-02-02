# CaseTimelineEvent - chronological events for case investigation
class CaseTimelineEvent < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id, class_name: "CaseRecord"
  belongs_to :source, polymorphic: true, optional: true
  belongs_to :contact, optional: true
  belongs_to :corporate, foreign_key: "company_id", optional: true
  belongs_to :job, optional: true

  validates :event_date, presence: true
  validates :title, presence: true
  validates :event_type, inclusion: {
    in: %w[document email transaction meeting filing court_date deadline milestone note],
    allow_blank: true
  }

  scope :chronological, -> { order(:event_date, :event_time) }
  scope :reverse_chronological, -> { order(event_date: :desc, event_time: :desc) }
  scope :by_type, ->(type) { where(event_type: type) }
  scope :auto_generated, -> { where(is_auto_generated: true) }
  scope :manual, -> { where(is_auto_generated: false) }
  scope :in_date_range, ->(start_date, end_date) { where(event_date: start_date..end_date) }

  EVENT_TYPES = {
    "document" => { name: "Document", icon: "file-text", color: "blue" },
    "email" => { name: "Email", icon: "mail", color: "purple" },
    "transaction" => { name: "Transaction", icon: "dollar-sign", color: "green" },
    "meeting" => { name: "Meeting", icon: "users", color: "orange" },
    "filing" => { name: "Filing", icon: "folder", color: "indigo" },
    "court_date" => { name: "Court Date", icon: "gavel", color: "red" },
    "deadline" => { name: "Deadline", icon: "clock", color: "amber" },
    "milestone" => { name: "Milestone", icon: "flag", color: "teal" },
    "note" => { name: "Note", icon: "edit", color: "gray" }
  }.freeze

  def event_config
    EVENT_TYPES[event_type] || {}
  end

  def event_name
    event_config[:name] || event_type&.titleize
  end

  def default_icon
    event_config[:icon] || "circle"
  end

  def default_color
    event_config[:color] || "gray"
  end

  def display_icon
    icon.presence || default_icon
  end

  def display_color
    color.presence || default_color
  end

  def formatted_date
    event_date.strftime("%d %b %Y")
  end

  def formatted_time
    event_time&.strftime("%H:%M")
  end

  def formatted_datetime
    if event_time
      "#{formatted_date} at #{formatted_time}"
    else
      formatted_date
    end
  end

  # Create timeline event from various source types
  class << self
    def from_document(document, case_record)
      create!(
        case_record: case_record,
        event_date: document.document_date || document.created_at.to_date,
        event_type: "document",
        title: document.title || document.filename,
        description: "Document: #{document.document_type}",
        source: document,
        company_id: document.company_id,
        is_auto_generated: true,
        metadata: {
          document_type: document.document_type,
          file_size: document.file_size
        }
      )
    end

    def from_email(email, case_record)
      create!(
        case_record: case_record,
        event_date: email.received_at&.to_date || email.created_at.to_date,
        event_time: email.received_at&.to_time,
        event_type: "email",
        title: email.subject || "(No Subject)",
        description: "From: #{email.from_email}\nTo: #{email.to_emails&.join(', ')}",
        source: email,
        job_id: email.job_id,
        is_auto_generated: true,
        metadata: {
          from: email.from_email,
          to: email.to_emails,
          has_attachments: email.has_attachments
        }
      )
    end

    def from_transaction(transaction, case_record)
      create!(
        case_record: case_record,
        event_date: transaction.transaction_date,
        event_type: "transaction",
        title: "#{transaction.transaction_type.titleize}: $#{transaction.amount}",
        description: transaction.description,
        source: transaction,
        company_id: transaction.company_id,
        job_id: transaction.job_id,
        is_auto_generated: true,
        metadata: {
          amount: transaction.amount,
          category: transaction.category,
          transaction_type: transaction.transaction_type
        }
      )
    end
  end
end
