class JobActivity < ApplicationRecord
  # Associations
  belongs_to :job
  belongs_to :user, optional: true
  belongs_to :related, polymorphic: true, optional: true

  # Validations
  validates :activity_type, presence: true
  validates :occurred_at, presence: true

  # Scopes
  scope :recent, -> { order(occurred_at: :desc) }
  scope :by_type, ->(type) { where(activity_type: type) }
  scope :since, ->(date) { where("occurred_at >= ?", date) }
  scope :between, ->(start_date, end_date) { where(occurred_at: start_date..end_date) }

  # Activity types
  ACTIVITY_TYPES = %w[
    job_created
    job_updated
    status_changed
    stage_changed
    contact_added
    contact_removed
    purchase_order_created
    purchase_order_updated
    purchase_order_approved
    purchase_order_sent
    purchase_order_received
    purchase_order_cancelled
    invoice_received
    bill_received
    document_uploaded
    xero_synced
    email_sent
    note_added
  ].freeze

  # Class methods for logging activities
  class << self
    def log(job:, activity_type:, description: nil, user: nil, related: nil, related_url: nil, metadata: {})
      create!(
        job: job,
        user: user || Current.user,
        activity_type: activity_type,
        description: description || default_description(activity_type, related),
        related: related,
        related_url: related_url,
        metadata: metadata,
        occurred_at: Time.current
      )
    rescue StandardError => e
      Rails.logger.error "Failed to log job activity: #{e.message}"
      nil
    end

    def log_job_created(job, user: nil)
      log(
        job: job,
        activity_type: "job_created",
        description: "Job '#{job.title}' was created",
        user: user,
        metadata: { title: job.title, status: job.job_status&.name }
      )
    end

    def log_status_change(job, old_status:, new_status:, user: nil)
      log(
        job: job,
        activity_type: "status_changed",
        description: "Status changed from '#{old_status}' to '#{new_status}'",
        user: user,
        metadata: { old_status: old_status, new_status: new_status }
      )
    end

    def log_stage_change(job, old_stage:, new_stage:, user: nil)
      log(
        job: job,
        activity_type: "stage_changed",
        description: "Stage changed from '#{old_stage || 'None'}' to '#{new_stage}'",
        user: user,
        metadata: { old_stage: old_stage, new_stage: new_stage }
      )
    end

    def log_contact_added(job, contact:, role: nil, user: nil)
      log(
        job: job,
        activity_type: "contact_added",
        description: "#{contact.display_name} added as #{role || 'contact'}",
        user: user,
        related: contact,
        metadata: { contact_id: contact.id, contact_name: contact.display_name, role: role }
      )
    end

    def log_contact_removed(job, contact:, user: nil)
      log(
        job: job,
        activity_type: "contact_removed",
        description: "#{contact.display_name} removed from job",
        user: user,
        metadata: { contact_id: contact.id, contact_name: contact.display_name }
      )
    end

    def log_po_created(job, purchase_order:, user: nil)
      log(
        job: job,
        activity_type: "purchase_order_created",
        description: "Purchase Order #{purchase_order.purchase_order_number} created for #{format_currency(purchase_order.total)}",
        user: user,
        related: purchase_order,
        metadata: {
          po_number: purchase_order.purchase_order_number,
          total: purchase_order.total,
          supplier_id: purchase_order.supplier_id,
          supplier_name: purchase_order.contact&.display_name
        }
      )
    end

    def log_po_approved(job, purchase_order:, user: nil)
      log(
        job: job,
        activity_type: "purchase_order_approved",
        description: "Purchase Order #{purchase_order.purchase_order_number} approved",
        user: user,
        related: purchase_order,
        metadata: { po_number: purchase_order.purchase_order_number, approved_by: user&.name }
      )
    end

    def log_po_sent(job, purchase_order:, document_url: nil, user: nil)
      log(
        job: job,
        activity_type: "purchase_order_sent",
        description: "Purchase Order #{purchase_order.purchase_order_number} sent to #{purchase_order.contact&.display_name || 'supplier'}",
        user: user,
        related: purchase_order,
        related_url: document_url,
        metadata: {
          po_number: purchase_order.purchase_order_number,
          supplier_name: purchase_order.contact&.display_name,
          document_url: document_url
        }
      )
    end

    def log_po_received(job, purchase_order:, user: nil)
      log(
        job: job,
        activity_type: "purchase_order_received",
        description: "Purchase Order #{purchase_order.purchase_order_number} marked as received",
        user: user,
        related: purchase_order,
        metadata: { po_number: purchase_order.purchase_order_number }
      )
    end

    def log_po_cancelled(job, purchase_order:, user: nil)
      log(
        job: job,
        activity_type: "purchase_order_cancelled",
        description: "Purchase Order #{purchase_order.purchase_order_number} cancelled",
        user: user,
        related: purchase_order,
        metadata: { po_number: purchase_order.purchase_order_number }
      )
    end

    def log_invoice_received(job, invoice:, user: nil)
      log(
        job: job,
        activity_type: "invoice_received",
        description: "Invoice #{invoice.invoice_number} received for #{format_currency(invoice.total)}",
        user: user,
        related: invoice,
        metadata: {
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          contact_name: invoice.contact_name
        }
      )
    end

    def log_bill_received(job, bill:, user: nil)
      log(
        job: job,
        activity_type: "bill_received",
        description: "Bill #{bill.invoice_number} received for #{format_currency(bill.total)}",
        user: user,
        related: bill,
        metadata: {
          invoice_number: bill.invoice_number,
          total: bill.total,
          contact_name: bill.contact_name
        }
      )
    end

    def log_document_uploaded(job, document_name:, document_url: nil, user: nil)
      log(
        job: job,
        activity_type: "document_uploaded",
        description: "Document '#{document_name}' uploaded",
        user: user,
        related_url: document_url,
        metadata: { document_name: document_name, document_url: document_url }
      )
    end

    def log_xero_sync(job, sync_type:, details: {})
      log(
        job: job,
        activity_type: "xero_synced",
        description: "Synced with Xero (#{sync_type})",
        metadata: { sync_type: sync_type, **details }
      )
    end

    private

    def default_description(activity_type, related)
      activity_type.to_s.titleize.gsub("_", " ")
    end

    def format_currency(amount)
      return "$0.00" unless amount
      "$#{format('%.2f', amount)}"
    end
  end

  # Instance methods
  def formatted_activity_type
    activity_type.to_s.titleize.gsub("_", " ")
  end

  def performed_by_name
    user&.name || user&.email || "System"
  end

  def time_ago
    distance = Time.current - occurred_at

    case distance
    when 0..59
      "#{distance.to_i} seconds ago"
    when 60..3599
      "#{(distance / 60).to_i} minutes ago"
    when 3600..86399
      "#{(distance / 3600).to_i} hours ago"
    when 86400..2591999
      "#{(distance / 86400).to_i} days ago"
    else
      occurred_at.strftime("%d %b %Y at %l:%M %p")
    end
  end

  def icon_name
    case activity_type
    when "job_created" then "plus-circle"
    when "job_updated" then "pencil"
    when "status_changed", "stage_changed" then "arrow-path"
    when "contact_added" then "user-plus"
    when "contact_removed" then "user-minus"
    when /purchase_order/ then "document-text"
    when "invoice_received", "bill_received" then "banknotes"
    when "document_uploaded" then "document-arrow-up"
    when "xero_synced" then "arrow-path-rounded-square"
    when "email_sent" then "envelope"
    when "note_added" then "chat-bubble-left"
    else "information-circle"
    end
  end

  def icon_color
    case activity_type
    when "job_created" then "green"
    when "status_changed", "stage_changed" then "blue"
    when "contact_added" then "indigo"
    when "contact_removed" then "red"
    when "purchase_order_created" then "purple"
    when "purchase_order_approved" then "green"
    when "purchase_order_sent" then "blue"
    when "purchase_order_received" then "green"
    when "purchase_order_cancelled" then "red"
    when "invoice_received" then "emerald"
    when "bill_received" then "orange"
    when "document_uploaded" then "cyan"
    when "xero_synced" then "sky"
    else "gray"
    end
  end
end
