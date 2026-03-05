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

          # Revenue breakdown by SDA category (enrolled properties with active SDA tenancies)
          revenue_by_category = enrolled
            .joins(:tenancies)
            .where(tenancies: { tenancy_type: "sda", status: "active" })
            .group(:sda_category)
            .sum("tenancies.ndia_payment_amount")
            .transform_values { |v| (v.to_f * 4.33).round(2) }

          # Enrolment pipeline: enrolled vs not enrolled, grouped by sda_category presence
          enrolment_pipeline = {
            enrolled: enrolled.count,
            pending: sda_properties.where(sda_enrolled: false).count,
            no_category: all_properties.where(sda_category: nil, sda_enrolled: true).count
          }

          render json: {
            success: true,
            data: {
              stats: {
                totalSdaDwellings: enrolled.count,
                pendingEnrolments: sda_properties.where(sda_enrolled: false).count,
                monthlyRevenue: monthly_revenue,
                occupancyRate: occupancy_rate,
                activeSdaTenancies: active_sda_tenancies.count,
                totalSdaProperties: total_sda_dwellings
              },
              revenueBySdaCategory: revenue_by_category,
              enrolmentPipeline: enrolment_pipeline,
              sdaCategories: Property::SDA_CATEGORIES
            }
          }
        end
      end
    end
  end
end
