# frozen_string_literal: true

module Gl
  # Equipment usage record for job costing
  class EquipmentUsage < ApplicationRecord
    self.table_name = "gl_equipment_usages"

    belongs_to :equipment, class_name: "Gl::Equipment"
    belongs_to :job
    belongs_to :user, optional: true

    validates :usage_date, presence: true
    validates :hours, presence: true, numericality: { greater_than: 0 }

    before_validation :calculate_cost

    scope :for_job, ->(job) { where(job_id: job.id) }
    scope :for_period, ->(start_date, end_date) { where(usage_date: start_date..end_date) }
    scope :ordered, -> { order(usage_date: :desc) }

    private

    def calculate_cost
      return unless hours.present? && hourly_rate.present?

      self.total_cost = (hours * hourly_rate).round(2)
    end
  end
end
