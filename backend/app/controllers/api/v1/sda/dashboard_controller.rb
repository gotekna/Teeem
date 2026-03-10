# frozen_string_literal: true

module Api
  module V1
    module Sda
      class DashboardController < ApplicationController
        # GET /api/v1/sda/dashboard
        def show
          # All Property queries are auto-scoped by acts_as_tenant
          all_properties = Property.all
          sda_properties = all_properties.where.not(sda_category: nil)
          enrolled = sda_properties.where(sda_enrolled: true)

          active_sda_tenancies = Tenancy.where(
            tenancy_type: "sda",
            status: "active"
          )

          # Weekly NDIA payment * 4.33 = approximate monthly revenue
          monthly_revenue = (active_sda_tenancies.sum(:ndia_payment_amount).to_f * 4.33).round(2)

          # Occupancy: active SDA tenancies / SDA properties with sda_category set
          total_sda_dwellings = sda_properties.count
          occupancy_rate = if total_sda_dwellings > 0
            ((active_sda_tenancies.count.to_f / total_sda_dwellings) * 100).round(1)
          else
            0.0
          end

          # Claims this month (guard against missing table)
          claims_this_month = 0
          if table_exists?("ndis_claims")
            claims_this_month = NdisClaim.where(
              claim_period_start: Date.current.beginning_of_month..Date.current.end_of_month
            ).count
          end

          # Revenue breakdown by SDA category — frontend expects array of {category, amount, count}
          category_abbrev = {
            "high_physical_support" => "HPS",
            "fully_accessible" => "FA",
            "improved_liveability" => "IL",
            "robust" => "Robust"
          }

          revenue_by_category = enrolled
            .joins(:tenancies)
            .where(tenancies: { tenancy_type: "sda", status: "active" })
            .group(:sda_category)

          revenue_sums = revenue_by_category.sum("tenancies.ndia_payment_amount")
          revenue_counts = revenue_by_category.count

          revenue_array = revenue_sums.map do |cat, amount|
            {
              category: category_abbrev[cat] || cat,
              amount: (amount.to_f * 4.33).round(2),
              count: revenue_counts[cat] || 0
            }
          end

          # Enrolment pipeline — frontend expects array of {stage, count, label}
          pipeline_stages = [
            { stage: "not_started", label: "Not Started" },
            { stage: "in_progress", label: "In Progress" },
            { stage: "submitted", label: "Submitted" },
            { stage: "under_review", label: "Under Review" },
            { stage: "enrolled", label: "Enrolled" }
          ]

          # Use sda_enrolment_status if column exists, otherwise derive from sda_enrolled boolean
          pipeline_array = if column_exists?(:properties, :sda_enrolment_status)
            status_counts = sda_properties.group(:sda_enrolment_status).count
            pipeline_stages.map do |ps|
              count = if ps[:stage] == "enrolled"
                enrolled.count
              else
                status_counts[ps[:stage]] || 0
              end
              { stage: ps[:stage], count: count, label: ps[:label] }
            end
          else
            pipeline_stages.map do |ps|
              count = case ps[:stage]
              when "enrolled" then enrolled.count
              when "not_started" then sda_properties.where(sda_enrolled: false).count
              else 0
              end
              { stage: ps[:stage], count: count, label: ps[:label] }
            end
          end

          render json: {
            success: true,
            data: {
              stats: {
                totalDwellings: enrolled.count,
                pendingEnrolments: sda_properties.where(sda_enrolled: false).count,
                monthlyRevenue: monthly_revenue,
                occupancyRate: occupancy_rate,
                complianceScore: 85, # TODO: calculate from documents
                claimsThisMonth: claims_this_month
              },
              revenueBySdaCategory: revenue_array,
              enrolmentPipeline: pipeline_array
            }
          }
        end

        private

        def table_exists?(name)
          ActiveRecord::Base.connection.table_exists?(name)
        rescue
          false
        end

        def column_exists?(table, column)
          ActiveRecord::Base.connection.column_exists?(table, column)
        rescue
          false
        end
      end
    end
  end
end
