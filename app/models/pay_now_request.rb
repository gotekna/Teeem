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
  belongs_to :requested_by_portal_user, class_name: 'PortalUser', optional: true
  belongs_to :reviewed_by_supervisor, class_name: 'User', optional: true
  belongs_to :approved_by_builder, class_name: 'User', optional: true
  belongs_to :payment, optional: true
  belongs_to :pay_now_weekly_limit, optional: true

  # ActiveStorage attachments for proof of completion
  has_one_attached :invoice_file
  has_many_attached :proof_photos

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
  scope :pending, -> { where(status: 'pending') }
  scope :approved, -> { where(status: 'approved') }
  scope :rejected, -> { where(status: 'rejected') }
  scope :paid, -> { where(status: 'paid') }
  scope :cancelled, -> { where(status: 'cancelled') }
  scope :active, -> { where(status: %w[pending approved]) }
  scope :completed, -> { where(status: %w[paid rejected cancelled]) }
  scope :for_week, ->(start_date) {
    where('created_at >= ? AND created_at <= ?', start_date, start_date.end_of_week(:monday))
  }
  scope :current_week, -> {
    today = CompanySetting.today
    for_week(today.beginning_of_week(:monday))
  }

  # State machine methods
  def approve!(user:, notes: nil)
    transaction do
      update!(
        status: 'approved',
        reviewed_by_supervisor: user,
        supervisor_reviewed_at: Time.current,
        supervisor_notes: notes
      )

      # Process payment immediately
      process_payment!
    end
  end

  def reject!(user:, reason:)
    raise ArgumentError, 'Rejection reason is required' if reason.blank?

    transaction do
      update!(
        status: 'rejected',
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
      update!(status: 'cancelled')

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
        payment_date: CompanySetting.today,
        payment_method: 'bank_transfer',
        reference_number: "PAY-NOW-#{id}",
        notes: "Early payment with #{discount_percentage}% discount. Discount amount: $#{discount_amount}. Original amount: $#{original_amount}.",
        created_by_id: reviewed_by_supervisor_id
      )

      # Update request with payment details
      update!(
        payment: new_payment,
        paid_at: Time.current,
        status: 'paid'
      )

      # Apply invoice to PO if not already invoiced
      unless purchase_order.invoice_date.present?
        purchase_order.update!(
          invoice_date: CompanySetting.today,
          invoice_reference: "PAY-NOW-#{id}",
          invoiced_amount: discounted_amount
        )
      end
    end
  rescue StandardError => e
    # If payment processing fails, mark as rejected
    update!(
      status: 'rejected',
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
    status == 'pending'
  end

  def can_be_rejected?
    status == 'pending'
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
    when 'pending'
      'yellow'
    when 'approved'
      'green'
    when 'paid'
      'blue'
    when 'rejected', 'cancelled'
      'red'
    else
      'gray'
    end
  end

  # JSON representation for API
  def as_json(options = {})
    super(options.merge(
      include: {
        purchase_order: {
          only: [:id, :purchase_order_number, :total, :status],
          methods: [:supplier_name]
        },
        contact: {
          only: [:id, :full_name, :email]
        },
        reviewed_by_supervisor: {
          only: [:id, :first_name, :last_name, :email]
        },
        payment: {
          only: [:id, :amount, :payment_date, :reference_number]
        }
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
      errors.add(:purchase_order, 'must be marked as completed before requesting early payment')
    end
  end

  def no_duplicate_pending_requests
    if purchase_order.present? && purchase_order.pay_now_requests.where(status: %w[pending approved]).where.not(id: id).exists?
      errors.add(:purchase_order, 'already has a pending payment request')
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
    if status == 'rejected' && rejection_reason.blank?
      errors.add(:rejection_reason, 'must be provided when rejecting a request')
    end
  end

  def reserve_weekly_limit
    weekly_limit = PayNowWeeklyLimit.current
    self.pay_now_weekly_limit = weekly_limit

    unless weekly_limit.reserve_amount(discounted_amount)
      raise ActiveRecord::RecordInvalid, 'Unable to reserve weekly limit amount'
    end

    save! # Save the association
  end

  def release_weekly_limit
    return unless pay_now_weekly_limit.present?

    pay_now_weekly_limit.release_amount(discounted_amount)
  end

  def handle_status_changes
    case status
    when 'approved'
      PayNowNotificationJob.perform_later(id, 'approved')
    when 'rejected'
      PayNowNotificationJob.perform_later(id, 'rejected')
    when 'paid'
      PayNowNotificationJob.perform_later(id, 'paid')
    end
  end

  def notify_supervisors
    PayNowNotificationJob.perform_later(id, 'submitted')
  end
end
