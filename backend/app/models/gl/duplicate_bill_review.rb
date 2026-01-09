# frozen_string_literal: true

module Gl
  # Tracks review status of potential duplicate bill pairs
  # Used to prevent re-alerting on already-reviewed duplicates
  #
  class DuplicateBillReview < ApplicationRecord
    self.table_name = "gl_duplicate_bill_reviews"

    # Associations
    belongs_to :bill1, class_name: "ExternalInvoice"
    belongs_to :bill2, class_name: "ExternalInvoice"
    belongs_to :reviewed_by, class_name: "User", optional: true
    belongs_to :kept_bill, class_name: "ExternalInvoice", optional: true
    belongs_to :voided_bill, class_name: "ExternalInvoice", optional: true

    # Constants
    STATUSES = %w[pending not_duplicate confirmed_duplicate].freeze
    ACTIONS = %w[void delete link ignore].freeze

    # Validations
    validates :bill1_id, presence: true
    validates :bill2_id, presence: true
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :action_taken, inclusion: { in: ACTIONS }, allow_blank: true
    validate :bills_are_different
    validate :bill1_id_less_than_bill2_id

    # Scopes
    scope :pending, -> { where(status: "pending") }
    scope :reviewed, -> { where.not(status: "pending") }
    scope :confirmed, -> { where(status: "confirmed_duplicate") }
    scope :not_duplicates, -> { where(status: "not_duplicate") }
    scope :recent, -> { order(created_at: :desc) }

    # Callbacks
    before_validation :normalize_bill_order

    # Check if a pair has been reviewed
    def self.reviewed?(bill1_id, bill2_id)
      ids = [bill1_id, bill2_id].sort
      exists?(bill1_id: ids[0], bill2_id: ids[1], status: %w[not_duplicate confirmed_duplicate])
    end

    # Get review for a pair
    def self.for_pair(bill1_id, bill2_id)
      ids = [bill1_id, bill2_id].sort
      find_by(bill1_id: ids[0], bill2_id: ids[1])
    end

    # Get all bills involved in confirmed duplicates
    def self.voided_bill_ids
      confirmed.where.not(voided_bill_id: nil).pluck(:voided_bill_id)
    end

    # Instance methods
    def pending?
      status == "pending"
    end

    def confirmed_duplicate?
      status == "confirmed_duplicate"
    end

    def not_duplicate?
      status == "not_duplicate"
    end

    def reviewed?
      !pending?
    end

    private

    def normalize_bill_order
      return unless bill1_id.present? && bill2_id.present?
      if bill1_id > bill2_id
        self.bill1_id, self.bill2_id = bill2_id, bill1_id
      end
    end

    def bills_are_different
      if bill1_id == bill2_id
        errors.add(:base, "Cannot compare a bill to itself")
      end
    end

    def bill1_id_less_than_bill2_id
      if bill1_id.present? && bill2_id.present? && bill1_id > bill2_id
        errors.add(:base, "bill1_id must be less than bill2_id (use normalize_bill_order)")
      end
    end
  end
end
