# frozen_string_literal: true

module Gl
  # Tracks BAS lodgements to ATO
  #
  # SSoT: This is THE record of BAS lodgements
  #
  class BasLodgement < ApplicationRecord
    self.table_name = "gl_bas_lodgements"

    # Associations
    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :lodged_by, class_name: "User", optional: true

    # Validations
    validates :period_code, presence: true
    validates :period_year, presence: true
    validates :status, presence: true, inclusion: {
      in: %w[pending lodged failed error cancelled]
    }

    # Scopes
    scope :for_period, ->(code, year) { where(period_code: code, period_year: year) }
    scope :lodged, -> { where(status: "lodged") }
    scope :pending, -> { where(status: %w[pending]) }
    scope :failed, -> { where(status: %w[failed error]) }
    scope :recent, -> { order(created_at: :desc) }

    # Instance methods
    def lodged?
      status == "lodged"
    end

    def pending?
      status == "pending"
    end

    def failed?
      %w[failed error].include?(status)
    end

    def can_amend?
      lodged? && !Gl::BasLodgement.where(
        corporate_company: corporate_company,
        period_code: period_code,
        period_year: period_year,
        is_amendment: true,
        status: "lodged"
      ).where("created_at > ?", created_at).exists?
    end

    def period_display
      "FY#{period_year}-#{period_year + 1} #{period_code}"
    end

    def net_amount
      data&.dig("fields", "net_amount") || 0
    end

    def gst_payable
      data&.dig("fields", "gst", "1C") || 0
    end

    def payg_withheld
      data&.dig("fields", "payg_withholding", "W4") || 0
    end

    def payg_instalments
      data&.dig("fields", "payg_instalments", "T9") || 0
    end

    # Class methods
    def self.latest_for_period(company, period_code, period_year)
      where(
        corporate_company: company,
        period_code: period_code,
        period_year: period_year
      ).order(created_at: :desc).first
    end

    def self.lodged_periods(company)
      where(corporate_company: company, status: "lodged")
        .select(:period_code, :period_year)
        .distinct
        .order(:period_year, :period_code)
        .map { |r| "#{r.period_year}-#{r.period_code}" }
    end
  end
end
