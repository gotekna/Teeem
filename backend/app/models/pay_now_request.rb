# == Schema Information
#
# Table name: pay_now_requests
#
#  id                          :bigint           not null, primary key
#  purchase_order_id           :bigint           not null
#  contact_id                  :bigint           not null
#  requested_by_portal_user_id :bigint
#  original_amount             :decimal(15, 2)   not null
#  discount_percentage         :decimal(5, 2)    default(5.0), not null
#  discount_amount             :decimal(15, 2)   not null
#  discounted_amount           :decimal(15, 2)   not null
#  status                      :string           default("pending"), not null
#  reviewed_by_supervisor_id   :bigint
#  supervisor_reviewed_at      :datetime
#  supervisor_notes            :text
#  approved_by_builder_id      :bigint
#  builder_approved_at         :datetime
#  builder_notes               :text
#  payment_id                  :bigint
#  paid_at                     :datetime
#  supplier_notes              :text
#  requested_payment_date      :date
#  rejected_at                 :datetime
#  rejection_reason            :text
#  pay_now_weekly_limit_id     :bigint
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#

class PayNowRequest < ApplicationRecord
  # Relationships
  belongs_to :purchase_order
  belongs_to :contact
  belongs_to :requested_by_portal_user, class_name: "PortalUser", optional: true
  belongs_to :reviewed_by_supervisor, class_name: "User", optional: true
  belongs_to :approved_by_builder, class_name: "User", optional: true
  belongs_to :payment, optional: true
  belongs_to :pay_now_weekly_limit, optional: true

  # SSoT: Links to deduplicated file storage (Jan 2026)
  belongs_to :invoice_blob, class_name: "StorageBlob", optional: true
  # proof_photo_blob_ids is a JSONB array of StorageBlob IDs

  # ActiveStorage attachments REMOVED (Jan 2026) - violated SSoT.

  # Validations
  validates :original_amount, presence: true, numericality: { greater_than: 0 }
  validates :discount_percentage, presence: true, numericality: {
    greater_than_or_equal_to: 0,
    less_than_or_equal_to: 100
  }
  validates :discount_amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :discounted_amount, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: {
    in: %w[pending approved rejected paid cancelled]
  }

  # Custom validations
  validate :purchase_order_must_be_completed, on: :create
  validate :no_duplicate_pending_requests, on: :create
  validate :amount_within_weekly_limit, on: :create
  validate :rejection_reason_present_if_rejected

  # Callbacks
  before_validation :calculate_discounted_amount, if: -> { original_amount_changed? || discount_percentage_changed? }
  after_create :reserve_weekly_limit
  after_create :notify_supervisors
  after_update :handle_status_changes, if: :saved_change_to_status?

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :approved, -> { where(status: "approved") }
  scope :rejected, -> { where(status: "rejected") }
  scope :paid, -> { where(status: "paid") }
  scope :cancelled, -> { where(status: "cancelled") }
  scope :active, -> { where(status: %w[pending approved]) }
  scope :completed, -> { where(status: %w[paid rejected cancelled]) }
  scope :for_week, ->(start_date) {
    where("created_at >= ? AND created_at <= ?", start_date, start_date.end_of_week(:monday))
  }
  scope :current_week, -> {
    today = CorporateCompanySetting.today
    for_week(today.beginning_of_week(:monday))
  }

  # SSoT: Storage reference for provider-agnostic access
  # Returns storage_item_id (new) or storage_file_id (legacy, renamed from sharepoint_file_id)
  def storage_reference
    storage_item_id.presence || storage_file_id
  end

  # State machine methods
  def approve!(user:, notes: nil)
    transaction do
      update!(
        status: "approved",
        reviewed_by_supervisor: user,
        supervisor_reviewed_at: Time.current,
        supervisor_notes: notes
      )

      # Process payment immediately
      process_payment!
    end
  end

  def reject!(user:, reason:)
    raise ArgumentError, "Rejection reason is required" if reason.blank?

    transaction do
      update!(
        status: "rejected",
        reviewed_by_supervisor: user,
        supervisor_reviewed_at: Time.current,
        rejected_at: Time.current,
        rejection_reason: reason
      )

      # Release reserved amount from weekly limit
      release_weekly_limit if pay_now_weekly_limit.present?
    end
  end

  def cancel!
    transaction do
      update!(status: "cancelled")

      # Release reserved amount from weekly limit
      release_weekly_limit if pay_now_weekly_limit.present?
    end
  end

  def process_payment!
    return if payment.present? # Already processed

    transaction do
      # Create payment record
      new_payment = purchase_order.payments.create!(
        amount: discounted_amount,
        payment_date: CorporateCompanySetting.today,
        payment_method: "bank_transfer",
        reference_number: "PAY-NOW-#{id}",
        notes: "Early payment with #{discount_percentage}% discount. Discount amount: $#{discount_amount}. Original amount: $#{original_amount}.",
        created_by_id: reviewed_by_supervisor_id
      )

      # Update request with payment details
      update!(
        payment: new_payment,
        paid_at: Time.current,
        status: "paid"
      )

      # Apply invoice to PO if not already invoiced
      unless purchase_order.invoice_date.present?
        purchase_order.update!(
          invoice_date: CorporateCompanySetting.today,
          invoice_reference: "PAY-NOW-#{id}",
          invoiced_amount: discounted_amount
        )
      end
    end
  rescue StandardError => e
    # If payment processing fails, mark as rejected
    update!(
      status: "rejected",
      rejected_at: Time.current,
      rejection_reason: "Payment processing failed: #{e.message}"
    )
    release_weekly_limit if pay_now_weekly_limit.present?
    raise
  end

  # Helper methods
  def can_be_cancelled?
    %w[pending].include?(status)
  end

  def can_be_approved?
    status == "pending"
  end

  def can_be_rejected?
    status == "pending"
  end

  def savings_for_supplier
    discount_amount
  end

  def formatted_original_amount
    "$#{original_amount.round(2)}"
  end

  def formatted_discount_amount
    "$#{discount_amount.round(2)}"
  end

  def formatted_discounted_amount
    "$#{discounted_amount.round(2)}"
  end

  def status_display
    status.humanize
  end

  def status_color
    case status
    when "pending"
      "yellow"
    when "approved"
      "green"
    when "paid"
      "blue"
    when "rejected", "cancelled"
      "red"
    else
      "gray"
    end
  end

  # JSON representation for API
  def as_json(options = {})
    super(options.merge(
      include: {
        purchase_order: {
          methods: [ :supplier_name ]
        },
        contact: {},
        reviewed_by_supervisor: {},
        payment: {}
      },
      methods: [
        :formatted_original_amount,
        :formatted_discount_amount,
        :formatted_discounted_amount,
        :status_display,
        :status_color,
        :savings_for_supplier
      ]
    ))
  end

  private

  def calculate_discounted_amount
    self.discount_amount = (original_amount * (discount_percentage / 100.0)).round(2)
    self.discounted_amount = (original_amount - discount_amount).round(2)
  end

  def purchase_order_must_be_completed
    unless purchase_order&.completed_at.present?
      errors.add(:purchase_order, "must be marked as completed before requesting early payment")
    end
  end

  def no_duplicate_pending_requests
    if purchase_order.present? && purchase_order.pay_now_requests.where(status: %w[pending approved]).where.not(id: id).exists?
      errors.add(:purchase_order, "already has a pending payment request")
    end
  end

  def amount_within_weekly_limit
    return unless original_amount.present?

    weekly_limit = PayNowWeeklyLimit.current

    unless weekly_limit.check_availability(discounted_amount)
      errors.add(:base, "Request amount exceeds weekly limit. Available: #{weekly_limit.formatted_remaining_amount}")
    end
  end

  def rejection_reason_present_if_rejected
    if status == "rejected" && rejection_reason.blank?
      errors.add(:rejection_reason, "must be provided when rejecting a request")
    end
  end

  def reserve_weekly_limit
    weekly_limit = PayNowWeeklyLimit.current
    self.pay_now_weekly_limit = weekly_limit

    unless weekly_limit.reserve_amount(discounted_amount)
      raise ActiveRecord::RecordInvalid, "Unable to reserve weekly limit amount"
    end

    save! # Save the association
  end

  def release_weekly_limit
    return unless pay_now_weekly_limit.present?

    pay_now_weekly_limit.release_amount(discounted_amount)
  end

  def handle_status_changes
    case status
    when "approved"
      PayNowNotificationJob.perform_later(id, "approved")
    when "rejected"
      PayNowNotificationJob.perform_later(id, "rejected")
    when "paid"
      PayNowNotificationJob.perform_later(id, "paid")
    end
  end

  def notify_supervisors
    PayNowNotificationJob.perform_later(id, "submitted")
  end
