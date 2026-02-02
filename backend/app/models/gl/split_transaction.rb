# frozen_string_literal: true

module Gl
  # Split a transaction across multiple accounts
  class SplitTransaction < ApplicationRecord
    self.table_name = "gl_split_transactions"

    STATUSES = %w[pending completed reversed].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :original_transaction, polymorphic: true
    belongs_to :created_by, class_name: "User", optional: true
    belongs_to :approved_by, class_name: "User", optional: true

    has_many :lines, class_name: "Gl::SplitLine", foreign_key: :split_transaction_id, dependent: :destroy

    validates :original_amount, presence: true, numericality: { other_than: 0 }
    validates :status, inclusion: { in: STATUSES }

    validate :lines_sum_to_original

    scope :pending, -> { where(status: "pending") }
    scope :completed, -> { where(status: "completed") }
    scope :recent, -> { order(created_at: :desc) }

    # Create split with lines
    def self.create_split!(transaction, lines_params, user:)
      split = new(
        corporate_company: transaction.try(:corporate_company) || Corporate.first,
        original_transaction: transaction,
        original_amount: transaction.try(:amount) || transaction.try(:total),
        created_by: user
      )

      lines_params.each do |line_params|
        split.lines.build(line_params)
      end

      split.save!
      split
    end

    # Complete the split
    def complete!(approver = nil)
      return false unless status == "pending"
      return false unless lines_balanced?

      transaction do
        update!(
          status: "completed",
          approved_by: approver,
          completed_at: Time.current
        )

        # Create journal entries for the split
        create_split_journal_entries!
      end

      true
    end

    # Reverse the split
    def reverse!(user)
      return false unless status == "completed"

      transaction do
        # Reverse the journal entries
        reverse_journal_entries!

        update!(
          status: "reversed",
          notes: "#{notes}\n\nReversed by #{user.name} at #{Time.current}"
        )
      end

      true
    end

    # Check if lines sum to original
    def lines_balanced?
      return false if lines.empty?
      (lines.sum(&:amount) - original_amount).abs < 0.01
    end

    private

    def lines_sum_to_original
      return if lines.empty?

      total = lines.sum { |l| l.amount || 0 }
      return if (total - original_amount).abs < 0.01

      errors.add(:base, "Split lines must sum to original amount (#{original_amount})")
    end

    def create_split_journal_entries!
      # Implementation depends on the original transaction type
      # This creates journal entries to record the split
    end

    def reverse_journal_entries!
      # Reverse any journal entries created by the split
    end
  end
end
