# frozen_string_literal: true

module Gl
  # Stock count (stocktake) records
  class StockCount < ApplicationRecord
    self.table_name = "gl_stock_counts"

    STATUSES = %w[draft in_progress completed approved].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :created_by, class_name: "User", optional: true
    belongs_to :approved_by, class_name: "User", optional: true

    has_many :lines, class_name: "Gl::StockCountLine", foreign_key: "stock_count_id", dependent: :destroy
    accepts_nested_attributes_for :lines, allow_destroy: true

    validates :reference, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :count_date, presence: true
    validates :status, presence: true, inclusion: { in: STATUSES }

    before_create :generate_reference

    scope :draft, -> { where(status: "draft") }
    scope :in_progress, -> { where(status: "in_progress") }
    scope :completed, -> { where(status: %w[completed approved]) }

    # Start the stock count
    def start!
      return false unless status == "draft"

      update!(status: "in_progress", started_at: Time.current)
    end

    # Complete the count (ready for approval)
    def complete!
      return false unless status == "in_progress"

      # Calculate variances
      lines.each do |line|
        line.calculate_variance!
      end

      update!(status: "completed", completed_at: Time.current)
    end

    # Approve and apply adjustments
    def approve!(user)
      return false unless status == "completed"

      transaction do
        # Apply adjustments to inventory
        lines.where.not(variance: 0).find_each do |line|
          line.inventory_item.adjust!(
            quantity: line.counted_quantity,
            reason: "Stock count #{reference}",
            user: user
          )
        end

        update!(
          status: "approved",
          approved_by: user
        )
      end
    end

    # Add all active items to the count
    def populate_all_items!
      corporate_company.gl_inventory_items.active.tracked.find_each do |item|
        lines.find_or_create_by!(inventory_item: item) do |line|
          line.system_quantity = item.quantity_on_hand
        end
      end
    end

    def total_variance_value
      lines.sum(:variance_value)
    end

    def items_with_variance
      lines.where.not(variance: 0).count
    end

    private

    def generate_reference
      return if reference.present?

      year = Date.current.year.to_s[-2..]
      sequence = self.class.where(corporate_company_id: corporate_company_id)
                           .where("reference LIKE ?", "SC#{year}%")
                           .count + 1

      self.reference = "SC#{year}#{sequence.to_s.rjust(4, '0')}"
    end
  end
end
