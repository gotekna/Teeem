# frozen_string_literal: true

module Gl
  class ReconciliationLine < ApplicationRecord
    self.table_name = 'gl_reconciliation_lines'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :gl_bank_reconciliation, class_name: 'Gl::BankReconciliation'
    belongs_to :gl_ledger_line, class_name: 'Gl::LedgerLine', optional: true
    belongs_to :gl_account, class_name: 'Gl::Account', optional: true  # For adjustments

    delegate :corporate, to: :gl_bank_reconciliation

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    STATUSES = %w[unmatched matched excluded adjustment].freeze
    MATCH_TYPES = %w[auto manual rule].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :match_type, inclusion: { in: MATCH_TYPES }, allow_blank: true

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :unmatched, -> { where(status: 'unmatched') }
    scope :matched, -> { where(status: 'matched') }
    scope :excluded, -> { where(status: 'excluded') }
    scope :adjustment, -> { where(status: 'adjustment') }

    scope :statement_items, -> { where(gl_ledger_line_id: nil) }
    scope :gl_items, -> { where.not(gl_ledger_line_id: nil) }

    scope :by_date, -> { order(:transaction_date, :id) }
    scope :by_amount, -> { order(Arel.sql('ABS(amount) DESC')) }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Type Checks
    # ═══════════════════════════════════════════════════════════════
    def statement_item?
      gl_ledger_line_id.nil? && external_transaction_id.present?
    end

    def gl_item?
      gl_ledger_line_id.present?
    end

    def unmatched?
      status == 'unmatched'
    end

    def matched?
      status == 'matched'
    end

    def excluded?
      status == 'excluded'
    end

    def adjustment?
      status == 'adjustment'
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Amount
    # ═══════════════════════════════════════════════════════════════
    def deposit?
      amount.to_d > 0
    end

    def withdrawal?
      amount.to_d < 0
    end

    def formatted_amount
      if deposit?
        "+#{amount.abs}"
      else
        "-#{amount.abs}"
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Matching
    # ═══════════════════════════════════════════════════════════════
    def match_with!(other_line, match_type: 'manual', confidence: 100)
      return false if matched? || other_line.matched?
      return false unless can_match_with?(other_line)

      transaction do
        # Mark both as matched
        update!(
          status: 'matched',
          match_type: match_type,
          match_confidence: confidence,
          matched_transaction_ids: [ other_line.id ]
        )

        other_line.update!(
          status: 'matched',
          match_type: match_type,
          match_confidence: confidence,
          matched_transaction_ids: [ id ]
        )
      end

      true
    end

    def unmatch!
      return false unless matched?

      transaction do
        # Find matched line(s) and unmatch them too
        matched_transaction_ids.each do |matched_id|
          matched_line = gl_bank_reconciliation.lines.find_by(id: matched_id)
          matched_line&.update!(
            status: 'unmatched',
            match_type: nil,
            match_confidence: nil,
            matched_transaction_ids: []
          )
        end

        update!(
          status: 'unmatched',
          match_type: nil,
          match_confidence: nil,
          matched_transaction_ids: []
        )
      end

      true
    end

    def exclude!(reason = nil)
      return false if matched?

      update!(
        status: 'excluded',
        adjustment_reason: reason
      )
      true
    end

    def include!
      return false unless excluded?

      update!(
        status: 'unmatched',
        adjustment_reason: nil
      )
      true
    end

    def can_match_with?(other_line)
      return false if id == other_line.id
      return false if matched? || other_line.matched?

      # Must be opposite types (statement vs GL)
      return false if statement_item? == other_line.statement_item?

      # Amounts should match (opposite signs cancel out)
      (amount + other_line.amount).abs < 0.01
    end

    # Calculate match score with another line (0-100)
    def match_score_with(other_line)
      return 0 unless can_match_with?(other_line)

      score = 0

      # Amount match (must match for can_match_with? to be true)
      score += 50

      # Date proximity (same day = 30 points, within 3 days = 20, within 7 = 10)
      if transaction_date && other_line.transaction_date
        day_diff = (transaction_date - other_line.transaction_date).abs
        if day_diff == 0
          score += 30
        elsif day_diff <= 3
          score += 20
        elsif day_diff <= 7
          score += 10
        end
      end

      # Description similarity (simple contains check)
      if description.present? && other_line.description.present?
        desc1 = description.downcase
        desc2 = other_line.description.downcase

        if desc1 == desc2
          score += 20
        elsif desc1.include?(desc2) || desc2.include?(desc1)
          score += 10
        end
      end

      # Reference match
      if reference.present? && other_line.reference.present?
        if reference.downcase == other_line.reference.downcase
          score += 10
        end
      end

      score.clamp(0, 100)
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Adjustments
    # ═══════════════════════════════════════════════════════════════
    def create_adjustment!(account:, reason:)
      return false if matched?

      # Create a new adjustment line
      adjustment = gl_bank_reconciliation.lines.create!(
        status: 'adjustment',
        transaction_date: transaction_date,
        description: "Adjustment: #{reason}",
        amount: -amount,  # Opposite to cancel out
        adjustment_reason: reason,
        gl_account: account,
        matched_transaction_ids: [ id ]
      )

      # Mark this as matched with the adjustment
      update!(
        status: 'matched',
        match_type: 'manual',
        match_confidence: 100,
        matched_transaction_ids: [ adjustment.id ]
      )

      adjustment
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Display
    # ═══════════════════════════════════════════════════════════════
    def source_label
      if gl_item?
        'GL'
      elsif statement_item?
        'Statement'
      else
        'Unknown'
      end
    end

    def status_badge
      case status
      when 'unmatched' then { text: 'Unmatched', color: 'yellow' }
      when 'matched' then { text: 'Matched', color: 'green' }
      when 'excluded' then { text: 'Excluded', color: 'gray' }
      when 'adjustment' then { text: 'Adjustment', color: 'blue' }
      else { text: status.titleize, color: 'gray' }
      end
    end
  end
end