end

# ========================================
# StorageBlob File Access (SSoT) - reopened for cleaner code
# ========================================
class PayNowRequest
  # Invoice file methods
  def has_invoice_file?
    invoice_blob_id.present?
  end

  def invoice_file_url(expires_in: 3600)
    return nil unless invoice_blob

    invoice_blob.presigned_url(expires_in: expires_in)
  end

  def attach_invoice_file(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    invoice_blob&.decrement_reference! if invoice_blob_id.present?
    self.invoice_blob = blob
    blob.increment_reference!
  end

  # Proof photo methods (multiple photos via JSONB array)
  def proof_photo_blobs
    return [] if proof_photo_blob_ids.blank?

    StorageBlob.where(id: proof_photo_blob_ids)
  end

  def has_proof_photos?
    proof_photo_blob_ids.present? && proof_photo_blob_ids.any?
  end

  def proof_photo_urls(expires_in: 3600)
    return [] unless has_proof_photos?

    proof_photo_blobs.map do |blob|
      {
        id: blob.id,
        url: blob.presigned_url(expires_in: expires_in),
        filename: blob.original_filename,
        content_type: blob.content_type
      }
    end
  end

  def add_proof_photo(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )
    blob.increment_reference!

    self.proof_photo_blob_ids ||= []
    self.proof_photo_blob_ids << blob.id unless proof_photo_blob_ids.include?(blob.id)
    blob
  end

  def remove_proof_photo(blob_id)
    return unless proof_photo_blob_ids&.include?(blob_id)

    blob = StorageBlob.find_by(id: blob_id)
    blob&.decrement_reference!

    self.proof_photo_blob_ids = proof_photo_blob_ids - [blob_id]
  end
end
