# frozen_string_literal: true

module Gl
  # Equipment tracking for job costing
  class Equipment < ApplicationRecord
    self.table_name = "gl_equipment"

    STATUSES = %w[active maintenance retired].freeze
    OWNERSHIP_TYPES = %w[owned leased rented].freeze
    CATEGORIES = %w[heavy light vehicles tools].freeze

    belongs_to :corporate_company

    has_many :usages, class_name: "Gl::EquipmentUsage", foreign_key: "equipment_id", dependent: :destroy

    validates :equipment_number, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :name, presence: true
    validates :status, inclusion: { in: STATUSES }
    validates :ownership_type, inclusion: { in: OWNERSHIP_TYPES }

    scope :active, -> { where(status: "active") }
    scope :owned, -> { where(ownership_type: "owned") }
    scope :available, -> { active.where.not(status: "maintenance") }

    # Calculate rate for a period
    def rate_for(period_type)
      case period_type.to_s
      when "hour" then hourly_rate
      when "day" then daily_rate || (hourly_rate * 8)
      when "week" then weekly_rate || (daily_rate || hourly_rate * 8) * 5
      when "month" then monthly_rate || (weekly_rate || (daily_rate || hourly_rate * 8) * 5) * 4
      else hourly_rate
      end
    end

    # Calculate total cost per hour (including operating costs)
    def fully_loaded_hourly_rate
      (hourly_rate || 0) + (fuel_cost_per_hour || 0) + (maintenance_cost_per_hour || 0)
    end

    # Record usage
    def record_usage!(job:, hours:, user: nil, usage_date: Date.current, notes: nil)
      usage = usages.create!(
        job: job,
        user: user,
        usage_date: usage_date,
        hours: hours,
        hourly_rate: fully_loaded_hourly_rate,
        total_cost: (hours * fully_loaded_hourly_rate).round(2),
        notes: notes
      )

      update!(
        total_hours: total_hours + hours,
        last_used_at: Time.current
      )

      usage
    end

    # Usage by job
    def usage_by_job
      usages.group(:job_id)
            .select("job_id, SUM(hours) as total_hours, SUM(total_cost) as total_cost")
    end

    # Utilization rate (percentage of time used vs available)
    def utilization_rate(period_start:, period_end:)
      working_days = (period_start..period_end).count { |d| !d.saturday? && !d.sunday? }
      available_hours = working_days * 8
      return 0 if available_hours.zero?

      used_hours = usages.where(usage_date: period_start..period_end).sum(:hours)
      (used_hours / available_hours * 100).round(1)
    end

    # Calculate depreciation (straight-line)
    def calculate_depreciation(useful_life_years: 5)
      return 0 unless purchase_price.present? && purchase_price.positive?

      annual_depreciation = purchase_price / useful_life_years
      years_owned = ((Date.current - (purchase_date || Date.current)) / 365.25).floor
      accumulated = [annual_depreciation * years_owned, purchase_price].min

      self.current_value = purchase_price - accumulated
      save!
      current_value
    end
  end
end
