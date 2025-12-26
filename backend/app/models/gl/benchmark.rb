# frozen_string_literal: true

module Gl
  # Industry benchmark data for KPI comparison
  class Benchmark < ApplicationRecord
    self.table_name = "gl_benchmarks"

    validates :industry_code, presence: true
    validates :industry_name, presence: true
    validates :kpi_code, presence: true
    validates :year, presence: true
    validates :industry_code, uniqueness: { scope: [:kpi_code, :year] }

    scope :for_industry, ->(code) { where(industry_code: code) }
    scope :for_kpi, ->(code) { where(kpi_code: code) }
    scope :for_year, ->(year) { where(year: year) }
    scope :latest, -> { order(year: :desc) }

    # Get benchmark for a KPI
    def self.for_kpi_and_industry(kpi_code, industry_code, year: Date.current.year)
      benchmark = for_industry(industry_code).for_kpi(kpi_code).for_year(year).first
      benchmark || for_industry(industry_code).for_kpi(kpi_code).latest.first
    end

    # Compare value to benchmark
    def percentile_for(value)
      return nil if value.nil?

      if value <= percentile_25
        { percentile: 25, status: "below_average" }
      elsif value <= percentile_50
        { percentile: 50, status: "average" }
      elsif value <= percentile_75
        { percentile: 75, status: "above_average" }
      elsif value <= percentile_90
        { percentile: 90, status: "excellent" }
      else
        { percentile: 95, status: "top_performer" }
      end
    end

    # Seed Australian industry benchmarks
    def self.seed_australian_benchmarks!
      # ANZSIC Division E - Construction
      construction = [
        { industry_code: "E", industry_name: "Construction", kpi_code: "gross_margin", year: 2024,
          percentile_25: 15, percentile_50: 22, percentile_75: 30, percentile_90: 38 },
        { industry_code: "E", industry_name: "Construction", kpi_code: "net_margin", year: 2024,
          percentile_25: 3, percentile_50: 6, percentile_75: 10, percentile_90: 15 },
        { industry_code: "E", industry_name: "Construction", kpi_code: "current_ratio", year: 2024,
          percentile_25: 1.1, percentile_50: 1.4, percentile_75: 1.8, percentile_90: 2.5 },
        { industry_code: "E", industry_name: "Construction", kpi_code: "dso", year: 2024,
          percentile_25: 55, percentile_50: 45, percentile_75: 35, percentile_90: 25 }
      ]

      # ANZSIC Division M - Professional Services
      professional = [
        { industry_code: "M", industry_name: "Professional Services", kpi_code: "gross_margin", year: 2024,
          percentile_25: 35, percentile_50: 45, percentile_75: 55, percentile_90: 65 },
        { industry_code: "M", industry_name: "Professional Services", kpi_code: "net_margin", year: 2024,
          percentile_25: 8, percentile_50: 15, percentile_75: 22, percentile_90: 30 }
      ]

      (construction + professional).each do |benchmark|
        find_or_create_by!(
          industry_code: benchmark[:industry_code],
          kpi_code: benchmark[:kpi_code],
          year: benchmark[:year]
        ) do |b|
          b.assign_attributes(benchmark)
        end
      end
    end
  end
end
