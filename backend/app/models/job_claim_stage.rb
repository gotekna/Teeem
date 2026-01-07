# frozen_string_literal: true

class JobClaimStage < ApplicationRecord
  # Associations
  belongs_to :job
  belongs_to :claim_stage_template, optional: true
  belongs_to :external_invoice, optional: true
  belongs_to :retainage_release_invoice, class_name: "Gl::Invoice", optional: true

  # SmTask link - when created from Schedule Master CLAIM task
  has_one :sm_task, dependent: :nullify

  # Status constants
  MATCH_STATUSES = %w[unmatched auto_matched manual_matched].freeze
  PAYMENT_STATUSES = %w[pending partial paid].freeze
  RETAINAGE_STATUSES = %w[none held released].freeze

  # Validations
  validates :name, presence: true
  validates :sequence_order, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true
  validates :match_status, inclusion: { in: MATCH_STATUSES }
  validates :payment_status, inclusion: { in: PAYMENT_STATUSES }
  validates :external_invoice_id, uniqueness: { scope: :job_id, message: "is already linked to another stage" },
                                  allow_nil: true
  validates :retainage_percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Scopes
  scope :ordered, -> { order(:sequence_order) }
  scope :with_retainage, -> { where("retainage_percentage > 0") }
  scope :retainage_held, -> { where("retainage_amount > 0 AND retainage_released_at IS NULL") }
  scope :retainage_released, -> { where.not(retainage_released_at: nil) }
  scope :unmatched, -> { where(match_status: "unmatched") }
  scope :matched, -> { where(match_status: %w[auto_matched manual_matched]) }
  scope :pending_payment, -> { where(payment_status: "pending") }
  scope :paid, -> { where(payment_status: "paid") }
  scope :custom, -> { where(is_custom: true) }
  scope :from_template, -> { where(is_custom: false) }

  # Callbacks
  before_validation :set_defaults, on: :create
  before_validation :apply_default_retainage, on: :create
  before_save :calculate_retainage_amount
  after_save :sync_payment_from_invoice, if: :saved_change_to_external_invoice_id?

  # Instance Methods

  # Calculate expected amount based on percentage of contract price
  # SSoT: contract_price is THE ONE
  def calculate_expected_amount!
    return unless percentage.present? && job.present?
    contract = job.contract_price.to_d
    self.expected_amount = (contract * percentage / 100).round(2)
    save! if persisted?
  end

  # Match to an external invoice
  def match_to_invoice!(invoice, auto: false)
    transaction do
      self.external_invoice = invoice
      self.match_status = auto ? "auto_matched" : "manual_matched"
      self.matched_at = Time.current
      sync_payment_from_invoice
      save!
    end
  end

  # Remove invoice match
  def unmatch!
    transaction do
      self.external_invoice = nil
      self.match_status = "unmatched"
      self.matched_at = nil
      self.amount_invoiced = 0
      self.amount_paid = 0
      self.payment_status = "pending"
      self.payment_date = nil
      save!
    end
  end

  # Sync payment info from linked invoice
  def sync_payment_from_invoice
    return unless external_invoice.present?

    self.amount_invoiced = external_invoice.total.to_d
    self.amount_paid = external_invoice.amount_paid.to_d

    self.payment_status = if amount_paid >= amount_invoiced && amount_invoiced > 0
                            "paid"
                          elsif amount_paid > 0
                            "partial"
                          else
                            "pending"
                          end

    self.payment_date = external_invoice.fully_paid_date if payment_status == "paid"
  end

  # Display helpers
  def matched?
    match_status != "unmatched"
  end

  def auto_matched?
    match_status == "auto_matched"
  end

  def manual_matched?
    match_status == "manual_matched"
  end

  def paid?
    payment_status == "paid"
  end

  def partial_payment?
    payment_status == "partial"
  end

  def variance_amount
    return nil unless expected_amount.present? && amount_invoiced.present? && amount_invoiced > 0
    amount_invoiced - expected_amount
  end

  def variance_percent
    return nil unless expected_amount.present? && expected_amount > 0 && variance_amount.present?
    (variance_amount / expected_amount * 100).round(2)
  end

  def has_variance?
    variance_amount.present? && variance_amount.abs > 0.01
  end

  # Retainage Methods

  # Check if this stage has retainage configured
  def has_retainage?
    retainage_percentage.present? && retainage_percentage > 0
  end

  # Check if retainage is currently held
  def retainage_held?
    has_retainage? && retainage_amount > 0 && retainage_released_at.nil?
  end

  # Check if retainage has been released
  def retainage_released?
    retainage_released_at.present?
  end

  # Get retainage status
  def retainage_status
    return "none" unless has_retainage?
    return "released" if retainage_released?
    "held"
  end

  # Calculate net payable (amount invoiced minus held retainage)
  def net_payable
    return amount_invoiced unless has_retainage? && retainage_held?
    amount_invoiced - retainage_amount
  end

  # Release retainage (optionally linked to a release invoice)
  def release_retainage!(release_invoice: nil)
    return false unless retainage_held?

    transaction do
      self.retainage_released_at = Time.current
      self.retainage_release_invoice = release_invoice if release_invoice
      save!
    end

    true
  end

  # Calculate total retainage held across all stages for a job
  def self.total_retainage_held_for_job(job_id)
    where(job_id: job_id).retainage_held.sum(:retainage_amount)
  end

  private

  def apply_default_retainage
    return if retainage_percentage.present?
    return unless job&.default_retainage_percentage.present?
    self.retainage_percentage = job.default_retainage_percentage
  end

  def calculate_retainage_amount
    return unless has_retainage? && amount_invoiced.present? && amount_invoiced > 0
    return if retainage_released? # Don't recalculate if already released
    self.retainage_amount = (amount_invoiced * retainage_percentage / 100).round(2)
  end

  def set_defaults
    self.match_status ||= "unmatched"
    self.payment_status ||= "pending"
    self.amount_invoiced ||= 0
    self.amount_paid ||= 0
  end
end
