# frozen_string_literal: true

module Gl
  # Progress claims for construction/project billing by percentage complete
  class ProgressClaim < ApplicationRecord
    self.table_name = "gl_progress_claims"

    STATUSES = %w[draft submitted approved certified invoiced paid].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :job
    belongs_to :contact
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true
    belongs_to :created_by, class_name: "User", optional: true
    belongs_to :approved_by, class_name: "User", optional: true

    has_many :lines, class_name: "Gl::ProgressClaimLine", foreign_key: "progress_claim_id", dependent: :destroy
    accepts_nested_attributes_for :lines, allow_destroy: true

    validates :claim_number, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :claim_date, presence: true
    validates :contract_value, presence: true, numericality: { greater_than: 0 }
    validates :this_claim_pct, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
    validates :status, presence: true, inclusion: { in: STATUSES }

    validate :total_claimed_not_exceed_100

    before_save :calculate_amounts
    before_create :set_claim_sequence
    before_create :generate_claim_number

    scope :for_job, ->(job_id) { where(job_id: job_id) }
    scope :draft, -> { where(status: "draft") }
    scope :submitted, -> { where(status: "submitted") }
    scope :approved, -> { where(status: %w[approved certified invoiced paid]) }
    scope :pending_certification, -> { where(status: "approved") }

    # Get previous claims for this job
    def previous_claims
      self.class.where(job_id: job_id, corporate_company_id: corporate_company_id)
                .where("claim_sequence < ?", claim_sequence || 999)
                .order(:claim_sequence)
    end

    # Calculate amounts from percentage
    def calculate_amounts
      self.adjusted_contract_value = contract_value.to_d + variations_approved.to_d
      self.previous_claimed_pct ||= previous_claims.sum(:this_claim_pct)
      self.total_claimed_pct = previous_claimed_pct.to_d + this_claim_pct.to_d

      self.previous_claimed_amount = previous_claims.sum(:this_claim_amount)
      self.this_claim_amount = (adjusted_contract_value * this_claim_pct / 100).round(2)
      self.total_claimed_amount = previous_claimed_amount.to_d + this_claim_amount

      # Calculate retainage
      self.retainage_amount = (this_claim_amount * retainage_pct / 100).round(2) if retainage_pct.to_d > 0

      # Net is claim minus retainage held
      self.net_claim_amount = this_claim_amount - retainage_amount.to_d + retainage_released.to_d

      # GST on net amount
      self.gst_amount = (net_claim_amount * 0.1).round(2)

      # Total payable
      self.total_payable = net_claim_amount + gst_amount
    end

    # Submit claim for approval
    def submit!
      return false unless status == "draft"

      update!(status: "submitted", submitted_at: Time.current)
    end

    # Approve claim
    def approve!(user)
      return false unless status == "submitted"

      update!(
        status: "approved",
        approved_by: user,
        approved_at: Time.current
      )
    end

    # Certify claim (superintendent/architect certification)
    def certify!
      return false unless status == "approved"

      update!(status: "certified", certified_at: Time.current)
    end

    # Generate invoice from claim
    def generate_invoice!
      return invoice if invoice.present?
      return nil unless %w[approved certified].include?(status)

      inv = Gl::Invoice.create!(
        corporate_company: corporate_company,
        contact: contact,
        invoice_type: "sales",
        status: "draft",
        date: Date.current,
        due_date: Date.current + 30.days,
        reference: "Progress Claim #{claim_number}",
        subtotal: net_claim_amount,
        tax: gst_amount,
        total: total_payable,
        line_items_attributes: build_invoice_lines
      )

      update!(invoice: inv, status: "invoiced")
      inv
    end

    # Release retainage (usually at project completion)
    def release_retainage!(amount)
      return false if amount > retainage_amount - retainage_released

      update!(retainage_released: retainage_released.to_d + amount)
      calculate_amounts
      save!
    end

    # Remaining to claim on this job
    def remaining_to_claim
      adjusted_contract_value - total_claimed_amount
    end

    def remaining_pct
      100 - total_claimed_pct
    end

    private

    def set_claim_sequence
      last_claim = self.class.where(job_id: job_id, corporate_company_id: corporate_company_id)
                             .order(:claim_sequence)
                             .last

      self.claim_sequence = (last_claim&.claim_sequence || 0) + 1
    end

    def generate_claim_number
      return if claim_number.present?

      prefix = "PC"
      year = Date.current.year.to_s[-2..]
      sequence = self.class.where(corporate_company_id: corporate_company_id)
                           .where("claim_number LIKE ?", "#{prefix}#{year}%")
                           .count + 1

      self.claim_number = "#{prefix}#{year}#{sequence.to_s.rjust(4, '0')}"
    end

    def total_claimed_not_exceed_100
      return unless this_claim_pct && previous_claimed_pct

      total = previous_claimed_pct.to_d + this_claim_pct.to_d
      errors.add(:this_claim_pct, "cannot exceed remaining 100% (#{100 - previous_claimed_pct}% remaining)") if total > 100
    end

    def build_invoice_lines
      if lines.any?
        lines.map do |line|
          {
            description: line.description,
            quantity: 1,
            unit_price: line.this_claim_amount,
            tax_type: "GST",
            account_code: "200"  # Revenue account
          }
        end
      else
        [{
          description: "Progress Claim ##{claim_sequence} - #{this_claim_pct}% complete",
          quantity: 1,
          unit_price: net_claim_amount,
          tax_type: "GST",
          account_code: "200"
        }]
      end
    end
  end
end
