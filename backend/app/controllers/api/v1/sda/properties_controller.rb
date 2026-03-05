# frozen_string_literal: true

module Api
  module V1
    module Sda
      # Lists properties that have SDA data (sda_category set or sda_enrolled).
      # This is distinct from the main PropertiesController which handles all property CRUD.
      # SSoT: SDA-specific read views only; mutations go through /api/v1/properties.
      class PropertiesController < ApplicationController
        # GET /api/v1/sda/properties
        def index
          properties = Property
            .includes(:property_type, :property_status, :owner_contact, :tenancies)
            .where.not(sda_category: nil)
            .order(created_at: :desc)

          properties = apply_filters(properties)

          render json: {
            success: true,
            data: properties.map { |p| serialize_sda_property(p) }
          }
        end

        private

        def apply_filters(scope)
          scope = scope.where(sda_enrolled: params[:enrolled] == "true") if params[:enrolled].present?
          scope = scope.where(sda_category: params[:category]) if params[:category].present?
          scope = scope.where(suburb: params[:suburb]) if params[:suburb].present?
          scope
        end

        def serialize_sda_property(property)
          active_tenancy = property.tenancies.find { |t| t.status == "active" && t.tenancy_type == "sda" }

          property.as_json(
            only: [
              :id, :property_code, :name, :street_address, :suburb, :state, :postcode,
              :sda_category, :sda_enrolled, :sda_enrolment_date, :sda_dwelling_id,
              :bedrooms, :bathrooms, :floor_area_sqm, :created_at, :updated_at
            ],
            include: {
              property_type:   { only: [:id, :name] },
              property_status: { only: [:id, :name, :color] },
              owner_contact:   { only: [:id, :display_name, :email, :phone] }
            }
          ).merge(
            activeSdaTenancy: active_tenancy&.as_json(
              only: [:id, :status, :sda_plan_number, :sda_weekly_rate,
                     :participant_rent_contribution, :ndia_payment_amount, :start_date]
            ),
            sdaTenancyCount: property.tenancies.count { |t| t.tenancy_type == "sda" }
          )
        end
      end
    end
  end
end
