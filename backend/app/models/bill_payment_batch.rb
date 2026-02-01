# frozen_string_literal: true

class BillPaymentBatch < ApplicationRecord
  # ⚠️ CRITICAL SECURITY FIX (Feb 2026): Multi-tenancy scoping
  # FRC: BillPaymentBatch was leaking data across tenants
  # Root cause: Legacy indirect relationship (batch → corporate_company → tenant)
  # Fix: Direct tenant_id column + acts_as_tenant for automatic scoping
  acts_as_tenant :tenant

  # Associations
  belongs_to :tenant
  belongs_to :corporate_company
  belongs_to :bank_account
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :approved_by, class_name: "User", optional: true
  belongs_to :bpmn_process_instance, class_name: "BpmnProcessInstance", optional: true

  has_many :bill_payments, dependent: :destroy
  has_many :bill_inbox_items, through: :bill_payments, source: :bill_inbox

  # Validations
  validates :batch_reference, presence: true, uniqueness: true
  validates :payment_date, presence: true
  validates :status, presence: true, inclusion: {
    in: %w[draft pending_approval approved generating generated
           submitted processing completed failed cancelled]
  }
  validate :payment_date_not_in_past, on: :create
  validate :bank_account_belongs_to_company

  # Callbacks
  before_validation :generate_batch_reference, on: :create
  before_validation :set_defaults, on: :create

  # Status constants
  STATUSES = %w[draft pending_approval approved generating generated
                submitted processing completed failed cancelled].freeze

  # Scopes
  scope :draft, -> { where(status: "draft") }
  scope :pending_approval, -> { where(status: "pending_approval") }
  scope :approved, -> { where(status: "approved") }
  scope :generated, -> { where(status: "generated") }
  scope :submitted, -> { where(status: "submitted") }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :active, -> { where.not(status: %w[cancelled failed completed]) }
  scope :for_company, ->(company_id) { where(corporate_company_id: company_id) }
  scope :for_date, ->(date) { where(payment_date: date) }
  scope :recent, -> { order(created_at: :desc) }

  # Instance methods
  def can_add_items?
    status == "draft"
  end

  def can_generate_file?
    status.in?(%w[draft pending_approval approved])
  end

  def can_approve?
    status == "pending_approval" && bill_payments.any?
  end

  def can_submit?
    status.in?(%w[approved generated]) && aba_file_content.present?
  end

  def can_cancel?
    status.in?(%w[draft pending_approval])
  end

  def add_bill!(bill_inbox, amount: nil)
    raise "Cannot add items to batch in #{status} status" unless can_add_items?

    payment_amount = amount || bill_inbox.remaining_balance

    bill_payments.create!(
      bill_inbox: bill_inbox,
      purchase_order: bill_inbox.matched_purchase_order,
      amount: payment_amount,
      payee_name: bill_inbox.supplier&.display_name || bill_inbox.supplier_name_raw,
      payee_bsb: bill_inbox.supplier&.bank_bsb,
      payee_account_number: bill_inbox.supplier&.bank_account_number,
      payment_reference: generate_payment_reference(bill_inbox)
    )

    recalculate_totals!
  end

  def submit_for_approval!
    return false unless can_generate_file?

    update!(status: "pending_approval")
  end

  def approve!(approver)
    return false unless can_approve?

    update!(
      status: "approved",
      approved_by: approver,
      approved_at: Time.current
    )
  end

  def generate_aba_file!
    update!(status: "generating")
    result = AbaFileGeneratorService.new(self).generate!
    update!(
      status: "generated",
      aba_file_name: result[:filename],
      aba_file_content: result[:content],
      aba_generated_at: Time.current,
      aba_sequence_number: result[:sequence]
    )
    result
  end

  def mark_submitted!
    update!(
      status: "submitted",
      submitted_to_bank_at: Time.current
    )
    bill_payments.update_all(status: "approved")
  end

  def mark_completed!
    transaction do
      bill_payments.update_all(status: "paid")
      bill_inbox_items.update_all(status: "paid")
      update!(status: "completed", completed_at: Time.current)
    end
  end

  def cancel!
    return false unless can_cancel?

    transaction do
      # Release payments from batch
      bill_payments.each do |payment|
        payment.bill_inbox.update!(status: "approved") if payment.bill_inbox.status == "processing"
      end
      bill_payments.destroy_all
      update!(status: "cancelled")
    end
    true
  end

  def formatted_total
    "$#{sprintf("%.2f", total_amount.to_f)}"
  end

  def status_display
    status.humanize.titleize
  end

  def status_color
    case status
    when "draft" then "gray"
    when "pending_approval" then "yellow"
    when "approved", "generated" then "blue"
    when "submitted", "processing" then "indigo"
    when "completed" then "green"
    when "failed", "cancelled" then "red"
    else "gray"
    end
  end

  private

  def set_defaults
    self.status ||= "draft"
    self.total_amount ||= 0
    self.payment_count ||= 0
  end

  def generate_batch_reference
    return if batch_reference.present?

    date_str = (payment_date || TenantSetting.today).strftime("%Y%m%d")
    company_code = corporate_company&.code || "XXX"
    sequence = SecureRandom.hex(3).upcase
    self.batch_reference = "PAY-#{company_code}-#{date_str}-#{sequence}"
  end

  def generate_payment_reference(bill_inbox)
    # Max 18 chars for ABA
    ref = bill_inbox.invoice_number || bill_inbox.id.to_s
    ref.gsub(/[^a-zA-Z0-9]/, "")[0..17]
  end

  def recalculate_totals!
    update!(
      total_amount: bill_payments.sum(:amount),
      payment_count: bill_payments.count
    )
  end

  def payment_date_not_in_past
    if payment_date.present? && payment_date < TenantSetting.today
      errors.add(:payment_date, "cannot be in the past")
    end
  end

  def bank_account_belongs_to_company
    if bank_account.present? && bank_account.company_id != corporate_company_id
      errors.add(:bank_account, "must belong to the selected company")
    end
  end
end
